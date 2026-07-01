import { useEffect, useMemo, useState } from "react";
import {
  SLASH_COMMANDS,
  SLASH_CATEGORY_META,
  SLASH_COMMAND_COUNTS,
  OFFICIAL_SLASH_COMMAND_COUNT,
  RUNTIME_EXTRA_SLASH_COMMAND_COUNT,
  TOTAL_KNOWN_SLASH_COMMANDS,
  CONFIGURABLE_COMMANDS,
  MAPPED_COMMANDS,
  UNMAPPED_COMMANDS,
  ALL_CONFIGURABLE_FIELDS,
  COMPLETE_COMMANDS,
  PARTIAL_COMMANDS,
  REFERENCE_COMMANDS,
  EXTERNAL_COMMANDS,
  SLASH_SETTINGS_GROUPS,
  RECENT_CHANGELOG_IMPACTS,
  type SlashCommandCategory,
  type SlashCommandDef,
  type SlashCommandIntegration,
} from "../../config/slashCommands";
import { listSkills, type SkillInfo } from "../../utils/tauri";
import {
  Settings, History, User, BarChart3, Rocket, Wrench,
  Search, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Terminal, ArrowRight, Layers, ShieldCheck, DatabaseZap, FileJson2,
  PlugZap, CircleHelp, RefreshCw,
} from "lucide-react";

const categoryIcons: Record<SlashCommandCategory, React.ReactNode> = {
  settings: <Settings size={16} />,
  session: <History size={16} />,
  account: <User size={16} />,
  usage: <BarChart3 size={16} />,
  features: <Rocket size={16} />,
  utility: <Wrench size={16} />,
};

const integrationMeta: Record<SlashCommandIntegration, { label: string; className: string }> = {
  complete: { label: "已接入", className: "cockpit-badge-success" },
  partial: { label: "部分接入", className: "cockpit-badge-warning" },
  reference: { label: "参考入口", className: "cockpit-badge-ghost" },
  external: { label: "外部流程", className: "cockpit-badge-info" },
};

type ScopeFilter = "all" | "official" | "runtime" | "configurable" | "complete" | "partial" | "reference";

export function SlashCommandsSettings() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SlashCommandCategory | "all">("all");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [expandedCmd, setExpandedCmd] = useState<string | null>("settings");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsLoadedAt, setSkillsLoadedAt] = useState<number | null>(null);

  const loadSkills = async () => {
    const result = await listSkills().catch(() => []);
    setSkills(result);
    setSkillsLoadedAt(Date.now());
  };

  useEffect(() => {
    void loadSkills();
  }, []);

  const filteredCommands = useMemo(() => {
    return SLASH_COMMANDS.filter((cmd) => {
      const matchesCategory = activeCategory === "all" || cmd.category === activeCategory;
      const q = query.toLowerCase().replace(/^\//, "");
      const matchesQuery = !q ||
        cmd.command.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        (cmd.configures || []).some((c) => c.toLowerCase().includes(q)) ||
        (cmd.mappedTo || "").toLowerCase().includes(q);
      const matchesScope =
        scope === "all" ||
        (scope === "official" && cmd.source === "official") ||
        (scope === "runtime" && cmd.source === "runtime-extra") ||
        (scope === "configurable" && !!cmd.configures?.length) ||
        (scope === "complete" && cmd.integration === "complete") ||
        (scope === "partial" && cmd.integration === "partial") ||
        (scope === "reference" && (cmd.integration === "reference" || cmd.integration === "external"));
      return matchesCategory && matchesQuery && matchesScope;
    });
  }, [query, activeCategory, scope]);

  const categories: (SlashCommandCategory | "all")[] = ["all", "settings", "session", "account", "usage", "features", "utility"];
  const dynamicSkillCommands = skills.filter((skill) => skill.enabled !== false);

  return (
    <div className="page-container">
      <div className="page-inner" style={{ maxWidth: "66rem" }}>
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <Terminal size={20} style={{ color: "var(--color-primary)" }} />
              斜杠命令与设置映射
            </h2>
            <p className="text-sm text-muted mt-0.5">
              官方内置 {OFFICIAL_SLASH_COMMAND_COUNT} 个 · 本地追踪扩展 {RUNTIME_EXTRA_SLASH_COMMAND_COUNT} 个 · 本机动态技能命令 {dynamicSkillCommands.length} 个
            </p>
          </div>
          <button className="btn-cockpit btn-cockpit-outline" onClick={loadSkills} type="button">
            <RefreshCw size={14} />
            刷新技能
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <MetricCard icon={<Terminal size={18} />} label="官方 slash commands" value={OFFICIAL_SLASH_COMMAND_COUNT} tone="#0891b2" />
          <MetricCard icon={<Layers size={18} />} label="Cockpit 已知命令" value={TOTAL_KNOWN_SLASH_COMMANDS} tone="#4f46e5" />
          <MetricCard icon={<PlugZap size={18} />} label="可配置命令" value={CONFIGURABLE_COMMANDS.length} tone="#16a34a" />
          <MetricCard icon={<FileJson2 size={18} />} label="设置字段/目录" value={ALL_CONFIGURABLE_FIELDS.length} tone="#d97706" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-6">
          <StatusCard label="完整接入" value={COMPLETE_COMMANDS.length} badge="cockpit-badge-success" />
          <StatusCard label="部分接入" value={PARTIAL_COMMANDS.length} badge="cockpit-badge-warning" />
          <StatusCard label="参考/TUI 执行" value={REFERENCE_COMMANDS.length} badge="cockpit-badge-ghost" />
          <StatusCard label="外部浏览器/账户流程" value={EXTERNAL_COMMANDS.length} badge="cockpit-badge-info" />
        </div>

        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Settings size={16} style={{ color: "var(--color-primary)" }} />
            <h3 className="text-base font-semibold text-strong">/settings 深度映射</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {SLASH_SETTINGS_GROUPS.map((group) => {
              const meta = integrationMeta[group.status];
              return (
                <div key={group.id} className="cockpit-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-strong">{group.title}</div>
                      <div className="text-xs text-muted mt-1 leading-relaxed">{group.description}</div>
                    </div>
                    <span className={`cockpit-badge ${meta.className}`}>{meta.label}</span>
                  </div>
                  <div className="mt-3 text-xs text-faint">入口命令</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {group.commands.map((command) => (
                      <code key={command} className="font-mono-sm cockpit-badge cockpit-badge-ghost">/{command}</code>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-faint">Cockpit 配置面</div>
                  <div className="mt-1 text-xs text-strong">{group.cockpitSurface}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {group.fields.slice(0, 9).map((field) => (
                      <code key={field} className="text-[11px] font-mono-sm px-2 py-1 rounded" style={{ background: "var(--color-base-300)" }}>
                        {field}
                      </code>
                    ))}
                    {group.fields.length > 9 && (
                      <span className="cockpit-badge cockpit-badge-ghost">+{group.fields.length - 9}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <DatabaseZap size={16} style={{ color: "var(--color-warning)" }} />
            <h3 className="text-base font-semibold text-strong">最近版本影响</h3>
          </div>
          <div className="cockpit-card overflow-hidden">
            {RECENT_CHANGELOG_IMPACTS.map((item) => (
              <div key={`${item.version}-${item.area}`} className="settings-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-strong">{item.version}</span>
                    <span className="text-xs text-faint">{item.date}</span>
                    <span className="cockpit-badge cockpit-badge-ghost">{item.area}</span>
                  </div>
                  <div className="text-xs text-muted mt-1 leading-relaxed">{item.impact}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: "var(--color-success)" }} />
            <h3 className="text-base font-semibold text-strong">动态技能命令</h3>
          </div>
          <div className="cockpit-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-strong">
                  本机已发现 {dynamicSkillCommands.length} 个可用技能
                </div>
                <div className="text-xs text-muted mt-1">
                  官方文档说明技能可通过 <code className="font-mono-sm">/skill-name</code> 直接调用；数量来自当前机器的 <code className="font-mono-sm">~/.factory/skills</code> 与 <code className="font-mono-sm">~/.agents/skills</code>，不是固定内置命令数量。
                </div>
              </div>
              <span className="cockpit-badge cockpit-badge-primary">
                {skillsLoadedAt ? `刷新于 ${new Date(skillsLoadedAt).toLocaleTimeString()}` : "读取中"}
              </span>
            </div>
            {dynamicSkillCommands.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {dynamicSkillCommands.slice(0, 20).map((skill) => (
                  <span key={skill.id} className="cockpit-badge cockpit-badge-ghost" title={skill.path}>
                    /{skill.name}
                  </span>
                ))}
                {dynamicSkillCommands.length > 20 && (
                  <span className="cockpit-badge cockpit-badge-ghost">+{dynamicSkillCommands.length - 20}</span>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {categories.slice(1).map((cat) => {
            const meta = SLASH_CATEGORY_META[cat as SlashCommandCategory];
            const count = SLASH_COMMAND_COUNTS[cat as SlashCommandCategory];
            return (
              <button
                key={cat}
                className={`stat-card text-left ${activeCategory === cat ? "border-primary" : ""}`}
                style={{ padding: "0.75rem 1rem", ["--stat-accent" as string]: meta.color }}
                onClick={() => setActiveCategory(activeCategory === cat ? "all" : cat)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  {categoryIcons[cat as SlashCommandCategory]}
                  <div>
                    <div className="text-xs text-faint">{meta.label}</div>
                    <div className="text-lg font-bold text-strong">{count}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="cockpit-card p-3 mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                className="input-cockpit pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索命令名称、描述、配置项或 Cockpit 映射…"
              />
            </div>
            <select
              className="input-cockpit"
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as SlashCommandCategory | "all")}
            >
              <option value="all">全部分类 ({TOTAL_KNOWN_SLASH_COMMANDS})</option>
              {categories.slice(1).map((cat) => {
                const meta = SLASH_CATEGORY_META[cat as SlashCommandCategory];
                return (
                  <option key={cat} value={cat}>
                    {meta.label} ({SLASH_COMMAND_COUNTS[cat as SlashCommandCategory]})
                  </option>
                );
              })}
            </select>
            <select
              className="input-cockpit"
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeFilter)}
            >
              <option value="all">全部命令</option>
              <option value="official">官方内置</option>
              <option value="runtime">本地扩展</option>
              <option value="configurable">含配置项</option>
              <option value="complete">已接入</option>
              <option value="partial">部分接入</option>
              <option value="reference">参考/外部</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatusCard label="已映射到 Cockpit" value={MAPPED_COMMANDS.length} badge="cockpit-badge-success" />
          <StatusCard label="仍为 TUI/外部流程" value={UNMAPPED_COMMANDS.length} badge="cockpit-badge-warning" />
          <StatusCard label="配置字段总数" value={ALL_CONFIGURABLE_FIELDS.length} badge="cockpit-badge-primary" />
        </div>

        <div className="space-y-2">
          {filteredCommands.map((cmd) => (
            <SlashCommandRow
              key={`${cmd.source}:${cmd.command}`}
              cmd={cmd}
              expanded={expandedCmd === cmd.command}
              onToggle={() => setExpandedCmd(expandedCmd === cmd.command ? null : cmd.command)}
            />
          ))}
          {filteredCommands.length === 0 && (
            <div className="empty-state">
              <CircleHelp size={42} className="text-faint" />
              <div className="empty-state-title">没有匹配的命令</div>
              <div className="empty-state-desc">换一个分类、状态或关键词继续筛选。</div>
            </div>
          )}
        </div>

        <div className="cockpit-card p-4 mt-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-strong">
            <Settings size={16} style={{ color: "var(--color-primary)" }} />
            全部可配置字段与目录 ({ALL_CONFIGURABLE_FIELDS.length})
          </h3>
          <p className="text-xs text-muted mb-3">
            这些字段来自官方 `/settings`、相关 slash commands、skills/commands/plugins/MCP 文档和当前兼容字段。保存动作仍只在用户点击保存时写入。
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CONFIGURABLE_FIELDS.map((field) => (
              <code
                key={field}
                className="text-[11px] font-mono-sm px-2 py-1 rounded"
                style={{ background: "var(--color-base-300)", color: "var(--color-base-content)" }}
              >
                {field}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="stat-card" style={{ ["--stat-accent" as string]: tone }}>
      <div className="flex items-center gap-3">
        <div className="stat-icon-bg" style={{ background: `${tone}22`, color: tone }}>
          {icon}
        </div>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ fontSize: "1.45rem", marginTop: "0.1rem" }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, badge }: { label: string; value: number; badge: string }) {
  return (
    <div className="cockpit-card p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        <span className={`cockpit-badge ${badge}`}>{value}</span>
      </div>
    </div>
  );
}

function SlashCommandRow({
  cmd,
  expanded,
  onToggle,
}: {
  cmd: SlashCommandDef;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = SLASH_CATEGORY_META[cmd.category];
  const integration = integrationMeta[cmd.integration];
  const isOfficial = cmd.source === "official";

  return (
    <div className="cockpit-card overflow-hidden">
      <button
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-surface-hover transition-colors"
        onClick={onToggle}
        type="button"
      >
        <span className="flex-shrink-0" style={{ color: meta.color }}>
          {categoryIcons[cmd.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono-sm text-sm font-semibold text-strong">/{cmd.command}</code>
            {cmd.args && <span className="text-xs text-faint font-mono-sm">{cmd.args}</span>}
            {cmd.aliases?.map((alias) => (
              <span key={alias} className="cockpit-badge cockpit-badge-ghost text-[10px]">/{alias}</span>
            ))}
            <span className={`cockpit-badge ${integration.className} text-[10px]`}>
              {cmd.integration === "complete" ? <CheckCircle2 size={9} /> : <AlertCircle size={9} />}
              {integration.label}
            </span>
            {!isOfficial && <span className="cockpit-badge cockpit-badge-warning text-[10px]">非官方清单</span>}
          </div>
          <div className="text-xs text-muted mt-0.5 truncate">{cmd.description}</div>
        </div>
        {expanded ? (
          <ChevronDown size={16} className="text-faint flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-faint flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <InlineFact label="来源" value={isOfficial ? "Factory 官方内置" : "本地追踪扩展"} />
            <InlineFact label="运行逻辑" value={runModeLabel(cmd.runMode)} />
            <InlineFact label="分类" value={meta.label} />
          </div>
          {cmd.configures && cmd.configures.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-faint mb-1">配置项/目录</div>
              <div className="flex flex-wrap gap-1.5">
                {cmd.configures.map((field) => (
                  <code
                    key={field}
                    className="text-[11px] font-mono-sm px-2 py-1 rounded"
                    style={{ background: "var(--color-base-300)", color: "var(--color-base-content)" }}
                  >
                    {field}
                  </code>
                ))}
              </div>
            </div>
          )}
          {cmd.mappedTo && (
            <div className="flex items-center gap-2 text-xs">
              <ArrowRight size={12} className="text-faint" />
              <span className="text-faint">Cockpit 映射:</span>
              <span className="text-strong">{cmd.mappedTo}</span>
            </div>
          )}
          {cmd.cachePolicy && (
            <div className="text-xs text-muted">
              缓存策略：{cmd.cachePolicy}
            </div>
          )}
          {cmd.notes && (
            <div className="text-xs text-muted leading-relaxed">
              备注：{cmd.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: "var(--color-base-300)" }}>
      <div className="text-faint">{label}</div>
      <div className="text-strong mt-0.5">{value}</div>
    </div>
  );
}

function runModeLabel(mode: SlashCommandDef["runMode"]): string {
  switch (mode) {
    case "interactive-menu":
      return "TUI 子菜单";
    case "interactive-action":
      return "TUI 即时动作";
    case "browser":
      return "浏览器/账户流程";
    case "session-action":
      return "会话状态动作";
    case "workflow":
      return "工作流入口";
    case "reference-only":
      return "参考保留项";
    default:
      return mode;
  }
}
