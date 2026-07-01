use crate::fs_utils::atomic_write;
use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const INDEX_VERSION: u32 = 1;
const SCAN_TTL: Duration = Duration::from_secs(3);
const TITLE_SCAN_LIMIT_BYTES: usize = 128 * 1024;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub thinking_tokens: u64,
    pub factory_credits: f64,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRecord {
    pub id: String,
    pub project_dir: String,
    pub title: Option<String>,
    pub model: Option<String>,
    pub created_at: Option<u64>,
    pub last_active_at: u64,
    pub file_size: u64,
    pub message_count: Option<u64>,
    #[serde(skip)]
    pub jsonl_path: PathBuf,
    #[serde(skip)]
    pub settings_path: Option<PathBuf>,
    pub jsonl_mtime: u64,
    pub settings_mtime: u64,
    pub assistant_active_ms: u64,
    pub token_usage: TokenUsage,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionIndexFile {
    version: u32,
    updated_at: u64,
    sessions: BTreeMap<String, SessionRecord>,
}

impl Default for SessionIndexFile {
    fn default() -> Self {
        Self {
            version: INDEX_VERSION,
            updated_at: 0,
            sessions: BTreeMap::new(),
        }
    }
}

#[derive(Default)]
struct RuntimeIndex {
    loaded: bool,
    last_scan: Option<Instant>,
    data: SessionIndexFile,
}

static INDEX: OnceLock<Mutex<RuntimeIndex>> = OnceLock::new();

fn runtime_index() -> &'static Mutex<RuntimeIndex> {
    INDEX.get_or_init(|| Mutex::new(RuntimeIndex::default()))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn mtime_ms(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn index_path(factory_dir: &Path) -> PathBuf {
    factory_dir
        .join("droid-cockpit")
        .join("session-index-v1.json")
}

fn load_index(factory_dir: &Path) -> SessionIndexFile {
    let path = index_path(factory_dir);
    let Ok(content) = fs::read_to_string(path) else {
        return SessionIndexFile::default();
    };
    let Ok(parsed) = serde_json::from_str::<SessionIndexFile>(&content) else {
        return SessionIndexFile::default();
    };
    if parsed.version == INDEX_VERSION {
        parsed
    } else {
        SessionIndexFile::default()
    }
}

fn save_index(factory_dir: &Path, index: &SessionIndexFile) -> Result<(), String> {
    let content =
        serde_json::to_vec(index).map_err(|e| format!("Failed to serialize session index: {e}"))?;
    atomic_write(&index_path(factory_dir), &content)
}

fn first_user_title(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let mut consumed = 0usize;
    let mut line = String::new();

    while consumed < TITLE_SCAN_LIMIT_BYTES {
        line.clear();
        let read = reader.read_line(&mut line).ok()?;
        if read == 0 {
            break;
        }
        consumed = consumed.saturating_add(read);
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if value.get("type").and_then(Value::as_str) != Some("message") {
            continue;
        }
        let Some(message) = value.get("message") else {
            continue;
        };
        if message.get("role").and_then(Value::as_str) != Some("user") {
            continue;
        }

        let mut candidates = Vec::new();
        match message.get("content") {
            Some(Value::String(text)) => candidates.push(text.as_str()),
            Some(Value::Array(blocks)) => {
                for block in blocks {
                    if block.get("type").and_then(Value::as_str) == Some("text") {
                        if let Some(text) = block.get("text").and_then(Value::as_str) {
                            candidates.push(text);
                        }
                    }
                }
            }
            _ => {}
        }

        for candidate in candidates {
            let trimmed = candidate.trim();
            if trimmed.is_empty() || trimmed.starts_with("<system-reminder>") {
                continue;
            }
            let collapsed = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
            let title = collapsed.chars().take(220).collect::<String>();
            if !title.is_empty() {
                return Some(title);
            }
        }
    }
    None
}

fn parse_usage_settings(path: &Path, record: &mut SessionRecord) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<Value>(&content) else {
        return;
    };
    record.model = value
        .get("model")
        .and_then(Value::as_str)
        .map(str::to_string);
    record.assistant_active_ms = value
        .get("assistantActiveTimeMs")
        .and_then(Value::as_u64)
        .unwrap_or(0);

    let usage = value
        .get("tokenUsage")
        .filter(|item| item.as_object().is_some_and(|object| !object.is_empty()))
        .or_else(|| value.get("inclusiveTokenUsage"));
    let number = |key: &str| {
        usage
            .and_then(|u| u.get(key))
            .and_then(Value::as_u64)
            .unwrap_or(0)
    };
    record.token_usage = TokenUsage {
        input_tokens: number("inputTokens"),
        output_tokens: number("outputTokens"),
        cache_creation_tokens: number("cacheCreationTokens"),
        cache_read_tokens: number("cacheReadTokens"),
        thinking_tokens: number("thinkingTokens"),
        factory_credits: usage
            .and_then(|u| u.get("factoryCredits"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    };
}

fn refresh_locked(
    factory_dir: &Path,
    runtime: &mut RuntimeIndex,
    force: bool,
) -> Result<(), String> {
    if !runtime.loaded {
        runtime.data = load_index(factory_dir);
        runtime.loaded = true;
    }
    if !force
        && runtime
            .last_scan
            .is_some_and(|last| last.elapsed() < SCAN_TTL)
    {
        return Ok(());
    }

    let sessions_dir = factory_dir.join("sessions");
    if !sessions_dir.exists() {
        runtime.data.sessions.clear();
        runtime.last_scan = Some(Instant::now());
        return Ok(());
    }

    let mut seen = BTreeSet::new();
    let mut changed = false;
    let projects = fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions directory: {e}"))?;

    for project in projects.flatten() {
        let project_path = project.path();
        let Ok(project_type) = project.file_type() else {
            continue;
        };
        if !project_type.is_dir() || project_type.is_symlink() {
            continue;
        }
        let project_dir = project.file_name().to_string_lossy().to_string();
        let Ok(files) = fs::read_dir(&project_path) else {
            continue;
        };

        for entry in files.flatten() {
            let jsonl_path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.ends_with(".jsonl") {
                continue;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if !file_type.is_file() || file_type.is_symlink() {
                continue;
            }
            let Ok(jsonl_meta) = entry.metadata() else {
                continue;
            };
            let id = file_name.trim_end_matches(".jsonl").to_string();
            let key = format!("{project_dir}/{id}");
            seen.insert(key.clone());

            let settings_path = project_path.join(format!("{id}.settings.json"));
            let settings_meta = fs::symlink_metadata(&settings_path)
                .ok()
                .filter(|metadata| metadata.is_file() && !metadata.file_type().is_symlink());
            let settings_mtime = settings_meta.as_ref().map(mtime_ms).unwrap_or(0);
            let jsonl_mtime = mtime_ms(&jsonl_meta);

            let previous = runtime.data.sessions.get(&key).cloned();
            let mut record = previous.clone().unwrap_or_else(|| SessionRecord {
                id: id.clone(),
                project_dir: project_dir.clone(),
                jsonl_path: jsonl_path.clone(),
                settings_path: settings_meta.as_ref().map(|_| settings_path.clone()),
                ..SessionRecord::default()
            });

            record.file_size = jsonl_meta.len();
            record.jsonl_path = jsonl_path.clone();
            record.jsonl_mtime = jsonl_mtime;
            record.settings_mtime = settings_mtime;
            record.last_active_at = jsonl_mtime.max(settings_mtime);
            record.created_at = record.created_at.or_else(|| {
                jsonl_meta
                    .created()
                    .ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as u64)
            });
            record.settings_path = settings_meta.as_ref().map(|_| settings_path.clone());

            if record.title.is_none() || previous.as_ref().is_none() {
                record.title = first_user_title(&jsonl_path);
            }
            if previous
                .as_ref()
                .is_none_or(|old| old.settings_mtime != settings_mtime)
                && settings_meta.is_some()
            {
                parse_usage_settings(&settings_path, &mut record);
            }

            if previous.as_ref() != Some(&record) {
                runtime.data.sessions.insert(key, record);
                changed = true;
            }
        }
    }

    let before = runtime.data.sessions.len();
    runtime.data.sessions.retain(|key, _| seen.contains(key));
    changed |= before != runtime.data.sessions.len();
    runtime.data.updated_at = now_ms();
    runtime.last_scan = Some(Instant::now());

    if changed {
        save_index(factory_dir, &runtime.data)?;
    }
    Ok(())
}

pub fn list_sessions(factory_dir: &Path, force: bool) -> Result<String, String> {
    let mut runtime = runtime_index()
        .lock()
        .map_err(|_| "Session index lock poisoned".to_string())?;
    refresh_locked(factory_dir, &mut runtime, force)?;
    let mut sessions = runtime.data.sessions.values().cloned().collect::<Vec<_>>();
    sessions.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));
    serde_json::to_string(&sessions).map_err(|e| format!("Failed to serialize sessions: {e}"))
}

pub fn resolve_session(
    factory_dir: &Path,
    session_id: &str,
    project_dir: &str,
) -> Result<SessionRecord, String> {
    let mut runtime = runtime_index()
        .lock()
        .map_err(|_| "Session index lock poisoned".to_string())?;
    refresh_locked(factory_dir, &mut runtime, false)?;
    let key = format!("{project_dir}/{session_id}");
    let mut record = runtime
        .data
        .sessions
        .get(&key)
        .cloned()
        .ok_or_else(|| "Session not found in index".to_string())?;
    let sessions_root = fs::canonicalize(factory_dir.join("sessions"))
        .map_err(|e| format!("Failed to resolve sessions directory: {e}"))?;
    record.jsonl_path = validate_session_file(&sessions_root, &record.jsonl_path)?;
    record.settings_path = record
        .settings_path
        .as_ref()
        .map(|path| validate_session_file(&sessions_root, path))
        .transpose()?;
    Ok(record)
}

fn validate_session_file(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|e| format!("Failed to inspect session file: {e}"))?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("Session links and non-file entries are not allowed".to_string());
    }
    let canonical =
        fs::canonicalize(path).map_err(|e| format!("Failed to resolve session file: {e}"))?;
    if !canonical.starts_with(root) {
        return Err("Session file resolves outside the sessions directory".to_string());
    }
    Ok(canonical)
}

pub fn invalidate() {
    if let Ok(mut runtime) = runtime_index().lock() {
        runtime.last_scan = None;
    }
}

pub fn read_messages(record: &SessionRecord, limit: Option<usize>) -> Result<String, String> {
    let file =
        File::open(&record.jsonl_path).map_err(|e| format!("Failed to open session: {e}"))?;
    let reader = BufReader::new(file);
    let max = limit.unwrap_or(50).clamp(1, 500);
    let mut messages = Vec::new();

    for line in reader.lines() {
        if messages.len() >= max {
            break;
        }
        let Ok(line) = line else { continue };
        let Ok(obj) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if obj.get("type").and_then(Value::as_str) != Some("message") {
            continue;
        }
        let Some(message) = obj.get("message") else {
            continue;
        };
        let role = message.get("role").and_then(Value::as_str).unwrap_or("");
        if role != "user" && role != "assistant" {
            continue;
        }
        let mut texts = Vec::new();
        match message.get("content") {
            Some(Value::String(text)) => texts.push(text.clone()),
            Some(Value::Array(blocks)) => {
                for block in blocks {
                    match block.get("type").and_then(Value::as_str) {
                        Some("text") => {
                            if let Some(text) = block.get("text").and_then(Value::as_str) {
                                if !text.trim_start().starts_with("<system-reminder>") {
                                    texts.push(text.to_string());
                                }
                            }
                        }
                        Some("tool_use") => {
                            if let Some(name) = block.get("name").and_then(Value::as_str) {
                                texts.push(format!("[tool: {name}]"));
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
        let content = texts.join("\n");
        if !content.trim().is_empty() {
            messages.push(serde_json::json!({
                "role": role,
                "type": "message",
                "content": content,
            }));
        }
    }

    serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize messages: {e}"))
}

pub fn usage_stats(factory_dir: &Path, force: bool) -> Result<String, String> {
    let mut runtime = runtime_index()
        .lock()
        .map_err(|_| "Session index lock poisoned".to_string())?;
    refresh_locked(factory_dir, &mut runtime, force)?;

    let mut totals = serde_json::json!({
        "totalSessions": runtime.data.sessions.len() as u64,
        "totalMessages": 0u64,
        "messageCountComplete": false,
        "totalInputTokens": 0u64,
        "totalOutputTokens": 0u64,
        "totalCacheReadTokens": 0u64,
        "totalCacheCreationTokens": 0u64,
        "totalThinkingTokens": 0u64,
        "totalFactoryCredits": 0f64,
        "totalAssistantActiveMs": 0u64,
        "byModel": [],
        "byProject": [],
        "daily": [],
        "sessions": [],
        "recentSessions": [],
        "indexUpdatedAt": runtime.data.updated_at,
    });

    let mut by_model: HashMap<String, Value> = HashMap::new();
    let mut by_project: HashMap<String, Value> = HashMap::new();
    let mut daily: BTreeMap<String, Value> = BTreeMap::new();
    let mut all_sessions = Vec::new();
    let mut recent = Vec::new();

    for record in runtime.data.sessions.values() {
        let usage = &record.token_usage;
        for (key, value) in [
            ("totalInputTokens", usage.input_tokens),
            ("totalOutputTokens", usage.output_tokens),
            ("totalCacheReadTokens", usage.cache_read_tokens),
            ("totalCacheCreationTokens", usage.cache_creation_tokens),
            ("totalThinkingTokens", usage.thinking_tokens),
            ("totalAssistantActiveMs", record.assistant_active_ms),
        ] {
            totals[key] =
                serde_json::json!(totals[key].as_u64().unwrap_or(0).saturating_add(value));
        }
        totals["totalFactoryCredits"] = serde_json::json!(
            totals["totalFactoryCredits"].as_f64().unwrap_or(0.0) + usage.factory_credits
        );

        if let Some(count) = record.message_count {
            totals["totalMessages"] = serde_json::json!(totals["totalMessages"]
                .as_u64()
                .unwrap_or(0)
                .saturating_add(count));
        }

        let model = record
            .model
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let model_entry = by_model.entry(model.clone()).or_insert_with(|| {
            serde_json::json!({
                "model": model,
                "sessions": 0u64,
                "inputTokens": 0u64,
                "outputTokens": 0u64,
                "cacheReadTokens": 0u64,
                "cacheCreationTokens": 0u64,
                "thinkingTokens": 0u64,
                "factoryCredits": 0f64,
                "assistantActiveMs": 0u64,
            })
        });
        accumulate_usage(model_entry, usage, record.assistant_active_ms);

        let project_entry = by_project
            .entry(record.project_dir.clone())
            .or_insert_with(|| {
                serde_json::json!({
                    "project": record.project_dir,
                    "sessions": 0u64,
                    "inputTokens": 0u64,
                    "outputTokens": 0u64,
                })
            });
        project_entry["sessions"] =
            serde_json::json!(project_entry["sessions"].as_u64().unwrap_or(0) + 1);
        project_entry["inputTokens"] = serde_json::json!(
            project_entry["inputTokens"].as_u64().unwrap_or(0) + usage.input_tokens
        );
        project_entry["outputTokens"] = serde_json::json!(
            project_entry["outputTokens"].as_u64().unwrap_or(0) + usage.output_tokens
        );

        let date_key = Local
            .timestamp_millis_opt(record.last_active_at as i64)
            .single()
            .map(|date| date.format("%Y-%m-%d").to_string());

        if let Some(date) = date_key.clone() {
            let day = daily.entry(date.clone()).or_insert_with(|| {
                serde_json::json!({
                    "date": date,
                    "sessions": 0u64,
                    "inputTokens": 0u64,
                    "outputTokens": 0u64,
                    "cacheReadTokens": 0u64,
                    "cacheCreationTokens": 0u64,
                    "thinkingTokens": 0u64,
                })
            });
            day["sessions"] = serde_json::json!(day["sessions"].as_u64().unwrap_or(0) + 1);
            for (key, value) in [
                ("inputTokens", usage.input_tokens),
                ("outputTokens", usage.output_tokens),
                ("cacheReadTokens", usage.cache_read_tokens),
                ("cacheCreationTokens", usage.cache_creation_tokens),
                ("thinkingTokens", usage.thinking_tokens),
            ] {
                day[key] = serde_json::json!(day[key].as_u64().unwrap_or(0) + value);
            }
        }

        let session_usage = serde_json::json!({
            "sessionId": record.id,
            "projectDir": record.project_dir,
            "title": record.title,
            "model": record.model,
            "date": date_key,
            "inputTokens": usage.input_tokens,
            "outputTokens": usage.output_tokens,
            "cacheReadTokens": usage.cache_read_tokens,
            "cacheCreationTokens": usage.cache_creation_tokens,
            "thinkingTokens": usage.thinking_tokens,
            "factoryCredits": usage.factory_credits,
            "assistantActiveMs": record.assistant_active_ms,
            "totalTokens": usage.input_tokens + usage.output_tokens + usage.cache_read_tokens + usage.cache_creation_tokens,
            "messageCount": record.message_count,
            "lastActiveAt": record.last_active_at,
        });
        all_sessions.push(session_usage.clone());
        recent.push(session_usage);
    }

    recent.sort_by(|a, b| {
        b.get("lastActiveAt")
            .and_then(Value::as_u64)
            .cmp(&a.get("lastActiveAt").and_then(Value::as_u64))
    });
    recent.truncate(20);
    all_sessions.sort_by(|a, b| {
        b.get("lastActiveAt")
            .and_then(Value::as_u64)
            .cmp(&a.get("lastActiveAt").and_then(Value::as_u64))
    });

    let mut models = by_model.into_values().collect::<Vec<_>>();
    models.sort_by_key(|item| {
        std::cmp::Reverse(
            item["inputTokens"].as_u64().unwrap_or(0) + item["outputTokens"].as_u64().unwrap_or(0),
        )
    });
    let mut projects = by_project.into_values().collect::<Vec<_>>();
    projects.sort_by_key(|item| {
        std::cmp::Reverse(
            item["inputTokens"].as_u64().unwrap_or(0) + item["outputTokens"].as_u64().unwrap_or(0),
        )
    });

    totals["byModel"] = Value::Array(models);
    totals["byProject"] = Value::Array(projects);
    totals["daily"] = Value::Array(daily.into_values().collect());
    totals["sessions"] = Value::Array(all_sessions);
    totals["recentSessions"] = Value::Array(recent);
    serde_json::to_string(&totals).map_err(|e| format!("Failed to serialize usage: {e}"))
}

fn accumulate_usage(target: &mut Value, usage: &TokenUsage, active_ms: u64) {
    target["sessions"] = serde_json::json!(target["sessions"].as_u64().unwrap_or(0) + 1);
    for (key, value) in [
        ("inputTokens", usage.input_tokens),
        ("outputTokens", usage.output_tokens),
        ("cacheReadTokens", usage.cache_read_tokens),
        ("cacheCreationTokens", usage.cache_creation_tokens),
        ("thinkingTokens", usage.thinking_tokens),
        ("assistantActiveMs", active_ms),
    ] {
        target[key] = serde_json::json!(target[key].as_u64().unwrap_or(0) + value);
    }
    target["factoryCredits"] =
        serde_json::json!(target["factoryCredits"].as_f64().unwrap_or(0.0) + usage.factory_credits);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn test_factory_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "droid-cockpit-session-index-{}-{}",
            std::process::id(),
            now_ms(),
        ))
    }

    #[test]
    fn indexes_metadata_and_updates_only_changed_usage() {
        let factory = test_factory_dir();
        let project = factory.join("sessions").join("project-a");
        fs::create_dir_all(&project).unwrap();
        let jsonl = project.join("session-1.jsonl");
        let mut file = File::create(&jsonl).unwrap();
        writeln!(
            file,
            r#"{{"type":"message","message":{{"role":"user","content":"First user request"}}}}"#
        )
        .unwrap();
        writeln!(file, r#"{{"type":"message","message":{{"role":"assistant","content":[{{"type":"text","text":"Answer"}}]}}}}"#).unwrap();
        let settings = project.join("session-1.settings.json");
        fs::write(&settings, r#"{"model":"test-model","tokenUsage":{},"inclusiveTokenUsage":{"inputTokens":12,"outputTokens":3}}"#).unwrap();

        invalidate();
        let sessions: Vec<SessionRecord> =
            serde_json::from_str(&list_sessions(&factory, true).unwrap()).unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].title.as_deref(), Some("First user request"));
        assert_eq!(sessions[0].message_count, None);
        assert_eq!(sessions[0].token_usage.input_tokens, 12);

        let record = resolve_session(&factory, "session-1", "project-a").unwrap();
        let messages: Vec<Value> =
            serde_json::from_str(&read_messages(&record, Some(1)).unwrap()).unwrap();
        assert_eq!(messages.len(), 1);

        std::thread::sleep(Duration::from_millis(20));
        fs::write(
            &settings,
            r#"{"model":"test-model","tokenUsage":{"inputTokens":20,"outputTokens":5}}"#,
        )
        .unwrap();
        let usage: Value = serde_json::from_str(&usage_stats(&factory, true).unwrap()).unwrap();
        assert_eq!(usage["totalInputTokens"], 20);
        assert_eq!(usage["totalOutputTokens"], 5);
        assert_eq!(usage["messageCountComplete"], false);

        let _ = fs::remove_dir_all(factory);
    }

    #[test]
    #[ignore]
    fn benchmarks_home_factory_index() {
        let Some(home) = dirs::home_dir() else {
            println!("home directory unavailable");
            return;
        };
        let factory = home.join(".factory");
        if !factory.join("sessions").exists() {
            println!("{} has no sessions directory", factory.display());
            return;
        }

        invalidate();
        let first_start = Instant::now();
        let sessions_raw = list_sessions(&factory, true).unwrap();
        let first_scan = first_start.elapsed();
        let sessions: Vec<Value> = serde_json::from_str(&sessions_raw).unwrap();

        let usage_start = Instant::now();
        let usage_raw = usage_stats(&factory, false).unwrap();
        let usage_scan = usage_start.elapsed();
        let usage: Value = serde_json::from_str(&usage_raw).unwrap();

        let cached_start = Instant::now();
        let cached_raw = usage_stats(&factory, false).unwrap();
        let cached_scan = cached_start.elapsed();

        println!(
            "home index probe: sessions={} firstScanMs={} usageMs={} cachedUsageMs={} usagePayloadKB={} cachedPayloadKB={}",
            sessions.len(),
            first_scan.as_millis(),
            usage_scan.as_millis(),
            cached_scan.as_millis(),
            usage_raw.len() / 1024,
            cached_raw.len() / 1024,
        );
        assert_eq!(
            usage["totalSessions"].as_u64().unwrap_or_default() as usize,
            sessions.len()
        );
    }
}
