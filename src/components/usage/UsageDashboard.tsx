import { useMemo, useState, useEffect } from "react";
import {
  getUsageStats,
  type DailyUsage,
  type SessionUsage,
  type UsageStats,
} from "../../utils/tauri";
import {
  Zap, MessageSquare, Clock, Database, Cpu, Activity,
  TrendingUp, Hash, RefreshCw, ArrowDownToLine, ArrowUpFromLine,
} from "lucide-react";

type TokenUnit = "m" | "b";

const USAGE_REFRESH_MS = 60_000;
let usageCache: UsageStats | null = null;
let usageCacheAt = 0;
let usageRequest: Promise<UsageStats> | null = null;

async function loadUsageStats(force = false): Promise<UsageStats> {
  if (!force && usageCache && Date.now() - usageCacheAt < USAGE_REFRESH_MS) {
    return usageCache;
  }
  if (!force && usageRequest) return usageRequest;
  usageRequest = getUsageStats(force)
    .then((value) => {
      usageCache = value;
      usageCacheAt = Date.now();
      return value;
    })
    .finally(() => {
      usageRequest = null;
    });
  return usageRequest;
}

function formatTokens(n: number, unit: TokenUnit = "m"): string {
  if (unit === "b" && n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatTime(ts: number): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN");
}

function localDateKey(ts: number): string {
  const date = new Date(ts);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function aggregateDaily(sessions: SessionUsage[]): DailyUsage[] {
  const map = new Map<string, DailyUsage>();
  for (const row of sessions) {
    const date = row.date || localDateKey(row.lastActiveAt);
    const item = map.get(date) || {
      date,
      sessions: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      thinkingTokens: 0,
    };
    item.sessions += 1;
    item.inputTokens += row.inputTokens;
    item.outputTokens += row.outputTokens;
    item.cacheReadTokens += row.cacheReadTokens;
    item.cacheCreationTokens += row.cacheCreationTokens;
    item.thinkingTokens += row.thinkingTokens;
    map.set(date, item);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function UsageDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(usageCache);
  const [loading, setLoading] = useState(!usageCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tokenUnit, setTokenUnit] = useState<TokenUnit>("m");

  const fetchStats = async (force = false, background = false) => {
    if (!usageCache) setLoading(true);
    else if (!background) setRefreshing(true);
    setError("");
    try {
      const s = await loadUsageStats(force);
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchStats(false, Boolean(usageCache));
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchStats(false, true);
    }, USAGE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const applyQuickRange = (days: number | null) => {
    if (days === null) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    setDateFrom(localDateKey(start.getTime()));
    setDateTo(localDateKey(end.getTime()));
  };

  const sessionRows = useMemo<SessionUsage[]>(() => {
    if (!stats) return [];
    if (stats.sessions?.length) return stats.sessions;
    return stats.recentSessions.map((row) => ({
      ...row,
      cacheCreationTokens: 0,
      thinkingTokens: 0,
      factoryCredits: 0,
      assistantActiveMs: 0,
    }));
  }, [stats]);

  const modelOptions = useMemo(
    () =>
      Array.from(new Set(sessionRows.map((row) => row.model || "unknown")))
        .filter(Boolean)
        .sort(),
    [sessionRows],
  );

  const projectOptions = useMemo(
    () =>
      Array.from(new Set(sessionRows.map((row) => row.projectDir || "unknown")))
        .filter(Boolean)
        .sort(),
    [sessionRows],
  );

  const filteredSessions = useMemo(
    () =>
      sessionRows.filter((row) => {
        const date = row.date || localDateKey(row.lastActiveAt);
        const matchesDateFrom = !dateFrom || date >= dateFrom;
        const matchesDateTo = !dateTo || date <= dateTo;
        const matchesModel = !modelFilter || (row.model || "unknown") === modelFilter;
        const matchesProject = !projectFilter || row.projectDir === projectFilter;
        return matchesDateFrom && matchesDateTo && matchesModel && matchesProject;
      }),
    [dateFrom, dateTo, modelFilter, projectFilter, sessionRows],
  );

  const filteredDaily = useMemo(() => aggregateDaily(filteredSessions), [filteredSessions]);

  const filteredTotals = useMemo(
    () =>
      filteredSessions.reduce(
        (acc, row) => {
          acc.sessions += 1;
          acc.messages += typeof row.messageCount === "number" ? row.messageCount : 0;
          acc.inputTokens += row.inputTokens;
          acc.outputTokens += row.outputTokens;
          acc.cacheReadTokens += row.cacheReadTokens;
          acc.cacheCreationTokens += row.cacheCreationTokens;
          acc.thinkingTokens += row.thinkingTokens;
          acc.factoryCredits += row.factoryCredits;
          acc.assistantActiveMs += row.assistantActiveMs;
          return acc;
        },
        {
          sessions: 0,
          messages: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          thinkingTokens: 0,
          factoryCredits: 0,
          assistantActiveMs: 0,
        },
      ),
    [filteredSessions],
  );

  const filteredByModel = useMemo(() => {
    const map = new Map<string, {
      model: string;
      sessions: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      thinkingTokens: number;
      factoryCredits: number;
      assistantActiveMs: number;
    }>();
    for (const row of filteredSessions) {
      const model = row.model || "unknown";
      const item = map.get(model) || {
        model,
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        thinkingTokens: 0,
        factoryCredits: 0,
        assistantActiveMs: 0,
      };
      item.sessions += 1;
      item.inputTokens += row.inputTokens;
      item.outputTokens += row.outputTokens;
      item.cacheReadTokens += row.cacheReadTokens;
      item.cacheCreationTokens += row.cacheCreationTokens;
      item.thinkingTokens += row.thinkingTokens;
      item.factoryCredits += row.factoryCredits;
      item.assistantActiveMs += row.assistantActiveMs;
      map.set(model, item);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
    );
  }, [filteredSessions]);

  const filteredByProject = useMemo(() => {
    const map = new Map<string, { project: string; sessions: number; inputTokens: number; outputTokens: number }>();
    for (const row of filteredSessions) {
      const project = row.projectDir || "unknown";
      const item = map.get(project) || { project, sessions: 0, inputTokens: 0, outputTokens: 0 };
      item.sessions += 1;
      item.inputTokens += row.inputTokens;
      item.outputTokens += row.outputTokens;
      map.set(project, item);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
    );
  }, [filteredSessions]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="loading-cockpit"></div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-6">
        <div className="alert-cockpit alert-cockpit-error">
          <span>加载失败: {error}</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const filtersActive = Boolean(modelFilter || projectFilter || dateFrom || dateTo);
  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const totalTokens = filteredTotals.inputTokens + filteredTotals.outputTokens;
  const chartDaily = dateFrom || dateTo ? filteredDaily : filteredDaily.slice(-14);
  const maxDailyTokens = Math.max(
    1,
    ...chartDaily.map((item) => item.inputTokens + item.outputTokens),
  );

  const statCards = [
    {
      label: filtersActive ? "筛选会话数" : "总会话数",
      value: String(filteredTotals.sessions),
      sub: stats.messageCountComplete ? `${filteredTotals.messages} 条消息` : "消息数未全量扫描",
      icon: <MessageSquare size={20} />,
      iconClass: "stat-icon-primary",
      accent: "#10b981",
    },
    {
      label: filtersActive ? "筛选 Token 用量" : "总 Token 用量",
      value: formatTokens(totalTokens),
      sub: `输入 ${formatTokens(filteredTotals.inputTokens)} · 输出 ${formatTokens(filteredTotals.outputTokens)}`,
      icon: <Zap size={20} />,
      iconClass: "stat-icon-info",
      accent: "#0891b2",
    },
    {
      label: "缓存命中 Token",
      value: formatTokens(filteredTotals.cacheReadTokens),
      sub: `缓存写入 ${formatTokens(filteredTotals.cacheCreationTokens)}`,
      icon: <Database size={20} />,
      iconClass: "stat-icon-accent",
      accent: "#d97706",
    },
    {
      label: "助手活跃时长",
      value: formatDuration(filteredTotals.assistantActiveMs),
      sub: `思考 ${formatTokens(filteredTotals.thinkingTokens)} tokens`,
      icon: <Clock size={20} />,
      iconClass: "stat-icon-soft",
      accent: "#9ca3af",
    },
  ];

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1 tracking-tight flex items-center gap-2 text-strong">
              <Activity size={22} style={{ color: "var(--color-primary)" }} /> 用量统计
            </h2>
            <p className="text-sm text-muted">
              基于会话 mtime 增量索引聚合；只有新增或变更会话会重新解析
            </p>
            <p className="text-xs text-faint mt-1">索引更新于 {new Date(stats.indexUpdatedAt).toLocaleString("zh-CN")}</p>
          </div>
          <button
            className="btn-cockpit btn-cockpit-ghost"
            disabled={loading || refreshing}
            onClick={() => fetchStats(true)}
          >
            <RefreshCw size={14} className={loading || refreshing ? "animate-spin" : ""} />
            {refreshing ? "刷新中" : "强制刷新"}
          </button>
        </div>

        <div className="cockpit-card mb-6">
          <div className="cockpit-card-header">
            <span className="cockpit-card-title">筛选</span>
            {filtersActive && (
              <button
                className="btn-cockpit btn-cockpit-ghost"
                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                onClick={() => {
                  setModelFilter("");
                  setProjectFilter("");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                清空
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4">
            <label className="text-xs text-muted">
              开始日期
              <input
                className="input-cockpit mt-1"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              结束日期
              <input
                className="input-cockpit mt-1"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              模型
              <select
                className="input-cockpit mt-1"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              >
                <option value="">全部模型</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              项目/文件夹
              <select
                className="input-cockpit mt-1"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">全部项目</option>
                {projectOptions.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
            <span className="text-xs text-faint mr-1">快捷日期</span>
            {[1, 7, 14, 30, 60, 90].map((days) => (
              <button
                key={days}
                className="btn-cockpit btn-cockpit-ghost"
                style={{ fontSize: "0.72rem", padding: "0.28rem 0.55rem" }}
                onClick={() => applyQuickRange(days)}
              >
                {days === 1 ? "今天" : `${days} 天`}
              </button>
            ))}
            <button
              className="btn-cockpit btn-cockpit-ghost"
              style={{ fontSize: "0.72rem", padding: "0.28rem 0.55rem" }}
              onClick={() => applyQuickRange(null)}
            >
              全部日期
            </button>
            <span className="text-xs text-faint ml-auto">自动后台增量刷新：60 秒</span>
          </div>
        </div>

        {dateRangeInvalid && (
          <div className="alert-cockpit alert-cockpit-error mb-4">
            <span>开始日期不能晚于结束日期，请调整日期范围。</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="stat-card"
              style={{ ["--stat-accent" as string]: stat.accent }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-sub truncate">{stat.sub}</div>
                </div>
                <div className={`stat-icon-bg ${stat.iconClass}`}>{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert-cockpit alert-cockpit-error mb-4">
            <span>刷新失败，继续显示上次索引：{error}</span>
          </div>
        )}

        <div className="cockpit-card mb-6">
          <div className="cockpit-card-header">
            <span className="cockpit-card-title flex items-center gap-2">
              <TrendingUp size={16} /> Token 趋势
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-faint">
                {dateFrom || dateTo ? "按筛选日期范围" : "最近 14 天"} · 1M = 100 万，1B = 10 亿 = 1000M
              </span>
              <select
                className="input-cockpit"
                style={{ width: "auto", minHeight: "1.8rem", padding: "0.2rem 1.6rem 0.2rem 0.5rem", fontSize: "0.72rem" }}
                value={tokenUnit}
                onChange={(event) => setTokenUnit(event.target.value as TokenUnit)}
                aria-label="Token 趋势单位"
              >
                <option value="m">M（默认）</option>
                <option value="b">B</option>
              </select>
            </div>
          </div>
          <div className="p-4">
            {chartDaily.length > 0 ? (
              <>
                <UsageLineChart data={chartDaily} maxTokens={maxDailyTokens} unit={tokenUnit} />
                <div className="flex justify-between text-xs text-faint mt-2">
                  <span>{chartDaily[0]?.date}</span>
                  <span>
                    峰值 {formatTokens(maxDailyTokens, tokenUnit)} · {chartDaily.length} 天 · 按会话最后活跃日期归档
                  </span>
                  <span>{chartDaily[chartDaily.length - 1]?.date}</span>
                </div>
              </>
            ) : (
              <div className="empty-state py-8">
                <TrendingUp size={24} className="empty-state-icon" />
                <div className="empty-state-title">暂无趋势数据</div>
                <div className="empty-state-description">
                  当前筛选范围内没有可绘制的 Token 记录；单位默认按 M 显示，可切换为 B 查看大规模用量。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Token breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Input vs Output */}
          <div className="cockpit-card">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title">Token 构成</span>
            </div>
            <div className="p-4 space-y-3">
              <TokenBar
                label="输入 Tokens"
                value={filteredTotals.inputTokens}
                total={totalTokens}
                color="#10b981"
                icon={<ArrowDownToLine size={14} />}
              />
              <TokenBar
                label="输出 Tokens"
                value={filteredTotals.outputTokens}
                total={totalTokens}
                color="#0891b2"
                icon={<ArrowUpFromLine size={14} />}
              />
              <TokenBar
                label="缓存读取"
                value={filteredTotals.cacheReadTokens}
                total={totalTokens + filteredTotals.cacheReadTokens}
                color="#10b981"
                icon={<Database size={14} />}
              />
              <TokenBar
                label="缓存写入"
                value={filteredTotals.cacheCreationTokens}
                total={totalTokens + filteredTotals.cacheCreationTokens}
                color="#d97706"
                icon={<Database size={14} />}
              />
              <TokenBar
                label="思考 Tokens"
                value={filteredTotals.thinkingTokens}
                total={totalTokens + filteredTotals.thinkingTokens}
                color="#f59e0b"
                icon={<Cpu size={14} />}
              />
            </div>
          </div>

          {/* Factory Credits */}
          <div className="cockpit-card">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title">Factory Credits（计量值）</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted">累计消耗</span>
                <span className="text-2xl font-bold text-strong">
                  {filteredTotals.factoryCredits.toFixed(4)}
                </span>
              </div>
              <div className="alert-cockpit alert-cockpit-info">
                <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  这不是用户数，也不能从本地会话字段直接换算成订阅份数或美元。Factory 官方尚未公布
                  <code className="mx-1">factoryCredits</code>
                  的固定汇率；Extra Usage 才是美元计价余额。实际余额请用 Droid 的
                  <code className="mx-1">/limits</code>
                  或查看{" "}
                  <a
                    href="https://docs.factory.ai/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Factory 定价与用量
                  </a>
                  。当前 Pro 方案是 20 美元/月，但不能据此反推本地 Credits 等于多少个 Pro 用户。
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* By model */}
        {filteredByModel.length > 0 && (
          <div className="cockpit-card mb-6">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title flex items-center gap-2">
                <Cpu size={16} /> 按模型统计
              </span>
              <span className="cockpit-badge cockpit-badge-ghost">{filteredByModel.length} 个模型</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-base-200)" }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">模型</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">会话数</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">输入</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">输出</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">缓存读</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">总 Token</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">活跃时长</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByModel.map((m, i) => {
                    const total = m.inputTokens + m.outputTokens;
                    return (
                      <tr
                        key={m.model}
                        style={i % 2 !== 0 ? { background: "rgb(16 185 129 / 0.03)" } : undefined}
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{m.model}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted">{m.sessions}</td>
                        <td className="px-4 py-2.5 text-right font-mono-sm text-muted">{formatTokens(m.inputTokens)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-sm text-muted">{formatTokens(m.outputTokens)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-sm text-muted">{formatTokens(m.cacheReadTokens)}</td>
                        <td className="px-4 py-2.5 text-right font-mono-sm font-semibold text-strong">{formatTokens(total)}</td>
                        <td className="px-4 py-2.5 text-right text-muted">{formatDuration(m.assistantActiveMs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent sessions */}
        {filteredSessions.length > 0 && (
          <div className="cockpit-card mb-6">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title flex items-center gap-2">
                <Hash size={16} /> 会话用量
              </span>
              <span className="cockpit-badge cockpit-badge-ghost">
                显示 {Math.min(filteredSessions.length, 100)} / {filteredSessions.length} 个
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--color-base-200)" }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">会话</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">模型</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">消息</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">输入</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">输出</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">总计</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs text-muted uppercase tracking-wider">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 100).map((s, i) => (
                    <tr
                      key={s.sessionId}
                      style={i % 2 !== 0 ? { background: "rgb(16 185 129 / 0.03)" } : undefined}
                    >
                      <td className="px-4 py-2.5 max-w-xs">
                        <div className="font-medium truncate" title={s.title}>
                          {s.title || s.sessionId.slice(0, 8)}
                        </div>
                        <div className="font-mono-sm text-faint truncate">{s.projectDir}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono-sm text-muted">{s.model}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted">{s.messageCount ?? "未计数"}</td>
                      <td className="px-4 py-2.5 text-right font-mono-sm text-muted">{formatTokens(s.inputTokens)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-sm text-muted">{formatTokens(s.outputTokens)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-sm font-semibold text-strong">{formatTokens(s.totalTokens)}</td>
                      <td className="px-4 py-2.5 text-right text-faint">{formatTime(s.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* By project */}
        {filteredByProject.length > 0 && (
          <div className="cockpit-card mb-6">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title">按项目统计</span>
              <span className="cockpit-badge cockpit-badge-ghost">{filteredByProject.length} 个项目</span>
            </div>
            <div className="p-4 space-y-2">
              {filteredByProject.slice(0, 10).map((p) => {
                const total = p.inputTokens + p.outputTokens;
                const maxTotal = Math.max(
                  ...filteredByProject.slice(0, 10).map((pp) => pp.inputTokens + pp.outputTokens),
                  1,
                );
                return (
                  <div key={p.project}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono-sm text-muted truncate flex-1 mr-2" title={p.project}>
                        {p.project}
                      </span>
                      <span className="text-muted">
                        {p.sessions} 会话 · {formatTokens(total)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-base-300)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(total / maxTotal) * 100}%`,
                          background: "linear-gradient(90deg, #10b981, #0891b2, #d97706)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredTotals.sessions === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Zap size={32} />
            </div>
            <div className="empty-state-title">{filtersActive ? "筛选范围内暂无用量数据" : "暂无用量数据"}</div>
            <div className="empty-state-desc">
              {filtersActive
                ? "请放宽日期、模型或项目筛选条件。"
                : "开始使用 Droid CLI 后，会话的 Token 用量将自动聚合到这里。"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UsageLineChart({
  data,
  maxTokens,
  unit,
}: {
  data: DailyUsage[];
  maxTokens: number;
  unit: TokenUnit;
}) {
  const width = 640;
  const height = 150;
  const pad = 14;
  const leftPad = 54;
  const points = data.map((item, index) => {
    const total = item.inputTokens + item.outputTokens;
    const x = data.length === 1
      ? width / 2
      : leftPad + (index / (data.length - 1)) * (width - leftPad - pad);
    const y = height - pad - (total / Math.max(1, maxTokens)) * (height - pad * 2);
    return { x, y, total, item };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length > 0
    ? `${leftPad},${height - pad} ${line} ${width - pad},${height - pad}`
    : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-40"
      role="img"
      aria-label="Token 用量折线趋势图"
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = height - pad - ratio * (height - pad * 2);
        return (
          <g key={ratio}>
            <line
              x1={leftPad}
              x2={width - pad}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
            <text
              x={leftPad - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--color-text-faint)"
              fontSize="10"
            >
              {formatTokens(maxTokens * ratio, unit)}
            </text>
          </g>
        );
      })}
      {area && (
        <polygon
          points={area}
          fill="url(#usageLineGradient)"
          opacity="0.22"
        />
      )}
      <defs>
        <linearGradient id="usageLineGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={line}
        fill="none"
        stroke="#0891b2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point) => (
        <circle
          key={point.item.date}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#0891b2"
        >
          <title>
            {point.item.date}: {formatTokens(point.total, unit)} tokens · {point.item.sessions} 个会话
          </title>
        </circle>
      ))}
    </svg>
  );
}

function TokenBar({
  label,
  value,
  total,
  color,
  icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ReactNode;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-muted">
          <span style={{ color }}>{icon}</span>
          {label}
        </span>
        <span className="font-mono-sm font-semibold text-strong">
          {formatTokens(value)}
          <span className="text-faint font-normal ml-1.5">({percent.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-base-300)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
