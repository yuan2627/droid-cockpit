mod fs_utils;
mod session_index;

use serde_json::Value;
use std::fs;
use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_RESPONSE_PREVIEW_BYTES: usize = 32 * 1024;
const MAX_CONFIG_BYTES: usize = 10 * 1024 * 1024;

static CONFIG_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn lock_config_writes() -> Result<MutexGuard<'static, ()>, String> {
    CONFIG_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Configuration write lock is unavailable".to_string())
}

fn background_command(program: &str) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(program);
    command.kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    command
}

// ============ Path helpers ============

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Unable to resolve the current user's home directory".to_string())
}

fn factory_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".factory"))
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("settings.json"))
}

fn mcp_path() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("mcp.json"))
}

fn cockpit_models_path() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("cockpit-models.json"))
}

fn cockpit_backups_dir() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("cockpit-backups"))
}

fn skill_backups_dir() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("skill-backups"))
}

fn agents_md_path() -> Result<PathBuf, String> {
    Ok(factory_dir()?.join("AGENTS.md"))
}

// ============ Atomic write helper ============

fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
    fs_utils::atomic_write(path, content.as_bytes())
}

fn now_timestamp() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S_%3f").to_string()
}

// ============ Settings commands ============

#[tauri::command]
fn read_settings() -> Result<String, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
fn write_settings(content: String) -> Result<(), String> {
    let _guard = lock_config_writes()?;
    if content.len() > MAX_CONFIG_BYTES {
        return Err("settings.json exceeds the 10 MB safety limit".to_string());
    }
    let path = settings_path()?;
    let parsed =
        serde_json::from_str::<Value>(&content).map_err(|e| format!("Invalid JSON: {e}"))?;
    if !parsed.is_object() {
        return Err("settings.json must contain a JSON object".to_string());
    }
    if path.exists() {
        let current = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read current settings before save: {e}"))?;
        if current == content {
            return Ok(());
        }
        write_backup_bundle()
            .map_err(|e| format!("Failed to back up current settings before save: {e}"))?;
    }
    atomic_write(&path, &content).map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
fn get_settings_metadata() -> Result<String, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(r#"{"exists":false,"modifiedMs":0,"size":0}"#.to_string());
    }
    let metadata =
        fs::metadata(&path).map_err(|e| format!("Failed to read settings metadata: {e}"))?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    serde_json::to_string(&serde_json::json!({
        "exists": true,
        "modifiedMs": modified_ms,
        "size": metadata.len(),
    }))
    .map_err(|e| format!("Failed to serialize settings metadata: {e}"))
}

#[tauri::command]
fn read_mcp_config() -> Result<String, String> {
    let path = mcp_path()?;
    if !path.exists() {
        return Ok(r#"{"mcpServers":{}}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read mcp.json: {}", e))
}

#[tauri::command]
fn write_mcp_config(content: String) -> Result<(), String> {
    let _guard = lock_config_writes()?;
    if content.len() > MAX_CONFIG_BYTES {
        return Err("mcp.json exceeds the 10 MB safety limit".to_string());
    }
    let path = mcp_path()?;
    let parsed =
        serde_json::from_str::<Value>(&content).map_err(|e| format!("Invalid JSON: {e}"))?;
    if !parsed.get("mcpServers").is_some_and(Value::is_object) {
        return Err("mcp.json must contain an mcpServers object".to_string());
    }
    if path.exists() && fs::read_to_string(&path).ok().as_deref() != Some(content.as_str()) {
        write_backup_bundle()
            .map_err(|e| format!("Failed to back up current configuration before save: {e}"))?;
    }
    atomic_write(&path, &content).map_err(|e| format!("Failed to write mcp.json: {}", e))
}

// ============ Cockpit models (app-private persistence) ============

#[tauri::command]
fn read_cockpit_models() -> Result<String, String> {
    let path = cockpit_models_path()?;
    if !path.exists() {
        return Ok(r#"{"allModels":[],"shownModelIds":[],"sortOrder":[],"version":1}"#.to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read cockpit-models: {}", e))
}

#[tauri::command]
fn write_cockpit_models(content: String) -> Result<(), String> {
    let _guard = lock_config_writes()?;
    if content.len() > MAX_CONFIG_BYTES {
        return Err("cockpit-models.json exceeds the 10 MB safety limit".to_string());
    }
    let path = cockpit_models_path()?;
    let parsed =
        serde_json::from_str::<Value>(&content).map_err(|e| format!("Invalid JSON: {e}"))?;
    if !parsed.get("allModels").is_some_and(Value::is_array)
        || !parsed.get("shownModelIds").is_some_and(Value::is_array)
        || !parsed.get("sortOrder").is_some_and(Value::is_array)
    {
        return Err("cockpit-models.json is missing required arrays".to_string());
    }
    if path.exists() && fs::read_to_string(&path).ok().as_deref() != Some(content.as_str()) {
        write_backup_bundle()
            .map_err(|e| format!("Failed to back up current configuration before save: {e}"))?;
    }
    atomic_write(&path, &content).map_err(|e| format!("Failed to write cockpit-models: {}", e))
}

// ============ Droid version ============

#[tauri::command]
async fn get_droid_version() -> Result<String, String> {
    let mut command = background_command("droid");
    command.arg("--version");
    let output = tokio::time::timeout(Duration::from_secs(5), command.output())
        .await
        .map_err(|_| "Timed out while detecting the Droid version".to_string())?
        .map_err(|e| format!("Failed to run droid: {e}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("droid --version exited with {}", output.status)
        } else {
            format!("droid --version failed: {detail}")
        });
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        Err("droid --version returned no version text".to_string())
    } else {
        Ok(version)
    }
}

// ============ Sessions ============

#[tauri::command]
async fn list_sessions(force: Option<bool>) -> Result<String, String> {
    let factory = factory_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        session_index::list_sessions(&factory, force.unwrap_or(false))
    })
    .await
    .map_err(|e| format!("Session index task failed: {e}"))?
}

#[allow(dead_code)]
fn list_sessions_legacy() -> Result<String, String> {
    let sessions_dir = factory_dir()?.join("sessions");
    if !sessions_dir.exists() {
        return Ok("[]".to_string());
    }
    let mut sessions: Vec<Value> = Vec::new();
    if let Ok(dir_entries) = fs::read_dir(&sessions_dir) {
        for dir_entry in dir_entries.flatten() {
            let dir_path = dir_entry.path();
            if !dir_path.is_dir() {
                continue;
            }
            let project_dir = dir_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if let Ok(file_entries) = fs::read_dir(&dir_path) {
                for file_entry in file_entries.flatten() {
                    let file_path = file_entry.path();
                    let fname = file_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    if !fname.ends_with(".jsonl") {
                        continue;
                    }
                    let session_id = fname.trim_end_matches(".jsonl").to_string();
                    let mut meta = serde_json::json!({
                        "id": session_id.clone(),
                        "projectDir": project_dir.clone(),
                        "fileName": fname.clone(),
                    });
                    if let Ok(content) = fs::read_to_string(&file_path) {
                        if let Ok(metadata) = fs::metadata(&file_path) {
                            if let Ok(modified) = metadata.modified() {
                                if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                                    meta["lastActiveAt"] =
                                        serde_json::json!(duration.as_millis() as u64);
                                }
                            }
                        }
                        if let Some(first_line) = content.lines().next() {
                            if let Ok(line_val) = serde_json::from_str::<Value>(first_line) {
                                if let Some(title) = line_val.get("title") {
                                    meta["title"] = title.clone();
                                }
                                if let Some(cwd) = line_val.get("cwd") {
                                    meta["cwd"] = cwd.clone();
                                }
                                if let Some(ts) = line_val.get("timestamp") {
                                    meta["createdAt"] = ts.clone();
                                }
                            }
                        }
                        let line_count = content.lines().count();
                        meta["messageCount"] = serde_json::json!(line_count);
                        meta["fileSize"] = serde_json::json!(content.len());
                    }
                    sessions.push(meta);
                }
            }
        }
    }
    sessions.sort_by(|a, b| {
        let a_time = a.get("lastActiveAt").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_time = b.get("lastActiveAt").and_then(|v| v.as_u64()).unwrap_or(0);
        b_time.cmp(&a_time)
    });
    serde_json::to_string(&sessions).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
async fn read_session_messages(
    session_id: String,
    project_dir: String,
    limit: Option<usize>,
) -> Result<String, String> {
    let factory = factory_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        let record = session_index::resolve_session(&factory, &session_id, &project_dir)?;
        session_index::read_messages(&record, limit)
    })
    .await
    .map_err(|e| format!("Session read task failed: {e}"))?
}

#[allow(dead_code)]
fn read_session_messages_legacy(
    session_id: String,
    project_dir: String,
    limit: Option<usize>,
) -> Result<String, String> {
    let sessions_dir = factory_dir()?.join("sessions");
    let file_path = sessions_dir
        .join(&project_dir)
        .join(format!("{}.jsonl", session_id));
    if !file_path.exists() {
        return Ok("[]".to_string());
    }
    let content =
        fs::read_to_string(&file_path).map_err(|e| format!("Failed to read session: {}", e))?;
    let mut messages: Vec<Value> = Vec::new();
    let max = limit.unwrap_or(usize::MAX);
    for line in content.lines() {
        if messages.len() >= max {
            break;
        }
        if let Ok(obj) = serde_json::from_str::<Value>(line) {
            let msg_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if msg_type == "message" {
                if let Some(msg) = obj.get("message") {
                    let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("");
                    let mut entry = serde_json::json!({
                        "role": role,
                        "type": msg_type,
                    });
                    // Extract text content
                    if let Some(content) = msg.get("content") {
                        if let Some(s) = content.as_str() {
                            entry["content"] = Value::String(s.to_string());
                        } else if let Some(arr) = content.as_array() {
                            let mut texts: Vec<String> = Vec::new();
                            for block in arr {
                                if let Some(b) = block.as_object() {
                                    if let Some(t) = b.get("type").and_then(|v| v.as_str()) {
                                        if t == "text" {
                                            if let Some(txt) =
                                                b.get("text").and_then(|v| v.as_str())
                                            {
                                                texts.push(txt.to_string());
                                            }
                                        } else if t == "tool_use" {
                                            if let Some(name) =
                                                b.get("name").and_then(|v| v.as_str())
                                            {
                                                texts.push(format!("[tool: {}]", name));
                                            }
                                        } else if t == "tool_result" {
                                            texts.push("[tool_result]".to_string());
                                        }
                                    }
                                }
                            }
                            entry["content"] = Value::String(texts.join("\n"));
                        }
                    }
                    messages.push(entry);
                }
            }
        }
    }
    serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
fn delete_session(session_id: String, project_dir: String) -> Result<(), String> {
    let factory = factory_dir()?;
    let record = session_index::resolve_session(&factory, &session_id, &project_dir)?;
    let trash_dir = factory
        .join("droid-cockpit")
        .join("session-trash")
        .join(format!("{}_{}", now_timestamp(), session_id));
    fs::create_dir_all(&trash_dir).map_err(|e| format!("Failed to create session trash: {e}"))?;

    let jsonl_name = record
        .jsonl_path
        .file_name()
        .ok_or_else(|| "Invalid session file name".to_string())?;
    fs::rename(&record.jsonl_path, trash_dir.join(jsonl_name))
        .map_err(|e| format!("Failed to move session to trash: {e}"))?;
    if let Some(settings_path) = record.settings_path {
        if settings_path.exists() {
            if let Some(name) = settings_path.file_name() {
                fs::rename(&settings_path, trash_dir.join(name)).map_err(|e| {
                    format!("Session moved but settings metadata failed to move: {e}")
                })?;
            }
        }
    }
    session_index::invalidate();
    Ok(())
}

// ============ Skills ============

#[tauri::command]
fn list_skills() -> Result<String, String> {
    let home = home_dir()?;
    // Scan both ~/.factory/skills/ and ~/.agents/skills/
    let skills_dirs = vec![
        ("factory", factory_dir()?.join("skills")),
        ("agents", home.join(".agents").join("skills")),
    ];
    let mut skills: Vec<Value> = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (source, skills_dir) in &skills_dirs {
        if !skills_dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let is_real_directory = entry
                    .file_type()
                    .is_ok_and(|file_type| file_type.is_dir() && !file_type.is_symlink());
                if is_real_directory {
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    // Skip duplicates (prefer factory skills over agents skills)
                    if seen_names.contains(&name) {
                        continue;
                    }
                    seen_names.insert(name.clone());
                    let mut skill = serde_json::json!({
                        "id": name.clone(),
                        "name": name.clone(),
                        "enabled": true,
                        "path": path.to_string_lossy(),
                        "managed": false,
                        "source": source,
                    });
                    // Read SKILL.md frontmatter for name + description
                    let skill_md = path.join("SKILL.md");
                    if let Ok(content) = fs::read_to_string(&skill_md) {
                        skill["managed"] = serde_json::json!(true);
                        // Parse YAML frontmatter (between --- markers)
                        if content.starts_with("---") {
                            let end = content[3..].find("---");
                            if let Some(end_idx) = end {
                                let frontmatter = &content[3..3 + end_idx];
                                for line in frontmatter.lines() {
                                    let line = line.trim();
                                    if let Some(rest) = line.strip_prefix("name:") {
                                        skill["name"] = Value::String(
                                            rest.trim().trim_matches('"').to_string(),
                                        );
                                    } else if let Some(rest) = line.strip_prefix("description:") {
                                        let desc = rest.trim().trim_matches('"');
                                        if !desc.is_empty() {
                                            skill["description"] = Value::String(desc.to_string());
                                        }
                                    } else if let Some(rest) = line.strip_prefix("version:") {
                                        let ver = rest.trim().trim_matches('"');
                                        if !ver.is_empty() {
                                            skill["version"] = Value::String(ver.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                    skills.push(skill);
                }
            }
        }
    }
    // Sort: managed first, then alphabetical
    skills.sort_by(|a, b| {
        let a_managed = a["managed"].as_bool().unwrap_or(false);
        let b_managed = b["managed"].as_bool().unwrap_or(false);
        b_managed.cmp(&a_managed).then_with(|| {
            a["name"]
                .as_str()
                .unwrap_or("")
                .cmp(b["name"].as_str().unwrap_or(""))
        })
    });
    serde_json::to_string(&skills).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
fn uninstall_skill(name: String) -> Result<(), String> {
    if !fs_utils::is_single_path_component(&name) {
        return Err("Invalid skill name".to_string());
    }
    let home = home_dir()?;
    // Check both ~/.factory/skills/ and ~/.agents/skills/
    let candidates = vec![
        factory_dir()?.join("skills").join(&name),
        home.join(".agents").join("skills").join(&name),
    ];
    let skill_path = candidates
        .iter()
        .find(|p| p.exists())
        .cloned()
        .ok_or_else(|| format!("Skill {} not found", name))?;
    // Backup before uninstall
    let backup_dir = skill_backups_dir()?;
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }
    let backup_name = format!("{}_{}", name, now_timestamp());
    let backup_path = backup_dir.join(&backup_name);
    // Try copy (rename would move the original; we want to delete after backup)
    copy_dir_recursive(&skill_path, &backup_path)
        .map_err(|e| format!("Failed to backup skill: {}", e))?;
    // Remove original
    fs::remove_dir_all(&skill_path).map_err(|e| format!("Failed to remove skill: {}", e))?;
    Ok(())
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    let source_metadata = fs::symlink_metadata(src)?;
    if source_metadata.file_type().is_symlink() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "skill backup refuses symbolic links and junctions",
        ));
    }
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "skill backup refuses symbolic links and junctions",
            ));
        }
        if metadata.is_dir() {
            copy_dir_recursive(&path, &dst.join(entry.file_name()))?;
        } else if metadata.is_file() {
            fs::copy(&path, &dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

// ============ AGENTS.md ============

#[tauri::command]
fn read_agents_md() -> Result<String, String> {
    let path = agents_md_path()?;
    if !path.exists() {
        return Ok(
            "# AGENTS.md\n\nThis file contains project-level instructions for Factory Droid.\n"
                .to_string(),
        );
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read AGENTS.md: {}", e))
}

#[tauri::command]
fn write_agents_md(content: String) -> Result<(), String> {
    let path = agents_md_path()?;
    atomic_write(&path, &content).map_err(|e| format!("Failed to write AGENTS.md: {}", e))
}

#[tauri::command]
fn get_agents_mtime() -> Result<u64, String> {
    let path = agents_md_path()?;
    if !path.exists() {
        return Ok(0);
    }
    let metadata = fs::metadata(&path).map_err(|e| format!("Failed to get metadata: {}", e))?;
    let modified = metadata
        .modified()
        .map_err(|e| format!("Failed to get mtime: {}", e))?;
    let duration = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Time error: {}", e))?;
    Ok(duration.as_millis() as u64)
}

// ============ Backups ============

fn read_text_or(path: &PathBuf, fallback: &str) -> Result<String, String> {
    if !path.exists() {
        return Ok(fallback.to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))
}

fn is_backup_name(name: &str) -> bool {
    fs_utils::is_single_path_component(name)
        && name.ends_with(".json")
        && name.starts_with("bundle_")
}

fn write_backup_bundle() -> Result<String, String> {
    let backup_dir = cockpit_backups_dir()?;
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;
    let value = serde_json::json!({
        "version": 1,
        "createdAt": chrono::Utc::now().to_rfc3339(),
        "files": {
            "settings.json": read_text_or(&settings_path()?, "{}")?,
            "mcp.json": read_text_or(&mcp_path()?, "{\"mcpServers\":{}}")?,
            "cockpit-models.json": read_text_or(
                &cockpit_models_path()?,
                "{\"allModels\":[],\"shownModelIds\":[],\"sortOrder\":[],\"version\":1}",
            )?,
        },
    });
    let backup_name = format!("bundle_{}.json", now_timestamp());
    let serialized = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize backup: {e}"))?;
    atomic_write(&backup_dir.join(&backup_name), &serialized)?;

    let mut backups: Vec<(PathBuf, u64)> = fs::read_dir(&backup_dir)
        .map_err(|e| format!("Failed to list backup dir: {e}"))?
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if !is_backup_name(&name) {
                return None;
            }
            let modified = entry
                .metadata()
                .ok()?
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_millis() as u64;
            Some((entry.path(), modified))
        })
        .collect();
    backups.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in backups.iter().skip(10) {
        let _ = fs::remove_file(path);
    }
    Ok(backup_name)
}

fn contains_redacted_secret(value: &Value) -> bool {
    match value {
        Value::String(text) => text.contains("***REDACTED***"),
        Value::Array(items) => items.iter().any(contains_redacted_secret),
        Value::Object(map) => map.values().any(contains_redacted_secret),
        _ => false,
    }
}

fn validate_config_texts(settings: &str, mcp: &str, models: &str) -> Result<(), String> {
    let settings_value: Value = serde_json::from_str(settings)
        .map_err(|e| format!("Invalid settings.json in bundle: {e}"))?;
    if !settings_value.is_object() {
        return Err("settings.json in bundle must contain an object".to_string());
    }
    let mcp_value: Value =
        serde_json::from_str(mcp).map_err(|e| format!("Invalid mcp.json in bundle: {e}"))?;
    if !mcp_value.get("mcpServers").is_some_and(Value::is_object) {
        return Err("mcp.json in bundle must contain an mcpServers object".to_string());
    }
    let models_value: Value = serde_json::from_str(models)
        .map_err(|e| format!("Invalid cockpit-models.json in bundle: {e}"))?;
    if !models_value.get("allModels").is_some_and(Value::is_array)
        || !models_value
            .get("shownModelIds")
            .is_some_and(Value::is_array)
        || !models_value.get("sortOrder").is_some_and(Value::is_array)
    {
        return Err("cockpit-models.json in bundle is missing required arrays".to_string());
    }
    Ok(())
}

fn config_texts_from_bundle(value: &Value) -> Result<(String, String, String), String> {
    if let Some(files) = value.get("files").and_then(Value::as_object) {
        let get_file = |name: &str| {
            files
                .get(name)
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| format!("Backup is missing string file {name}"))
        };
        return Ok((
            get_file("settings.json")?,
            get_file("mcp.json")?,
            get_file("cockpit-models.json")?,
        ));
    }

    let settings = value
        .get("settings")
        .filter(|item| item.is_object())
        .ok_or_else(|| "Import must contain an object field named settings".to_string())?;
    let mcp = value
        .get("mcpConfig")
        .filter(|item| item.is_object())
        .ok_or_else(|| "Import must contain an object field named mcpConfig".to_string())?;
    let models = value
        .get("cockpitModels")
        .filter(|item| item.is_object())
        .ok_or_else(|| "Import must contain an object field named cockpitModels".to_string())?;
    Ok((
        serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?,
        serde_json::to_string_pretty(mcp).map_err(|e| e.to_string())?,
        serde_json::to_string_pretty(models).map_err(|e| e.to_string())?,
    ))
}

fn transactional_write_config(files: &[(PathBuf, String)]) -> Result<(), String> {
    let originals = files
        .iter()
        .map(|(path, _)| {
            if path.exists() {
                fs::read(path).map(Some).map_err(|e| {
                    format!("Failed to preserve {} before restore: {e}", path.display())
                })
            } else {
                Ok(None)
            }
        })
        .collect::<Result<Vec<_>, String>>()?;

    for (index, (path, content)) in files.iter().enumerate() {
        if let Err(error) = fs_utils::atomic_write(path, content.as_bytes()) {
            let mut rollback_errors = Vec::new();
            for rollback_index in (0..=index).rev() {
                let rollback_path = &files[rollback_index].0;
                let result = match &originals[rollback_index] {
                    Some(original) => fs_utils::atomic_write(rollback_path, original),
                    None => {
                        if rollback_path.exists() {
                            fs::remove_file(rollback_path).map_err(|e| e.to_string())
                        } else {
                            Ok(())
                        }
                    }
                };
                if let Err(rollback_error) = result {
                    rollback_errors.push(format!("{}: {rollback_error}", rollback_path.display()));
                }
            }
            let rollback_note = if rollback_errors.is_empty() {
                "rollback completed".to_string()
            } else {
                format!("rollback errors: {}", rollback_errors.join("; "))
            };
            return Err(format!(
                "Failed to restore {}: {error}; {rollback_note}",
                path.display()
            ));
        }
    }
    Ok(())
}

fn apply_backup_bundle(value: &Value) -> Result<(), String> {
    if contains_redacted_secret(value) {
        return Err("Redacted exports are for review only and cannot be imported".to_string());
    }
    let (settings, mcp, models) = config_texts_from_bundle(value)?;
    validate_config_texts(&settings, &mcp, &models)?;
    transactional_write_config(&[
        (settings_path()?, settings),
        (mcp_path()?, mcp),
        (cockpit_models_path()?, models),
    ])
}

#[tauri::command]
fn create_backup() -> Result<String, String> {
    let _guard = lock_config_writes()?;
    write_backup_bundle()
}

#[tauri::command]
fn list_backups() -> Result<String, String> {
    let backup_dir = cockpit_backups_dir()?;
    if !backup_dir.exists() {
        return Ok("[]".to_string());
    }
    let mut backups: Vec<Value> = Vec::new();
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if is_backup_name(&name) {
                let mut b = serde_json::json!({"name": name.clone()});
                if let Ok(meta) = entry.metadata() {
                    if let Ok(mtime) = meta.modified() {
                        if let Ok(dur) = mtime.duration_since(UNIX_EPOCH) {
                            b["timestamp"] = serde_json::json!(dur.as_millis() as u64);
                        }
                    }
                    b["size"] = serde_json::json!(meta.len());
                }
                backups.push(b);
            }
        }
    }
    backups.sort_by(|a, b| {
        let a_t = a.get("timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_t = b.get("timestamp").and_then(|v| v.as_u64()).unwrap_or(0);
        b_t.cmp(&a_t)
    });
    serde_json::to_string(&backups).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
fn restore_backup(name: String) -> Result<(), String> {
    let _guard = lock_config_writes()?;
    if !is_backup_name(&name) {
        return Err("Invalid backup name".to_string());
    }
    let backup_dir = cockpit_backups_dir()?;
    let backup_path = backup_dir.join(&name);
    if !backup_path.exists() {
        return Err(format!("Backup {} not found", name));
    }
    let content =
        fs::read_to_string(&backup_path).map_err(|e| format!("Failed to read backup: {}", e))?;
    let value =
        serde_json::from_str::<Value>(&content).map_err(|e| format!("Invalid backup JSON: {e}"))?;
    write_backup_bundle()?;
    apply_backup_bundle(&value)
}

#[tauri::command]
fn import_backup_bundle(content: String) -> Result<(), String> {
    let _guard = lock_config_writes()?;
    if content.len() > 10 * 1024 * 1024 {
        return Err("Import file exceeds the 10 MB safety limit".to_string());
    }
    let value =
        serde_json::from_str::<Value>(&content).map_err(|e| format!("Invalid import JSON: {e}"))?;
    write_backup_bundle()?;
    apply_backup_bundle(&value)
}

#[tauri::command]
fn delete_backup(name: String) -> Result<(), String> {
    if !is_backup_name(&name) {
        return Err("Invalid backup name".to_string());
    }
    let backup_dir = cockpit_backups_dir()?;
    let backup_path = backup_dir.join(&name);
    if !backup_path.exists() {
        return Err(format!("Backup {} not found", name));
    }
    fs::remove_file(&backup_path).map_err(|e| format!("Failed to delete backup: {}", e))
}

// ============ Model connection test ============

fn resolve_api_key(api_key: &str) -> Result<String, String> {
    if let Some(name) = api_key
        .strip_prefix("${")
        .and_then(|value| value.strip_suffix('}'))
    {
        if name.is_empty()
            || !name.chars().enumerate().all(|(index, ch)| {
                ch == '_' || ch.is_ascii_uppercase() || (index > 0 && ch.is_ascii_digit())
            })
        {
            return Err("Invalid API key environment variable reference".to_string());
        }
        return Err(format!(
            "For security, Droid Cockpit does not read environment variable {name}. The reference can still be saved for Droid to resolve at runtime."
        ));
    }
    if api_key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    Ok(api_key.to_string())
}

fn is_forbidden_network(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let octets = ip.octets();
            ip.is_private()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_documentation()
                || ip.is_unspecified()
                || ip.is_multicast()
                || octets[0] == 0
                || (octets[0] == 100 && (64..=127).contains(&octets[1]))
                || (octets[0] == 198 && (octets[1] == 18 || octets[1] == 19))
        }
        IpAddr::V6(ip) => {
            if let Some(mapped) = ip.to_ipv4_mapped() {
                return is_forbidden_network(IpAddr::V4(mapped));
            }
            let segments = ip.segments();
            ip.is_unspecified()
                || ip.is_multicast()
                || (segments[0] & 0xfe00) == 0xfc00
                || (segments[0] & 0xffc0) == 0xfe80
                || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        }
    }
}

async fn secure_http_client(
    endpoint: &url::Url,
    timeout: Duration,
) -> Result<reqwest::Client, String> {
    let host = endpoint
        .host_str()
        .ok_or_else(|| "URL must include a host".to_string())?;
    let port = endpoint
        .port_or_known_default()
        .ok_or_else(|| "URL must include a valid port".to_string())?;
    let addresses = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| format!("Failed to resolve endpoint host: {e}"))?
        .collect::<Vec<SocketAddr>>();
    if addresses.is_empty() {
        return Err("Endpoint host did not resolve to an address".to_string());
    }
    let all_loopback = addresses.iter().all(|address| address.ip().is_loopback());
    if addresses
        .iter()
        .any(|address| !address.ip().is_loopback() && is_forbidden_network(address.ip()))
    {
        return Err(
            "Private, link-local, multicast, and metadata network targets are blocked".to_string(),
        );
    }
    if endpoint.scheme() == "http" && !all_loopback {
        return Err("Non-local endpoints must use HTTPS".to_string());
    }

    reqwest::Client::builder()
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::none())
        .resolve_to_addrs(host, &addresses)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))
}

fn provider_endpoint(base_url: &str, provider: &str, models: bool) -> Result<url::Url, String> {
    let base = base_url.trim().trim_end_matches('/');
    let lower = base.to_ascii_lowercase();
    let suffix = if models {
        if provider == "anthropic"
            && !lower.ends_with("/v1")
            && !lower.ends_with("/v3")
            && !lower.ends_with("/v4")
        {
            "/v1/models"
        } else {
            "/models"
        }
    } else {
        match provider {
            "anthropic" if lower.ends_with("/v1") => "/messages",
            "anthropic" => "/v1/messages",
            "openai" => "/responses",
            "generic-chat-completion-api" => "/chat/completions",
            _ => return Err("Unsupported provider".to_string()),
        }
    };
    let full = if lower.ends_with(suffix) {
        base.to_string()
    } else {
        format!("{base}{suffix}")
    };
    let parsed = url::Url::parse(&full).map_err(|e| format!("Invalid Base URL: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Base URL must use http or https".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Credentials are not allowed inside Base URL".to_string());
    }
    Ok(parsed)
}

fn apply_extra_headers(
    mut request: reqwest::RequestBuilder,
    extra_headers: Option<std::collections::HashMap<String, String>>,
) -> Result<reqwest::RequestBuilder, String> {
    if let Some(headers) = extra_headers {
        for (name, value) in headers {
            let header_name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
                .map_err(|_| format!("Invalid header name: {name}"))?;
            let header_value = reqwest::header::HeaderValue::from_str(&value)
                .map_err(|_| format!("Invalid value for header {name}"))?;
            request = request.header(header_name, header_value);
        }
    }
    Ok(request)
}

async fn response_preview(mut response: reqwest::Response) -> Result<(u16, String), String> {
    let status = response.status().as_u16();
    let mut bytes = Vec::with_capacity(MAX_RESPONSE_PREVIEW_BYTES);
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Failed to read provider response: {e}"))?
    {
        let remaining = MAX_RESPONSE_PREVIEW_BYTES.saturating_sub(bytes.len());
        if remaining == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
    }
    Ok((status, String::from_utf8_lossy(&bytes).to_string()))
}

#[tauri::command]
async fn test_model_connection(
    base_url: String,
    api_key: String,
    model: String,
    provider: String,
    extra_headers: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    let key = resolve_api_key(&api_key)?;
    let endpoint = provider_endpoint(&base_url, &provider, false)?;
    let client = secure_http_client(&endpoint, Duration::from_secs(20)).await?;

    let body = match provider.as_str() {
        "anthropic" => serde_json::json!({
            "model": model,
            "max_tokens": 16,
            "messages": [{"role": "user", "content": "Reply with OK."}]
        }),
        "openai" => serde_json::json!({
            "model": model,
            "input": "Reply with OK.",
            "max_output_tokens": 16
        }),
        "generic-chat-completion-api" => serde_json::json!({
            "model": model,
            "max_tokens": 16,
            "messages": [{"role": "user", "content": "Reply with OK."}]
        }),
        _ => return Err("Unsupported provider".to_string()),
    };

    let mut request = client.post(endpoint).json(&body);
    if provider == "anthropic" {
        request = request
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request = request.bearer_auth(key);
    }
    request = apply_extra_headers(request, extra_headers)?;
    let (http_code, body_resp) = response_preview(
        request
            .send()
            .await
            .map_err(|e| format!("Connection failed: {e}"))?,
    )
    .await?;
    let result = serde_json::json!({
        "httpCode": http_code.to_string(),
        "body": body_resp,
        "success": (200..300).contains(&http_code),
    });
    serde_json::to_string(&result).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
async fn fetch_provider_models(
    base_url: String,
    api_key: String,
    provider: String,
    extra_headers: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    let key = resolve_api_key(&api_key)?;
    let endpoint = provider_endpoint(&base_url, &provider, true)?;
    let client = secure_http_client(&endpoint, Duration::from_secs(15)).await?;
    let mut request = client.get(endpoint);
    if provider == "anthropic" {
        request = request
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01");
    } else {
        request = request.bearer_auth(key);
    }
    request = apply_extra_headers(request, extra_headers)?;
    let (status, body) = response_preview(
        request
            .send()
            .await
            .map_err(|e| format!("Model list request failed: {e}"))?,
    )
    .await?;
    if !(200..300).contains(&status) {
        return Err(format!("Provider returned HTTP {status}: {body}"));
    }
    let value: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Provider returned invalid model list JSON: {e}"))?;
    let data = value
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| value.get("models").and_then(Value::as_array));
    let models = data
        .into_iter()
        .flatten()
        .filter_map(|item| {
            item.get("id")
                .or_else(|| item.get("name"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .collect::<Vec<_>>();
    serde_json::to_string(&models).map_err(|e| format!("Serialize error: {e}"))
}

#[tauri::command]
async fn speedtest_endpoint(url: String) -> Result<u64, String> {
    let endpoint = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
    if endpoint.scheme() != "http" && endpoint.scheme() != "https" {
        return Err("URL must use http or https".to_string());
    }
    if !endpoint.username().is_empty() || endpoint.password().is_some() {
        return Err("Credentials are not allowed inside URL".to_string());
    }
    let client = secure_http_client(&endpoint, Duration::from_secs(10)).await?;
    let start = SystemTime::now();
    let response = client
        .head(endpoint)
        .send()
        .await
        .map_err(|e| format!("Speed test failed: {e}"))?;
    let elapsed = start.elapsed().map_err(|e| format!("Time error: {}", e))?;
    if !response.status().is_success() && !response.status().is_redirection() {
        return Err(format!("Endpoint returned HTTP {}", response.status()));
    }
    Ok(elapsed.as_millis() as u64)
}

// ============ List droids (custom subagents) ============

fn droid_path(name: &str) -> Result<PathBuf, String> {
    if !fs_utils::is_single_path_component(name)
        || name.starts_with('.')
        || name.is_empty()
        || !name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err(
            "Droid name may only contain letters, numbers, dots, underscores, and hyphens"
                .to_string(),
        );
    }
    Ok(factory_dir()?.join("droids").join(format!("{name}.md")))
}

fn frontmatter_value(content: &str, field: &str) -> Option<String> {
    let frontmatter = content.strip_prefix("---")?.split_once("---")?.0;
    let lines = frontmatter.lines().collect::<Vec<_>>();
    for (index, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(&format!("{field}:")) {
            let value = rest.trim();
            if matches!(value, ">" | ">-" | "|" | "|-") {
                return lines.get(index + 1).map(|next| next.trim().to_string());
            }
            return Some(value.trim_matches(['"', '\'']).to_string());
        }
    }
    None
}

#[tauri::command]
fn list_droids() -> Result<String, String> {
    let droids_dir = factory_dir()?.join("droids");
    if !droids_dir.exists() {
        return Ok("[]".to_string());
    }
    let mut droids: Vec<Value> = Vec::new();
    if let Ok(entries) = fs::read_dir(&droids_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_file()
                && !file_type.is_symlink()
                && path.extension().map(|e| e == "md").unwrap_or(false)
            {
                let name = path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mut droid = serde_json::json!({
                    "id": name.clone(),
                    "name": name.clone(),
                    "path": path.to_string_lossy(),
                });
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Some(value) = frontmatter_value(&content, "name") {
                        droid["name"] = Value::String(value);
                    }
                    if let Some(value) = frontmatter_value(&content, "description") {
                        droid["description"] = Value::String(value);
                    }
                    if let Some(value) = frontmatter_value(&content, "model") {
                        droid["model"] = Value::String(value);
                    }
                }
                if let Ok(metadata) = entry.metadata() {
                    droid["size"] = serde_json::json!(metadata.len());
                    if let Ok(modified) = metadata.modified().and_then(|time| {
                        time.duration_since(UNIX_EPOCH)
                            .map_err(std::io::Error::other)
                    }) {
                        droid["modifiedAt"] = serde_json::json!(modified.as_millis() as u64);
                    }
                }
                droids.push(droid);
            }
        }
    }
    droids.sort_by(|a, b| {
        a.get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .cmp(b.get("name").and_then(Value::as_str).unwrap_or_default())
    });
    serde_json::to_string(&droids).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
fn read_droid(name: String) -> Result<String, String> {
    let path = droid_path(&name)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read droid {name}: {e}"))
}

#[tauri::command]
fn write_droid(name: String, content: String) -> Result<(), String> {
    if content.len() > 1024 * 1024 {
        return Err("Droid file exceeds the 1 MB safety limit".to_string());
    }
    if !content.starts_with("---") || content[3..].find("---").is_none() {
        return Err("Droid file must start with YAML frontmatter delimited by ---".to_string());
    }
    if frontmatter_value(&content, "name").is_none()
        || frontmatter_value(&content, "description").is_none()
    {
        return Err("Droid frontmatter must include name and description".to_string());
    }
    let path = droid_path(&name)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create droids directory: {e}"))?;
    }
    atomic_write(&path, &content)
}

#[tauri::command]
fn delete_droid(name: String) -> Result<(), String> {
    let path = droid_path(&name)?;
    if !path.exists() {
        return Err(format!("Droid {name} not found"));
    }
    let trash = factory_dir()?.join("droid-cockpit").join("droid-trash");
    fs::create_dir_all(&trash).map_err(|e| format!("Failed to create droid trash: {e}"))?;
    fs::rename(
        &path,
        trash.join(format!("{}_{}.md", now_timestamp(), name)),
    )
    .map_err(|e| format!("Failed to move droid to trash: {e}"))
}

// ============ Specs listing ============

#[tauri::command]
fn list_specs() -> Result<String, String> {
    let specs_dir = factory_dir()?.join("specs");
    if !specs_dir.exists() {
        return Ok("[]".to_string());
    }
    let mut specs: Vec<Value> = Vec::new();
    if let Ok(entries) = fs::read_dir(&specs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_file()
                && !file_type.is_symlink()
                && path.extension().map(|e| e == "md").unwrap_or(false)
            {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let mut spec = serde_json::json!({
                    "id": name.clone(),
                    "name": name.clone(),
                    "path": path.to_string_lossy(),
                });
                if let Ok(meta) = entry.metadata() {
                    if let Ok(mtime) = meta.modified() {
                        if let Ok(dur) = mtime.duration_since(UNIX_EPOCH) {
                            spec["modifiedAt"] = serde_json::json!(dur.as_millis() as u64);
                        }
                    }
                    spec["size"] = serde_json::json!(meta.len());
                }
                specs.push(spec);
            }
        }
    }
    specs.sort_by(|a, b| {
        let a_t = a.get("modifiedAt").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_t = b.get("modifiedAt").and_then(|v| v.as_u64()).unwrap_or(0);
        b_t.cmp(&a_t)
    });
    serde_json::to_string(&specs).map_err(|e| format!("Failed to serialize: {}", e))
}

// ============ Usage stats (aggregate from session files) ============

#[tauri::command]
async fn get_usage_stats(force: Option<bool>) -> Result<String, String> {
    let factory = factory_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        session_index::usage_stats(&factory, force.unwrap_or(false))
    })
    .await
    .map_err(|e| format!("Usage index task failed: {e}"))?
}

#[allow(dead_code)]
fn get_usage_stats_legacy() -> Result<String, String> {
    let sessions_dir = factory_dir()?.join("sessions");
    let mut totals = serde_json::json!({
        "totalSessions": 0u64,
        "totalMessages": 0u64,
        "totalInputTokens": 0u64,
        "totalOutputTokens": 0u64,
        "totalCacheReadTokens": 0u64,
        "totalCacheCreationTokens": 0u64,
        "totalThinkingTokens": 0u64,
        "totalFactoryCredits": 0f64,
        "totalAssistantActiveMs": 0u64,
        "byModel": {},
        "byProject": {},
        "recentSessions": [],
    });

    if !sessions_dir.exists() {
        return serde_json::to_string(&totals).map_err(|e| format!("Serialize: {}", e));
    }

    let mut by_model: std::collections::HashMap<String, Value> = std::collections::HashMap::new();
    let mut by_project: std::collections::HashMap<String, Value> = std::collections::HashMap::new();
    let mut recent: Vec<Value> = Vec::new();

    if let Ok(dir_entries) = fs::read_dir(&sessions_dir) {
        for dir_entry in dir_entries.flatten() {
            let dir_path = dir_entry.path();
            if !dir_path.is_dir() {
                continue;
            }
            let project_dir = dir_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            if let Ok(file_entries) = fs::read_dir(&dir_path) {
                for file_entry in file_entries.flatten() {
                    let file_path = file_entry.path();
                    let fname = file_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    // Read .settings.json for token usage
                    if fname.ends_with(".settings.json") {
                        if let Ok(content) = fs::read_to_string(&file_path) {
                            if let Ok(meta) = serde_json::from_str::<Value>(&content) {
                                let session_id =
                                    fname.trim_end_matches(".settings.json").to_string();

                                // Extract tokenUsage
                                let token_usage = meta
                                    .get("tokenUsage")
                                    .or_else(|| meta.get("inclusiveTokenUsage"));
                                let input_tokens = token_usage
                                    .and_then(|t| t.get("inputTokens"))
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let output_tokens = token_usage
                                    .and_then(|t| t.get("outputTokens"))
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let cache_read = token_usage
                                    .and_then(|t| t.get("cacheReadTokens"))
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let cache_creation = token_usage
                                    .and_then(|t| t.get("cacheCreationTokens"))
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let thinking = token_usage
                                    .and_then(|t| t.get("thinkingTokens"))
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let credits = token_usage
                                    .and_then(|t| t.get("factoryCredits"))
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);
                                let active_ms = meta
                                    .get("assistantActiveTimeMs")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let model = meta
                                    .get("model")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("unknown")
                                    .to_string();

                                totals["totalSessions"] = serde_json::json!(
                                    totals["totalSessions"].as_u64().unwrap_or(0) + 1
                                );
                                totals["totalInputTokens"] = serde_json::json!(
                                    totals["totalInputTokens"].as_u64().unwrap_or(0) + input_tokens
                                );
                                totals["totalOutputTokens"] = serde_json::json!(
                                    totals["totalOutputTokens"].as_u64().unwrap_or(0)
                                        + output_tokens
                                );
                                totals["totalCacheReadTokens"] = serde_json::json!(
                                    totals["totalCacheReadTokens"].as_u64().unwrap_or(0)
                                        + cache_read
                                );
                                totals["totalCacheCreationTokens"] = serde_json::json!(
                                    totals["totalCacheCreationTokens"].as_u64().unwrap_or(0)
                                        + cache_creation
                                );
                                totals["totalThinkingTokens"] = serde_json::json!(
                                    totals["totalThinkingTokens"].as_u64().unwrap_or(0) + thinking
                                );
                                totals["totalFactoryCredits"] = serde_json::json!(
                                    totals["totalFactoryCredits"].as_f64().unwrap_or(0.0) + credits
                                );
                                totals["totalAssistantActiveMs"] = serde_json::json!(
                                    totals["totalAssistantActiveMs"].as_u64().unwrap_or(0)
                                        + active_ms
                                );

                                // By model
                                let m_entry = by_model.entry(model.clone()).or_insert_with(|| {
                                    serde_json::json!({
                                        "model": model.clone(),
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
                                m_entry["sessions"] = serde_json::json!(
                                    m_entry["sessions"].as_u64().unwrap_or(0) + 1
                                );
                                m_entry["inputTokens"] = serde_json::json!(
                                    m_entry["inputTokens"].as_u64().unwrap_or(0) + input_tokens
                                );
                                m_entry["outputTokens"] = serde_json::json!(
                                    m_entry["outputTokens"].as_u64().unwrap_or(0) + output_tokens
                                );
                                m_entry["cacheReadTokens"] = serde_json::json!(
                                    m_entry["cacheReadTokens"].as_u64().unwrap_or(0) + cache_read
                                );
                                m_entry["cacheCreationTokens"] = serde_json::json!(
                                    m_entry["cacheCreationTokens"].as_u64().unwrap_or(0)
                                        + cache_creation
                                );
                                m_entry["thinkingTokens"] = serde_json::json!(
                                    m_entry["thinkingTokens"].as_u64().unwrap_or(0) + thinking
                                );
                                m_entry["factoryCredits"] = serde_json::json!(
                                    m_entry["factoryCredits"].as_f64().unwrap_or(0.0) + credits
                                );
                                m_entry["assistantActiveMs"] = serde_json::json!(
                                    m_entry["assistantActiveMs"].as_u64().unwrap_or(0) + active_ms
                                );

                                // By project
                                let p_entry =
                                    by_project.entry(project_dir.clone()).or_insert_with(|| {
                                        serde_json::json!({
                                            "project": project_dir.clone(),
                                            "sessions": 0u64,
                                            "inputTokens": 0u64,
                                            "outputTokens": 0u64,
                                        })
                                    });
                                p_entry["sessions"] = serde_json::json!(
                                    p_entry["sessions"].as_u64().unwrap_or(0) + 1
                                );
                                p_entry["inputTokens"] = serde_json::json!(
                                    p_entry["inputTokens"].as_u64().unwrap_or(0) + input_tokens
                                );
                                p_entry["outputTokens"] = serde_json::json!(
                                    p_entry["outputTokens"].as_u64().unwrap_or(0) + output_tokens
                                );

                                // Get modification time
                                let mut mtime = 0u64;
                                if let Ok(fm) = fs::metadata(&file_path) {
                                    if let Ok(modified) = fm.modified() {
                                        if let Ok(dur) = modified.duration_since(UNIX_EPOCH) {
                                            mtime = dur.as_millis() as u64;
                                        }
                                    }
                                }

                                // For recent sessions, also try to get title from .jsonl
                                let jsonl_path = dir_path.join(format!("{}.jsonl", session_id));
                                let mut title = String::new();
                                let mut msg_count = 0u64;
                                if let Ok(jsonl_content) = fs::read_to_string(&jsonl_path) {
                                    if let Some(first_line) = jsonl_content.lines().next() {
                                        if let Ok(line_val) =
                                            serde_json::from_str::<Value>(first_line)
                                        {
                                            if let Some(t) =
                                                line_val.get("title").and_then(|v| v.as_str())
                                            {
                                                title = t.to_string();
                                            }
                                        }
                                    }
                                    msg_count = jsonl_content.lines().count() as u64;
                                }
                                totals["totalMessages"] = serde_json::json!(
                                    totals["totalMessages"].as_u64().unwrap_or(0) + msg_count
                                );

                                recent.push(serde_json::json!({
                                    "sessionId": session_id,
                                    "projectDir": project_dir,
                                    "title": title,
                                    "model": model,
                                    "inputTokens": input_tokens,
                                    "outputTokens": output_tokens,
                                    "cacheReadTokens": cache_read,
                                    "totalTokens": input_tokens + output_tokens + cache_read + cache_creation,
                                    "messageCount": msg_count,
                                    "lastActiveAt": mtime,
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort recent by lastActiveAt desc, take top 20
    recent.sort_by(|a, b| {
        let a_t = a.get("lastActiveAt").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_t = b.get("lastActiveAt").and_then(|v| v.as_u64()).unwrap_or(0);
        b_t.cmp(&a_t)
    });
    recent.truncate(20);

    // Convert by_model and by_project to sorted arrays
    let mut model_list: Vec<Value> = by_model.into_values().collect();
    model_list.sort_by(|a, b| {
        let a_t = a.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0)
            + a.get("outputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_t = b.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0)
            + b.get("outputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
        b_t.cmp(&a_t)
    });

    let mut project_list: Vec<Value> = by_project.into_values().collect();
    project_list.sort_by(|a, b| {
        let a_t = a.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
        let b_t = b.get("inputTokens").and_then(|v| v.as_u64()).unwrap_or(0);
        b_t.cmp(&a_t)
    });

    totals["byModel"] = Value::Array(model_list);
    totals["byProject"] = Value::Array(project_list);
    totals["recentSessions"] = Value::Array(recent);

    serde_json::to_string(&totals).map_err(|e| format!("Serialize: {}", e))
}

#[tauri::command]
async fn search_sessions(query: String) -> Result<String, String> {
    let query = query.trim();
    if query.chars().count() < 2 || query.chars().count() > 200 {
        return Err("Search query must contain 2 to 200 characters".to_string());
    }
    if query.starts_with('-') || query.chars().any(char::is_control) {
        return Err("Search query cannot start with '-' or contain control characters".to_string());
    }

    let mut command = background_command("droid");
    command.args([
        "search",
        query,
        "--kind",
        "all",
        "--limit-sessions",
        "50",
        "--limit-hits",
        "3",
        "--context-chars",
        "180",
        "--json",
    ]);
    let output = tokio::time::timeout(Duration::from_secs(30), command.output())
        .await
        .map_err(|_| "droid search timed out after 30 seconds".to_string())?
        .map_err(|e| format!("Failed to run droid search: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "droid search failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("droid search returned invalid UTF-8: {e}"))?;
    serde_json::from_str::<Value>(&stdout)
        .map_err(|e| format!("droid search returned invalid JSON: {e}"))?;
    Ok(stdout)
}

// ============ Main ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Settings
            read_settings,
            write_settings,
            get_settings_metadata,
            read_mcp_config,
            write_mcp_config,
            // Cockpit models
            read_cockpit_models,
            write_cockpit_models,
            // Droid version
            get_droid_version,
            // Sessions
            list_sessions,
            read_session_messages,
            delete_session,
            // Skills
            list_skills,
            uninstall_skill,
            // AGENTS.md
            read_agents_md,
            write_agents_md,
            get_agents_mtime,
            // Backups
            create_backup,
            list_backups,
            restore_backup,
            import_backup_bundle,
            delete_backup,
            // Model connection test
            test_model_connection,
            fetch_provider_models,
            speedtest_endpoint,
            // Droids
            list_droids,
            read_droid,
            write_droid,
            delete_droid,
            // Specs
            list_specs,
            // Usage stats
            get_usage_stats,
            search_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
