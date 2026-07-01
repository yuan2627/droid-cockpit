export type Page =
  | "dashboard"
  | "models"
  | "skills"
  | "droids"
  | "prompts"
  | "sessions"
  | "mcp"
  | "usage"
  | "settings";

export type SettingsTab = "general" | "droid-config" | "mission" | "usage" | "data" | "slash-commands" | "about";

export type ProviderType = "anthropic" | "openai" | "generic-chat-completion-api";

export interface CustomModel {
  model: string;
  id?: string;
  index?: number;
  baseUrl: string;
  apiKey: string;
  displayName?: string;
  provider: ProviderType;
  maxContextLimit?: number;
  enableThinking?: boolean;
  thinkingMaxTokens?: number;
  maxOutputTokens?: number;
  reasoningEffort?: string;
  baseModelId?: string;
  useInRouter?: boolean;
  noImageSupport?: boolean;
  extraArgs?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
  // App-private metadata (not written to settings.json, only to cockpit-models.json)
  tags?: string[];
  notes?: string;
  // Preserve future/undocumented Droid model fields from existing settings.json.
  [key: string]: unknown;
}

export interface SessionDefaultSettings {
  /** @deprecated Current Droid docs use top-level model. Kept for old settings files. */
  model?: string;
  /** @deprecated Current Droid docs use top-level reasoningEffort. */
  reasoningEffort?: string;
  interactionMode?: "auto" | "spec";
  autonomyLevel?: "off" | "low" | "medium" | "high";
  autonomyMode?: string;
  // Spec mode fields (optional, may not exist in real file but supported per docs)
  specModeModel?: string;
  specModeReasoningEffort?: string;
}

export interface MissionModelSettings {
  workerModel?: string;
  workerReasoningEffort?: string;
  validationWorkerModel?: string;
  validationWorkerReasoningEffort?: string;
  skipScrutiny?: boolean;
  skipUserTesting?: boolean;
}

export interface HooksConfig {
  hooksDisabled?: boolean;
  showHookOutput?: boolean;
}

export interface SubagentModelSettings {
  lightModel?: string;
  lightReasoningEffort?: string;
  mediumModel?: string;
  mediumReasoningEffort?: string;
  heavyModel?: string;
  heavyReasoningEffort?: string;
}

export interface StatusLineConfig {
  /** @deprecated Not listed in current public Factory settings; preserve only if read from old files. */
  type?: string;
  command?: string;
  padding?: number;
  maxRows?: number;
}

export interface DroidSettings {
  // Core
  model?: string;
  reasoningEffort?: string;
  cloudSessionSync?: boolean;
  diffMode?: "github" | "unified";
  completionSound?: string;
  awaitingInputSound?: string;
  soundFocusMode?: "always" | "focused" | "unfocused";
  enableCompletionBell?: boolean;
  subagentSounds?: "off" | "quiet" | "inherit";
  subagentInactivityTimeout?: number;
  commandAllowlist?: string[];
  commandDenylist?: string[];
  commandBlocklist?: string[];
  includeCoAuthoredByDroid?: boolean;
  enableDroidShield?: boolean;
  showThinkingInMainView?: boolean;
  showTokenUsageIndicator?: boolean;
  ideAutoConnect?: boolean;
  enableWarmup?: boolean;
  enableCustomDroids?: boolean;
  allowBackgroundProcesses?: boolean;
  enableReadinessReport?: boolean;
  toolResultDisplay?: "expanded" | "compact";
  logoAnimation?: "once" | "always" | "off";
  hideChangelog?: boolean;
  nerdFont?: boolean;
  locale?: string;
  todoDisplayMode?: string;
  // Theme
  theme?: string;
  overrideTerminalColors?: boolean;
  // Compression
  compactionTokenLimit?: number;
  compactionTokenLimitPerModel?: Record<string, number>;
  compactionModel?: string;
  /** @deprecated Public docs may still mention this; Droid 0.159.1 uses compactionModel. */
  compactionModelMode?: string;
  // Session defaults
  sessionDefaultSettings?: SessionDefaultSettings;
  // Mission
  missionModelSettings?: MissionModelSettings;
  missionOrchestratorModel?: string;
  missionOrchestratorReasoningEffort?: string;
  keepSystemAwakeDuringMissions?: boolean;
  subagentAutonomyLevel?: "inherit" | "off" | "low" | "medium" | "high";
  subagentModelSettings?: SubagentModelSettings;
  // Custom models (written to settings.json)
  customModels?: CustomModel[];
  // Hooks
  /** @deprecated Compatibility read only; current Droid stores this under hooks.hooksDisabled. */
  hooksDisabled?: boolean;
  hooks?: HooksConfig;
  // MCP global settings (per-server timeoutMs in mcp.json takes precedence)
  mcp?: {
    callTimeoutMs?: number;
    [key: string]: unknown;
  };
  // Status line
  statusLine?: StatusLineConfig;
  // Infrastructure
  worktreeDirectory?: string;
  specSaveDir?: string;
  llmRequestTimeout?: number;
  modelFavorites?: string[];
  modelFallbacks?: Record<string, string>;
  enabledPlugins?: Record<string, boolean>;
  // Onboarding (real field, read-only usually)
  hasSeenMissionOnboarding?: boolean;
  // Auto-update (org-level, from v0.148.0 changelog)
  disableAutoUpdate?: boolean;
  // Enterprise & org-level settings (typically managed by org admins)
  maxAutonomyLevel?: "off" | "low" | "medium" | "high";
  modelPolicy?: {
    allowedModelIds?: string[];
    blockedModelIds?: string[];
    allowCustomModels?: boolean;
    allowedBaseUrls?: string[];
  };
  mcpPolicy?: {
    enabled?: boolean;
    allowlist?: string[];
  };
  missionPolicy?: {
    restrictedAccess?: boolean;
    allowedUserIds?: string[];
  };
  networkPolicy?: {
    allowedIps?: string[];
  };
  sandbox?: {
    enabled?: boolean;
    mode?: string;
    filesystem?: Record<string, unknown>;
    network?: Record<string, unknown>;
  };
  restrictMemberVisibility?: boolean;
  restrictApiKeyCreationToManagers?: boolean;
  sessionRetentionDays?: number;
  wikiCloudSync?: boolean;
  managedComputersEnabled?: boolean;
  byomComputersEnabled?: boolean;
  // Allow arbitrary extra keys
  [key: string]: unknown;
}

export interface McpServerSpec {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface McpServer {
  id: string;
  name: string;
  server: McpServerSpec;
  description?: string;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerSpec>;
}

export interface ProviderPreset {
  id: string;
  name: string;
  icon: string;
  category: "official" | "plan" | "gateway" | "custom";
  model: string;
  baseUrl: string;
  provider: ProviderType;
  maxOutputTokens?: number;
  noImageSupport?: boolean;
  extraArgs?: Record<string, unknown>;
  description?: string;
  protocolNote?: string;
  endpointNote?: string;
  verificationNote?: string;
  verificationStatus?: "verified" | "partial" | "dynamic";
  maxOutputVerificationNote?: string;
  contextWindowVerificationNote?: string;
  billingNote?: string;
  referenceUrl?: string;
  protocols?: Array<{
    id?: string;
    provider: ProviderType;
    baseUrl: string;
    status: "recommended" | "available";
    label?: string;
    serviceLabel?: string;
    endpointNote?: string;
    note?: string;
    billingNote?: string;
    referenceUrl?: string;
  }>;
  models?: Array<{
    model: string;
    displayName: string;
    maxOutputTokens?: number;
    maxOutputVerified?: boolean;
    contextWindow?: number;
    contextWindowVerified?: boolean;
    stability?: "stable" | "preview" | "rolling" | "legacy";
  }>;
  apiKeyUrl?: string;
  websiteUrl?: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  path?: string;
  managed?: boolean;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
}

export interface SessionMeta {
  id: string;
  title?: string;
  model?: string;
  createdAt?: number;
  lastActiveAt?: number;
  projectDir?: string;
  messageCount?: number;
  fileSize?: number;
}

export interface Droid {
  id: string;
  name: string;
  description?: string;
  model?: string;
  path: string;
}

export interface Spec {
  id: string;
  name: string;
  path: string;
  modifiedAt: number;
  size: number;
}
