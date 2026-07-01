import { useMemo, useState } from "react";
import {
  getEffectiveModel,
  getEffectiveReasoningEffort,
  useAppStore,
} from "../../stores/appStore";
import { Activity, Cpu, Database, TrendingUp } from "lucide-react";

export function UsageSettings() {
  const { allModels, shownModelIds, settings } = useAppStore();
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "hidden">("all");

  const totalModels = allModels.length;
  const enabledCount = shownModelIds.length;
  const maxOutputModel = useMemo(
    () =>
      allModels
        .filter((model) => typeof model.maxOutputTokens === "number" && model.maxOutputTokens > 0)
        .sort((a, b) => (b.maxOutputTokens || 0) - (a.maxOutputTokens || 0))[0],
    [allModels],
  );
  const defaultModel = getEffectiveModel(settings);
  const providerOptions = useMemo(
    () => Array.from(new Set(allModels.map((m) => m.provider))).sort(),
    [allModels],
  );
  const filteredModels = useMemo(
    () =>
      allModels.filter((model) => {
        const key = model.id || model.model;
        const enabled = shownModelIds.includes(key);
        const text = `${model.displayName || ""} ${model.model} ${model.baseUrl || ""}`.toLowerCase();
        const matchesQuery = text.includes(query.trim().toLowerCase());
        const matchesProvider = !providerFilter || model.provider === providerFilter;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "enabled" && enabled) ||
          (statusFilter === "hidden" && !enabled);
        return matchesQuery && matchesProvider && matchesStatus;
      }),
    [allModels, providerFilter, query, shownModelIds, statusFilter],
  );

  const cards = [
    {
      title: "已配置模型",
      value: totalModels,
      sub: `${enabledCount} 个已启用`,
      icon: <Cpu size={20} />,
      iconClass: "stat-icon-primary",
      accent: "#10b981",
    },
    {
      title: "最高单模型输出",
      value: maxOutputModel?.maxOutputTokens
        ? `${(maxOutputModel.maxOutputTokens / 1000).toFixed(0)}K`
        : "模型默认",
      sub: maxOutputModel
        ? maxOutputModel.displayName || maxOutputModel.model
        : "未显式配置 maxOutputTokens",
      icon: <Activity size={20} />,
      iconClass: "stat-icon-accent",
      accent: "#0891b2",
    },
    {
      title: "默认模型",
      value: defaultModel || "产品默认",
      sub: `推理等级：${getEffectiveReasoningEffort(settings) || "模型默认"}`,
      icon: <TrendingUp size={20} />,
      iconClass: "stat-icon-soft",
      accent: "#d97706",
    },
    {
      title: "模型专属压缩",
      value: settings.compactionTokenLimit
        ? `${(settings.compactionTokenLimit / 1000).toFixed(0)}K`
        : "模型默认",
      sub: `${Object.keys(settings.compactionTokenLimitPerModel || {}).length} 个模型专属`,
      icon: <Database size={20} />,
      iconClass: "stat-icon-info",
      accent: "#64748b",
    },
  ];

  return (
    <div className="page-container">
      <div style={{ maxWidth: "48rem" }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1 text-strong">模型能力概览</h2>
          <p className="text-sm text-muted">
            这里展示的是模型配置能力，不是历史 Token 消耗。单个模型的
            <code className="font-mono-sm px-1 rounded mx-1" style={{ background: "var(--color-base-300)" }}>
              maxOutputTokens
            </code>
            只能按模型单独比较，不能把多个模型累加为“总输出”。历史用量请使用左侧主导航的“使用统计”页面。
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <div
              key={card.title}
              className="stat-card"
              style={{ ["--stat-accent" as string]: card.accent }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="stat-label">{card.title}</div>
                  <div className="stat-value">{card.value}</div>
                  <div className="stat-sub">{card.sub}</div>
                </div>
                <div className={`stat-icon-bg ${card.iconClass}`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Model breakdown table */}
        <div className="cockpit-card">
          <div className="cockpit-card-header">
            <span className="cockpit-card-title">模型输出能力对照</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              className="input-cockpit"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索模型、显示名或 Base URL"
            />
            <select
              className="input-cockpit"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="">全部协议</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            <select
              className="input-cockpit"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">全部状态</option>
              <option value="enabled">已写入 Droid</option>
              <option value="hidden">仅 Cockpit 管理</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--color-base-200)" }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">模型</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">协议</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">最大输出</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">图片</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-faint py-8">
                      没有符合条件的模型
                    </td>
                  </tr>
                ) : (
                  filteredModels.map((m, i) => {
                    const key = m.id || m.model;
                    const enabled = shownModelIds.includes(key);
                    return (
                      <tr
                        key={key}
                        style={{
                          opacity: enabled ? 1 : 0.5,
                          background: i % 2 !== 0 ? "rgb(16 185 129 / 0.03)" : undefined,
                        }}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-strong">{m.displayName || m.model}</div>
                          <div className="font-mono-sm text-faint">{m.model}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="cockpit-badge cockpit-badge-ghost">{m.provider}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted">
                          {m.maxOutputTokens
                            ? `${(m.maxOutputTokens / 1000).toFixed(0)}K`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {m.noImageSupport ? (
                            <span className="text-xs" style={{ color: "#f87171" }}>不支持</span>
                          ) : (
                            <span className="text-xs" style={{ color: "#34d399" }}>支持</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {enabled ? (
                            <span className="cockpit-badge cockpit-badge-success">启用</span>
                          ) : (
                            <span className="cockpit-badge cockpit-badge-ghost">隐藏</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="alert-cockpit alert-cockpit-info mt-6">
          <div>
            <b>提示：</b> 本页只解释本地模型能力配置。Factory 组织级趋势和消耗可通过
            <a
              href="https://docs.factory.ai/reference/analytics-api"
              target="_blank"
              rel="noreferrer"
              className="mx-1"
              style={{ color: "var(--color-primary)" }}
            >
              Analytics API
            </a>
            中查询。
          </div>
        </div>
      </div>
    </div>
  );
}
