import { invoke } from "@tauri-apps/api/core";
import type { DroidSettings, McpConfig, CustomModel } from "../types";

function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function requireTauriRuntime(): void {
  if (!hasTauriRuntime()) {
    throw new Error("This action requires the Tauri desktop runtime");
  }
}

// ============ Settings ============

export async function readSettings(): Promise<DroidSettings> {
  if (!hasTauriRuntime()) return {};
  const raw = await invoke<string>("read_settings");
  return JSON.parse(raw);
}

export async function writeSettings(settings: DroidSettings): Promise<void> {
  if (!hasTauriRuntime()) return;
  await invoke("write_settings", { content: JSON.stringify(settings, null, 2) });
}

export interface SettingsFileMetadata {
  exists: boolean;
  modifiedMs: number;
  size: number;
}

export async function getSettingsMetadata(): Promise<SettingsFileMetadata> {
  if (!hasTauriRuntime()) return { exists: false, modifiedMs: 0, size: 0 };
  const raw = await invoke<string>("get_settings_metadata");
  return JSON.parse(raw);
}

// ============ MCP ============

export async function readMcpConfig(): Promise<McpConfig> {
  if (!hasTauriRuntime()) return { mcpServers: {} };
  const raw = await invoke<string>("read_mcp_config");
  return JSON.parse(raw);
}

export async function writeMcpConfig(config: McpConfig): Promise<void> {
  requireTauriRuntime();
  await invoke("write_mcp_config", { content: JSON.stringify(config, null, 2) });
}

// ============ Cockpit models (app-private persistence) ============

export interface CockpitModelsStore {
  allModels: CustomModel[];
  shownModelIds: string[];
  sortOrder: string[];
  version: number;
}

export async function readCockpitModels(): Promise<CockpitModelsStore> {
  if (!hasTauriRuntime()) {
    return { allModels: [], shownModelIds: [], sortOrder: [], version: 1 };
  }
  const raw = await invoke<string>("read_cockpit_models");
  try {
    const parsed = JSON.parse(raw);
    return {
      allModels: parsed.allModels || [],
      shownModelIds: parsed.shownModelIds || [],
      sortOrder: parsed.sortOrder || [],
      version: parsed.version || 1,
    };
  } catch {
    return { allModels: [], shownModelIds: [], sortOrder: [], version: 1 };
  }
}

export async function writeCockpitModels(store: CockpitModelsStore): Promise<void> {
  if (!hasTauriRuntime()) return;
  await invoke("write_cockpit_models", { content: JSON.stringify(store, null, 2) });
}

// ============ Droid version ============

export async function getDroidVersion(): Promise<string> {
  if (!hasTauriRuntime()) return "browser-preview";
  return invoke<string>("get_droid_version");
}

// ============ Sessions ============

export interface SessionInfo {
  id: string;
  title?: string;
  cwd?: string;
  projectDir?: string;
  fileName?: string;
  createdAt?: string;
  lastActiveAt?: number;
  messageCount?: number;
  fileSize?: number;
}

export async function listSessions(force = false): Promise<SessionInfo[]> {
  if (!hasTauriRuntime()) return [];
  const raw = await invoke<string>("list_sessions", { force });
  return JSON.parse(raw);
}

export interface SessionMessage {
  role: string;
  type: string;
  content: string;
}

export async function readSessionMessages(
  sessionId: string,
  projectDir: string,
  limit?: number,
): Promise<SessionMessage[]> {
  requireTauriRuntime();
  const raw = await invoke<string>("read_session_messages", {
    sessionId,
    projectDir,
    limit: limit ?? null,
  });
  return JSON.parse(raw);
}

export async function deleteSession(sessionId: string, projectDir: string): Promise<void> {
  requireTauriRuntime();
  await invoke("delete_session", { sessionId, projectDir });
}

// ============ Skills ============

export interface SkillInfo {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  path: string;
  managed: boolean;
  source?: string;
  version?: string;
}

export async function listSkills(): Promise<SkillInfo[]> {
  if (!hasTauriRuntime()) return [];
  const raw = await invoke<string>("list_skills");
  return JSON.parse(raw);
}

export async function uninstallSkill(name: string): Promise<void> {
  requireTauriRuntime();
  await invoke("uninstall_skill", { name });
}

// ============ AGENTS.md ============

export async function readAgentsMd(): Promise<string> {
  if (!hasTauriRuntime()) return "# AGENTS.md\n\nBrowser preview mode.\n";
  return invoke<string>("read_agents_md");
}

export async function writeAgentsMd(content: string): Promise<void> {
  requireTauriRuntime();
  await invoke("write_agents_md", { content });
}

export async function getAgentsMtime(): Promise<number> {
  if (!hasTauriRuntime()) return 0;
  return invoke<number>("get_agents_mtime");
}

// ============ Backups ============

export interface BackupInfo {
  name: string;
  timestamp: number;
  size: number;
}

export async function createBackup(): Promise<string> {
  requireTauriRuntime();
  return invoke<string>("create_backup");
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!hasTauriRuntime()) return [];
  const raw = await invoke<string>("list_backups");
  return JSON.parse(raw);
}

export async function restoreBackup(name: string): Promise<void> {
  requireTauriRuntime();
  await invoke("restore_backup", { name });
}

export async function importBackupBundle(content: string): Promise<void> {
  requireTauriRuntime();
  await invoke("import_backup_bundle", { content });
}

export async function deleteBackup(name: string): Promise<void> {
  requireTauriRuntime();
  await invoke("delete_backup", { name });
}

// ============ Model connection test ============

export interface ConnectionTestResult {
  httpCode: string;
  body: string;
  success: boolean;
}

export async function testModelConnection(
  baseUrl: string,
  apiKey: string,
  model: string,
  provider: string,
  extraHeaders?: Record<string, string>,
): Promise<ConnectionTestResult> {
  requireTauriRuntime();
  const raw = await invoke<string>("test_model_connection", {
    baseUrl,
    apiKey,
    model,
    provider,
    extraHeaders: extraHeaders ?? null,
  });
  return JSON.parse(raw);
}

export async function fetchProviderModels(
  baseUrl: string,
  apiKey: string,
  provider: string,
  extraHeaders?: Record<string, string>,
): Promise<string[]> {
  requireTauriRuntime();
  const raw = await invoke<string>("fetch_provider_models", {
    baseUrl,
    apiKey,
    provider,
    extraHeaders: extraHeaders ?? null,
  });
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export async function speedtestEndpoint(url: string): Promise<number> {
  requireTauriRuntime();
  return invoke<number>("speedtest_endpoint", { url });
}

// ============ Droids (custom subagents) ============

export interface DroidInfo {
  id: string;
  name: string;
  description?: string;
  model?: string;
  path: string;
  size?: number;
  modifiedAt?: number;
}

export async function listDroids(): Promise<DroidInfo[]> {
  if (!hasTauriRuntime()) return [];
  const raw = await invoke<string>("list_droids");
  return JSON.parse(raw);
}

export async function readDroid(name: string): Promise<string> {
  requireTauriRuntime();
  return invoke<string>("read_droid", { name });
}

export async function writeDroid(name: string, content: string): Promise<void> {
  requireTauriRuntime();
  await invoke("write_droid", { name, content });
}

export async function deleteDroid(name: string): Promise<void> {
  requireTauriRuntime();
  await invoke("delete_droid", { name });
}

// ============ Specs ============

export interface SpecInfo {
  id: string;
  name: string;
  path: string;
  modifiedAt: number;
  size: number;
}

export async function listSpecs(): Promise<SpecInfo[]> {
  if (!hasTauriRuntime()) return [];
  const raw = await invoke<string>("list_specs");
  return JSON.parse(raw);
}

// ============ Usage stats ============

export interface UsageStats {
  totalSessions: number;
  totalMessages: number;
  messageCountComplete: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalThinkingTokens: number;
  totalFactoryCredits: number;
  totalAssistantActiveMs: number;
  byModel: ModelUsage[];
  byProject: ProjectUsage[];
  daily: DailyUsage[];
  sessions?: SessionUsage[];
  recentSessions: RecentSessionUsage[];
  indexUpdatedAt: number;
}

export interface DailyUsage {
  date: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  thinkingTokens: number;
}

export interface ModelUsage {
  model: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  thinkingTokens: number;
  factoryCredits: number;
  assistantActiveMs: number;
}

export interface ProjectUsage {
  project: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RecentSessionUsage {
  sessionId: string;
  projectDir: string;
  title?: string;
  model?: string;
  date?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  messageCount?: number;
  lastActiveAt: number;
}

export interface SessionUsage extends RecentSessionUsage {
  cacheCreationTokens: number;
  thinkingTokens: number;
  factoryCredits: number;
  assistantActiveMs: number;
}

export async function getUsageStats(force = false): Promise<UsageStats> {
  if (!hasTauriRuntime()) {
    return {
      totalSessions: 0,
      totalMessages: 0,
      messageCountComplete: false,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalThinkingTokens: 0,
      totalFactoryCredits: 0,
      totalAssistantActiveMs: 0,
      byModel: [],
      byProject: [],
      daily: [],
      sessions: [],
      recentSessions: [],
      indexUpdatedAt: Date.now(),
    };
  }
  const raw = await invoke<string>("get_usage_stats", { force });
  return JSON.parse(raw);
}

export interface SessionSearchHit {
  docId: string;
  kind: "message_text" | "document" | "tool_use" | "tool_result";
  messageRole?: string;
  snippets: string[];
}

export interface SessionSearchResult {
  sessionId: string;
  title?: string;
  updatedAt?: number;
  jsonlPath?: string;
  hits: SessionSearchHit[];
}

export interface SessionSearchResponse {
  query: string;
  sessions: SessionSearchResult[];
}

export async function searchSessions(query: string): Promise<SessionSearchResponse> {
  if (!hasTauriRuntime()) return { query, sessions: [] };
  const raw = await invoke<string>("search_sessions", { query });
  return JSON.parse(raw);
}

// ============ Helpers ============

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.startsWith("${")) return key;
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export function getProviderLabel(provider: string): string {
  switch (provider) {
    case "anthropic": return "Anthropic";
    case "openai": return "OpenAI";
    case "generic-chat-completion-api": return "Chat Completions";
    default: return provider;
  }
}

export function getProviderColor(provider: string): string {
  switch (provider) {
    case "anthropic": return "badge-warning";
    case "openai": return "badge-success";
    case "generic-chat-completion-api": return "badge-info";
    default: return "badge-ghost";
  }
}

export function isEnvVarKey(key: string): boolean {
  return /^\$\{[A-Z_][A-Z0-9_]*\}$/.test(key);
}
