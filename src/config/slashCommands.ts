// Droid CLI slash command catalog.
// Sources reviewed 2026-07-01:
// - https://docs.factory.ai/reference/cli-reference#slash-commands
// - https://docs.factory.ai/cli/configuration/settings
// - https://docs.factory.ai/cli/configuration/skills
// - https://docs.factory.ai/cli/configuration/custom-slash-commands
// - https://docs.factory.ai/cli/configuration/plugins

export type SlashCommandCategory =
  | "settings"
  | "session"
  | "account"
  | "usage"
  | "features"
  | "utility";

export type SlashCommandSource = "official" | "runtime-extra";
export type SlashCommandRunMode =
  | "interactive-menu"
  | "interactive-action"
  | "browser"
  | "session-action"
  | "workflow"
  | "reference-only";
export type SlashCommandIntegration = "complete" | "partial" | "reference" | "external";

export interface SlashCommandDef {
  command: string;
  description: string;
  category: SlashCommandCategory;
  source: SlashCommandSource;
  integration: SlashCommandIntegration;
  runMode: SlashCommandRunMode;
  aliases?: string[];
  args?: string;
  configures?: string[];
  hasSubMenu?: boolean;
  mappedTo?: string;
  notes?: string;
  cachePolicy?: string;
}

export interface SlashSettingsGroup {
  id: string;
  title: string;
  description: string;
  fields: string[];
  commands: string[];
  cockpitSurface: string;
  status: SlashCommandIntegration;
}

export interface ChangelogImpact {
  version: string;
  date: string;
  area: string;
  impact: string;
}

const official = (
  command: string,
  description: string,
  category: SlashCommandCategory,
  options: Omit<SlashCommandDef, "command" | "description" | "category" | "source">,
): SlashCommandDef => ({
  command,
  description,
  category,
  source: "official",
  ...options,
});

export const OFFICIAL_SLASH_COMMANDS: SlashCommandDef[] = [
  official("account", "在浏览器中打开 Factory 账户设置", "account", {
    runMode: "browser",
    integration: "external",
    mappedTo: "外部浏览器",
  }),
  official("billing", "查看和管理账单设置", "account", {
    runMode: "browser",
    integration: "external",
    mappedTo: "外部浏览器",
  }),
  official("btw", "提出旁路问题，不污染主会话上下文", "utility", {
    args: "<question>",
    runMode: "session-action",
    integration: "reference",
    notes: "属于 TUI 会话内动作；Cockpit 目前只展示参考，不直接改写会话。",
  }),
  official("bug", "创建包含会话数据和日志的 Bug 报告", "utility", {
    args: "[title]",
    runMode: "workflow",
    integration: "reference",
  }),
  official("clear", "开始一个新会话（/new 的别名）", "session", {
    aliases: ["new"],
    runMode: "session-action",
    integration: "partial",
    mappedTo: "会话管理页面",
  }),
  official("commands", "管理自定义 slash commands", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "partial",
    configures: ["~/.factory/commands/", "<repo>/.factory/commands/"],
    mappedTo: "设置 > 斜杠命令 > 自定义命令说明",
    notes: "官方建议新建能力优先使用 skills；commands 目录继续兼容。",
  }),
  official("compress", "压缩当前会话并用摘要开始新会话", "session", {
    args: "[prompt]",
    aliases: ["handoff", "compact"],
    runMode: "session-action",
    integration: "partial",
    configures: ["compactionTokenLimit", "compactionTokenLimitPerModel", "compactionModelMode", "compactionModel"],
    mappedTo: "设置 > Droid 配置 > 压缩与上下文",
  }),
  official("context", "显示上下文窗口使用情况和进度条", "usage", {
    runMode: "interactive-action",
    integration: "partial",
    configures: ["compactionTokenLimit", "compactionTokenLimitPerModel"],
    mappedTo: "用量统计页面",
    cachePolicy: "读取会话索引；长 TTL，手动刷新可强制重建",
  }),
  official("copy", "复制提示词、响应、消息范围或会话 ID", "session", {
    runMode: "interactive-action",
    integration: "reference",
  }),
  official("cost", "显示当前会话用量统计", "usage", {
    runMode: "interactive-action",
    integration: "partial",
    mappedTo: "用量统计页面",
    cachePolicy: "复用会话使用量索引",
  }),
  official("create-skill", "从当前会话创建可复用技能", "features", {
    runMode: "workflow",
    integration: "partial",
    configures: ["~/.factory/skills/", "<repo>/.factory/skills/"],
    mappedTo: "技能管理页面",
  }),
  official("cwd", "更改当前会话工作目录", "session", {
    args: "<path>",
    runMode: "session-action",
    integration: "reference",
    configures: ["worktreeDirectory"],
  }),
  official("diagnostics", "显示 settings.json 配置错误和诊断信息", "settings", {
    runMode: "interactive-action",
    integration: "partial",
    mappedTo: "设置 > 斜杠命令 > 诊断清单",
  }),
  official("droids", "管理自定义 Droid 子代理", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["enableCustomDroids", "~/.factory/droids/"],
    mappedTo: "Droid 管理页面",
  }),
  official("missions", "进入 Mission 模式（多代理编排）", "features", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "partial",
    configures: [
      "missionModelSettings.workerModel",
      "missionModelSettings.workerReasoningEffort",
      "missionModelSettings.validationWorkerModel",
      "missionModelSettings.validationWorkerReasoningEffort",
      "missionModelSettings.skipScrutiny",
      "missionModelSettings.skipUserTesting",
      "missionOrchestratorModel",
      "missionOrchestratorReasoningEffort",
      "keepSystemAwakeDuringMissions",
      "subagentModelSettings",
      "subagentAutonomyLevel",
    ],
    mappedTo: "设置 > Mission / 子代理",
  }),
  official("fast", "启用快速模式；用 /fast off 关闭", "settings", {
    args: "[off]",
    runMode: "interactive-action",
    integration: "complete",
    configures: ["reasoningEffort"],
    mappedTo: "设置 > Droid 配置 > 推理强度",
  }),
  official("favorite", "将当前会话标记为收藏", "session", {
    aliases: ["pin"],
    runMode: "session-action",
    integration: "partial",
    mappedTo: "会话管理页面",
  }),
  official("fork", "复制当前会话到新会话", "session", {
    runMode: "session-action",
    integration: "partial",
    mappedTo: "会话管理页面",
  }),
  official("help", "显示可用 slash commands", "utility", {
    runMode: "interactive-action",
    integration: "complete",
    mappedTo: "Ctrl+K 命令面板 / 设置 > 斜杠命令",
  }),
  official("hooks", "管理生命周期 Hooks", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "partial",
    configures: ["hooksDisabled", "hooks.hooksDisabled", "hooks.showHookOutput", "hooks.json"],
    mappedTo: "设置 > 常规 > Hooks",
  }),
  official("ide", "配置 IDE 集成", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "partial",
    configures: ["ideAutoConnect"],
    mappedTo: "设置 > 常规 > IDE 自动连接",
  }),
  official("install-code-review", "设置自动化代码审查", "features", {
    runMode: "workflow",
    integration: "reference",
    notes: "涉及 GitHub/GitLab 外部安装流程，Cockpit 仅列出入口。",
  }),
  official("install-slack-app", "安装或连接 Slack 集成", "features", {
    runMode: "workflow",
    integration: "reference",
  }),
  official("language", "切换 TUI 显示语言", "settings", {
    args: "<locale>",
    runMode: "interactive-action",
    integration: "complete",
    configures: ["locale"],
    mappedTo: "设置 > 常规 > 显示语言",
  }),
  official("limits", "管理 Token 限制和超额偏好", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["compactionTokenLimit", "compactionTokenLimitPerModel"],
    mappedTo: "设置 > Droid 配置 > 压缩限制",
  }),
  official("login", "登录 Factory 账户", "account", {
    runMode: "browser",
    integration: "external",
  }),
  official("logout", "退出 Factory 账户", "account", {
    runMode: "interactive-action",
    integration: "external",
  }),
  official("mcp", "管理 MCP 服务器", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["~/.factory/mcp.json", "mcp.callTimeoutMs", "mcpServers.*.timeoutMs"],
    mappedTo: "MCP 服务器页面",
  }),
  official("model", "切换当前会话模型", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["model", "customModels", "modelFavorites"],
    mappedTo: "模型页面 / 设置 > Droid 配置 > 默认模型",
  }),
  official("new", "开始新会话", "session", {
    aliases: ["clear"],
    runMode: "session-action",
    integration: "partial",
    mappedTo: "会话管理页面",
  }),
  official("plugins", "管理插件和市场", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "partial",
    configures: ["enabledPlugins", "~/.factory/plugins/", "<repo>/.factory/plugins/"],
    mappedTo: "设置 > 斜杠命令 > 插件说明",
  }),
  official("quit", "退出 Droid", "utility", {
    aliases: ["exit"],
    runMode: "interactive-action",
    integration: "reference",
  }),
  official("readiness-fix", "修复最新 readiness 报告中的失败信号", "utility", {
    runMode: "workflow",
    integration: "partial",
    configures: ["enableReadinessReport"],
    mappedTo: "设置 > 常规 > Readiness Report",
  }),
  official("readiness-report", "生成 agent readiness 报告", "utility", {
    runMode: "workflow",
    integration: "partial",
    configures: ["enableReadinessReport"],
    mappedTo: "设置 > 常规 > Readiness Report",
  }),
  official("rename", "重命名当前会话", "session", {
    runMode: "session-action",
    integration: "partial",
    mappedTo: "会话管理页面",
  }),
  official("review", "启动 AI 代码审查工作流", "features", {
    runMode: "workflow",
    integration: "reference",
  }),
  official("rewind-conversation", "回退会话并恢复文件到较早状态", "session", {
    runMode: "session-action",
    integration: "reference",
    notes: "v0.156.2 引入；对文件状态有影响，Cockpit 暂不直接执行。",
  }),
  official("sessions", "列出并选择历史会话", "session", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    mappedTo: "会话管理页面",
    cachePolicy: "会话索引 3 秒扫描防抖；前端长 TTL",
  }),
  official("settings", "配置模型、推理、声音、安全、界面等应用设置", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: [
      "model",
      "reasoningEffort",
      "sessionDefaultSettings.interactionMode",
      "sessionDefaultSettings.autonomyLevel",
      "sessionDefaultSettings.specModeModel",
      "sessionDefaultSettings.specModeReasoningEffort",
      "cloudSessionSync",
      "diffMode",
      "completionSound",
      "awaitingInputSound",
      "soundFocusMode",
      "commandAllowlist",
      "commandDenylist",
      "commandBlocklist",
      "includeCoAuthoredByDroid",
      "enableDroidShield",
      "hooksDisabled",
      "hooks.hooksDisabled",
      "ideAutoConnect",
      "showThinkingInMainView",
      "showTokenUsageIndicator",
      "toolResultDisplay",
      "logoAnimation",
      "theme",
      "overrideTerminalColors",
      "nerdFont",
      "subagentSounds",
      "missionModelSettings.*",
      "missionOrchestratorModel",
      "missionOrchestratorReasoningEffort",
      "keepSystemAwakeDuringMissions",
      "compactionTokenLimit",
      "compactionTokenLimitPerModel",
      "compactionModelMode",
      "specSaveDir",
      "statusLine",
      "worktreeDirectory",
      "llmRequestTimeout",
      "mcp.callTimeoutMs",
      "settings.local.json",
    ],
    mappedTo: "设置所有子页",
  }),
  official("setup-incident-response", "设置 Slack 事件响应频道自动运行", "features", {
    runMode: "workflow",
    integration: "reference",
  }),
  official("share", "与组织共享当前会话", "session", {
    runMode: "session-action",
    integration: "reference",
  }),
  official("skills", "管理和调用技能", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["~/.factory/skills/", "<repo>/.factory/skills/", "<repo>/.agent/skills/"],
    mappedTo: "技能管理页面",
    notes: "技能会生成动态 /skill-name；数量取决于本机安装和项目目录。",
  }),
  official("stats", "显示用量统计，支持相对时间段和日期范围", "usage", {
    args: "[period]",
    runMode: "interactive-action",
    integration: "complete",
    mappedTo: "Ctrl+K > /stats 弹窗 / 用量统计页面",
    cachePolicy: "30 分钟 TTL；刷新按钮强制重读会话索引",
  }),
  official("status", "显示当前 Droid 状态和配置概览", "settings", {
    runMode: "interactive-action",
    integration: "partial",
    mappedTo: "仪表盘",
  }),
  official("statusline", "配置自定义状态栏命令、内边距和最大行数", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["statusLine.command", "statusLine.padding", "statusLine.maxRows"],
    mappedTo: "设置 > Droid 配置 > 状态栏",
  }),
  official("terminal-setup", "配置终端 Shift+Enter 键位绑定", "utility", {
    runMode: "workflow",
    integration: "reference",
    notes: "覆盖 tmux、VS Code、Cursor、Windsurf、Windows Terminal、WezTerm 等终端场景。",
  }),
  official("themes", "选择 TUI 颜色主题", "settings", {
    hasSubMenu: true,
    runMode: "interactive-menu",
    integration: "complete",
    configures: ["theme", "overrideTerminalColors"],
    mappedTo: "设置 > 常规 > 主题",
  }),
];

export const RUNTIME_EXTRA_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: "loop",
    description: "按间隔重复提示直到停止（本地清单保留项，官方 CLI reference 未列出）",
    category: "utility",
    source: "runtime-extra",
    args: "<prompt>",
    runMode: "reference-only",
    integration: "reference",
    notes: "不计入官方 47 个内置命令；保留用于追踪当前运行版可能出现的扩展命令。",
  },
];

export const SLASH_COMMANDS: SlashCommandDef[] = [
  ...OFFICIAL_SLASH_COMMANDS,
  ...RUNTIME_EXTRA_SLASH_COMMANDS,
];

export const SLASH_CATEGORY_META: Record<SlashCommandCategory, { label: string; icon: string; color: string }> = {
  settings: { label: "配置", icon: "settings", color: "#0891b2" },
  session: { label: "会话", icon: "history", color: "#4f46e5" },
  account: { label: "账户", icon: "user", color: "#0f766e" },
  usage: { label: "统计", icon: "bar-chart", color: "#16a34a" },
  features: { label: "能力", icon: "rocket", color: "#d97706" },
  utility: { label: "工具", icon: "wrench", color: "#64748b" },
};

export const SLASH_SETTINGS_GROUPS: SlashSettingsGroup[] = [
  {
    id: "core-model",
    title: "模型与推理",
    description: "对应 /settings、/model、/fast，可配置默认模型、BYOK 模型、收藏模型和推理强度。",
    fields: ["model", "customModels", "modelFavorites", "reasoningEffort"],
    commands: ["settings", "model", "fast"],
    cockpitSurface: "模型页面 / 设置 > Droid 配置",
    status: "complete",
  },
  {
    id: "session-defaults",
    title: "会话默认值",
    description: "控制新会话的 Auto/Spec 模式、默认 autonomy、Spec 模型，以及 worktree 默认目录。",
    fields: [
      "sessionDefaultSettings.interactionMode",
      "sessionDefaultSettings.autonomyLevel",
      "sessionDefaultSettings.specModeModel",
      "sessionDefaultSettings.specModeReasoningEffort",
      "worktreeDirectory",
      "cloudSessionSync",
    ],
    commands: ["settings", "new", "clear", "cwd", "sessions"],
    cockpitSurface: "设置 > Droid 配置 / 会话页面",
    status: "partial",
  },
  {
    id: "display-ui",
    title: "显示、语言与终端体验",
    description: "覆盖主题、语言、diff、工具输出、思考块、token 指示器、Logo 动画和 Nerd Font。",
    fields: [
      "locale",
      "theme",
      "overrideTerminalColors",
      "diffMode",
      "toolResultDisplay",
      "showThinkingInMainView",
      "showTokenUsageIndicator",
      "logoAnimation",
      "nerdFont",
    ],
    commands: ["settings", "language", "themes", "terminal-setup", "statusline"],
    cockpitSurface: "设置 > 常规 / Droid 配置",
    status: "complete",
  },
  {
    id: "security-policy",
    title: "命令权限与安全策略",
    description: "allowlist 免确认、denylist 强制确认、blocklist 硬阻止；blocklist 优先级最高。",
    fields: [
      "commandAllowlist",
      "commandDenylist",
      "commandBlocklist",
      "includeCoAuthoredByDroid",
      "enableDroidShield",
      "allowBackgroundProcesses",
    ],
    commands: ["settings", "diagnostics"],
    cockpitSurface: "设置 > 常规 > 安全",
    status: "complete",
  },
  {
    id: "hooks-automation",
    title: "Hooks 与自动化",
    description: "集中展示 hooksDisabled、hook 输出、插件 hooks 和近期 hooks manager 变更。",
    fields: ["hooksDisabled", "hooks.hooksDisabled", "hooks.showHookOutput", "hooks.json"],
    commands: ["hooks", "settings"],
    cockpitSurface: "设置 > 常规 > Hooks / 斜杠命令参考",
    status: "partial",
  },
  {
    id: "missions-subagents",
    title: "Mission 与子代理",
    description: "把 worker、validator、orchestrator、subagent 声音和唤醒策略放在同一配置面。",
    fields: [
      "missionModelSettings.workerModel",
      "missionModelSettings.workerReasoningEffort",
      "missionModelSettings.validationWorkerModel",
      "missionModelSettings.validationWorkerReasoningEffort",
      "missionModelSettings.skipScrutiny",
      "missionModelSettings.skipUserTesting",
      "missionOrchestratorModel",
      "missionOrchestratorReasoningEffort",
      "keepSystemAwakeDuringMissions",
      "subagentSounds",
      "subagentModelSettings",
      "subagentAutonomyLevel",
    ],
    commands: ["missions", "droids", "settings"],
    cockpitSurface: "设置 > Mission / 子代理，Droid 管理页",
    status: "partial",
  },
  {
    id: "context-compaction",
    title: "上下文、压缩与用量",
    description: "连接 /context、/compress、/limits、/cost、/stats，与本地会话索引缓存共用。",
    fields: ["compactionTokenLimit", "compactionTokenLimitPerModel", "compactionModelMode", "compactionModel"],
    commands: ["context", "compress", "limits", "cost", "stats"],
    cockpitSurface: "设置 > Droid 配置 / 用量统计 / Ctrl+K > /stats",
    status: "complete",
  },
  {
    id: "extensions",
    title: "技能、命令、插件、MCP",
    description: "官方内置 /skills、/commands、/plugins、/mcp 互相关联；技能会额外生成动态 /skill-name。",
    fields: [
      "~/.factory/skills/",
      "<repo>/.factory/skills/",
      "<repo>/.agent/skills/",
      "~/.factory/commands/",
      "<repo>/.factory/commands/",
      "enabledPlugins",
      "~/.factory/mcp.json",
      "mcp.callTimeoutMs",
    ],
    commands: ["skills", "commands", "plugins", "mcp", "create-skill"],
    cockpitSurface: "技能页面 / MCP 页面 / 设置 > 斜杠命令",
    status: "partial",
  },
  {
    id: "local-overrides",
    title: "本地覆盖与项目级配置",
    description: "settings.local.json 可放在用户级或项目级 .factory 目录，适合机器私有配置并应加入 .gitignore。",
    fields: ["~/.factory/settings.local.json", "<repo>/.factory/settings.local.json", "settings.json hierarchy"],
    commands: ["settings", "diagnostics"],
    cockpitSurface: "设置 > 数据管理 / 斜杠命令参考",
    status: "reference",
  },
];

export const RECENT_CHANGELOG_IMPACTS: ChangelogImpact[] = [
  {
    version: "v0.161.0",
    date: "2026-06-29",
    area: "Hooks / Search",
    impact: "Hooks manager overhaul、WezTerm terminal setup、chat transcript search 和搜索缓存优化，影响 /hooks、/terminal-setup 与会话搜索体验。",
  },
  {
    version: "v0.159.0",
    date: "2026-06-25",
    area: "MCP / Projects",
    impact: "MCP auth 指引和配置解析错误更清晰，Cockpit 的 MCP 页面需要保留配置错误展示与手动刷新。",
  },
  {
    version: "v0.158.0",
    date: "2026-06-24",
    area: "Plugins / Slash Commands",
    impact: "插件可启停、slash command 支持 Tab 补全、Windows 后台进程清理修复，推动 /plugins 与命令面板映射。",
  },
  {
    version: "v0.156.2",
    date: "2026-06-22",
    area: "Sessions",
    impact: "新增 /rewind-conversation，可回退会话并恢复文件；Cockpit 只做参考入口，避免误触破坏文件状态。",
  },
  {
    version: "v0.152.0",
    date: "2026-06-18",
    area: "Autonomy / Governance",
    impact: "CLI 支持 --auto autonomy flag，组织可治理 MCP 和插件市场访问；设置页需要展示 autonomy 与组织策略字段。",
  },
  {
    version: "v0.151.0",
    date: "2026-06-17",
    area: "Skills",
    impact: "外部编辑器可使用 skill slash commands；技能数量应从本机目录动态读取，而非写死。",
  },
  {
    version: "v0.147.0",
    date: "2026-06-12",
    area: "Security",
    impact: "新增 commandBlocklist，优先级高于 allowlist/denylist，需要在安全设置中明确硬阻止语义。",
  },
];

export const SLASH_COMMAND_COUNTS: Record<SlashCommandCategory, number> = {
  settings: SLASH_COMMANDS.filter((c) => c.category === "settings").length,
  session: SLASH_COMMANDS.filter((c) => c.category === "session").length,
  account: SLASH_COMMANDS.filter((c) => c.category === "account").length,
  usage: SLASH_COMMANDS.filter((c) => c.category === "usage").length,
  features: SLASH_COMMANDS.filter((c) => c.category === "features").length,
  utility: SLASH_COMMANDS.filter((c) => c.category === "utility").length,
};

export const OFFICIAL_SLASH_COMMAND_COUNT = OFFICIAL_SLASH_COMMANDS.length;
export const RUNTIME_EXTRA_SLASH_COMMAND_COUNT = RUNTIME_EXTRA_SLASH_COMMANDS.length;
export const TOTAL_SLASH_COMMANDS = OFFICIAL_SLASH_COMMAND_COUNT;
export const TOTAL_KNOWN_SLASH_COMMANDS = SLASH_COMMANDS.length;

export const CONFIGURABLE_COMMANDS = SLASH_COMMANDS.filter((c) => c.configures && c.configures.length > 0);
export const MAPPED_COMMANDS = SLASH_COMMANDS.filter((c) => c.mappedTo);
export const UNMAPPED_COMMANDS = SLASH_COMMANDS.filter((c) => !c.mappedTo);
export const COMPLETE_COMMANDS = SLASH_COMMANDS.filter((c) => c.integration === "complete");
export const PARTIAL_COMMANDS = SLASH_COMMANDS.filter((c) => c.integration === "partial");
export const REFERENCE_COMMANDS = SLASH_COMMANDS.filter((c) => c.integration === "reference");
export const EXTERNAL_COMMANDS = SLASH_COMMANDS.filter((c) => c.integration === "external");

export const ALL_CONFIGURABLE_FIELDS = Array.from(
  new Set(SLASH_COMMANDS.flatMap((c) => c.configures || [])),
).sort();
