import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { RefreshCw, BarChart3, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getUsageStats, listSkills, listDroids, type UsageStats, type SkillInfo, type DroidInfo } from "../../utils/tauri";
import { useAppStore } from "../../stores/appStore";
import { CACHE_TTL } from "../../config/app";
import { TTLCache, formatTime, clamp } from "../../utils/helpers";

interface StatsData {
  usage: UsageStats | null;
  skills: SkillInfo[];
  droids: DroidInfo[];
  loadedAt: number;
}

const statsCache = new TTLCache<StatsData>(CACHE_TTL.LONG);

async function loadStatsData(force: boolean): Promise<StatsData> {
  return statsCache.get(async () => {
    const [usage, skillsRaw, droidsRaw] = await Promise.all([
      getUsageStats(force).catch(() => null),
      listSkills().catch(() => []),
      listDroids().catch(() => []),
    ]);
    return {
      usage,
      skills: skillsRaw,
      droids: droidsRaw,
      loadedAt: Date.now(),
    };
  }, force);
}

interface Badge {
  id: string;
  label: string;
  desc: string;
  earned: boolean;
}

interface MonthlyData {
  month: string;
  sessions: number;
  bar: string;
}

export function StatsCommand() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const result = await loadStatsData(force);
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // Compute all statistics
  const computed = useMemo(() => {
    if (!data?.usage) return null;
    const u = data.usage;

    // Top projects
    const topProjects = [...(u.byProject || [])]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5)
      .map((p) => ({
        name: p.project.replace(/^-/, "").replace(/-/g, " ").trim(),
        sessions: p.sessions,
        pct: u.totalSessions > 0 ? (p.sessions / u.totalSessions) * 100 : 0,
      }));

    // Model distribution
    const modelStats = [...(u.byModel || [])]
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5)
      .map((m) => ({
        name: m.model,
        sessions: m.sessions,
        pct: u.totalSessions > 0 ? (m.sessions / u.totalSessions) * 100 : 0,
      }));

    // Daily averages and streaks
    const dailyMap = new Map<string, number>();
    for (const d of u.daily || []) {
      dailyMap.set(d.date, d.sessions);
    }

    // Compute streak
    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate: string | null = null;
    const sortedDates = [...dailyMap.keys()].sort();
    for (const date of sortedDates) {
      if (prevDate) {
        const prev = new Date(prevDate);
        const curr = new Date(date);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) {
          currentStreak += 1;
        } else {
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      prevDate = date;
    }
    longestStreak = Math.max(longestStreak, currentStreak);

    // Peak day
    let peakDay = { date: "", sessions: 0 };
    for (const [date, sessions] of dailyMap) {
      if (sessions > peakDay.sessions) {
        peakDay = { date, sessions };
      }
    }

    // Max session duration
    const maxSessionMs = Math.max(
      ...(u.sessions || []).map((s) => s.assistantActiveMs || 0),
      0,
    );
    const maxSessionHours = maxSessionMs / 3600000;

    // Total active time
    const totalActiveMs = u.totalAssistantActiveMs || 0;
    const totalActiveDays = Math.floor(totalActiveMs / 86400000);
    const totalActiveHours = Math.floor((totalActiveMs % 86400000) / 3600000);

    // Days joined
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    let daysJoined = 0;
    if (firstDate && lastDate) {
      daysJoined = Math.round(
        (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000,
      );
    }

    // Daily average
    const totalDays = sortedDates.length || 1;
    const dailyAvg = (u.totalSessions / totalDays).toFixed(1);

    // Work style (weekday vs weekend)
    let weekdaySessions = 0;
    let weekendSessions = 0;
    for (const d of u.daily || []) {
      const day = new Date(d.date).getDay();
      if (day === 0 || day === 6) {
        weekendSessions += d.sessions;
      } else {
        weekdaySessions += d.sessions;
      }
    }
    const workStylePct = u.totalSessions > 0
      ? Math.round((weekdaySessions / u.totalSessions) * 100)
      : 0;

    // Favorite day of week
    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    for (const d of u.daily || []) {
      const day = new Date(d.date).getDay();
      dayCount[day] += d.sessions;
    }
    const favoriteDayIndex = dayCount.indexOf(Math.max(...dayCount));
    const favoriteDay = dayNames[favoriteDayIndex];

    // Activity type (night owl vs early bird)
    let nightSessions = 0;
    let daySessions = 0;
    for (const s of u.sessions || []) {
      if (s.lastActiveAt) {
        const hour = new Date(s.lastActiveAt).getHours();
        if (hour >= 22 || hour < 6) nightSessions++;
        else daySessions++;
      }
    }
    const activityType = nightSessions > daySessions ? "夜猫子" : "早鸟";

    // Monthly data
    const monthMap = new Map<string, number>();
    for (const d of u.daily || []) {
      const month = d.date.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + d.sessions);
    }
    const maxMonthSessions = Math.max(...monthMap.values(), 1);
    const monthly: MonthlyData[] = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, sessions]) => ({
        month,
        sessions,
        bar: "█".repeat(Math.max(1, Math.round((sessions / maxMonthSessions) * 30))),
      }));

    // Badges
    const soundEnabled = settings.completionSound && settings.completionSound !== "none";
    const badges: Badge[] = [
      { id: "super-user", label: "Super User", desc: "1000+ sessions", earned: u.totalSessions >= 1000 },
      { id: "streak-legend", label: "Streak Legend", desc: "30+ day streak", earned: longestStreak >= 30 },
      { id: "centurion", label: "Centurion", desc: "100+ hours total", earned: totalActiveMs / 3600000 >= 100 },
      { id: "code-is-life", label: "Code is Life", desc: "16+ hour session", earned: maxSessionHours >= 16 },
      { id: "the-dj", label: "The DJ", desc: "Sounds enabled", earned: !!soundEnabled },
      { id: "droid-builder", label: "Droid Builder", desc: "3+ custom droids", earned: data.droids.length >= 3 },
    ];

    // Data range
    const rangeStart = firstDate ? formatTime(new Date(firstDate).getTime()) : "—";
    const rangeEnd = lastDate ? formatTime(new Date(lastDate).getTime()) : "—";

    // Skill and droid usage counts are not present in the current session index.
    // Show deterministic local inventory instead of fabricated "usage" counts.
    const commonSkills = [...data.skills]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((s) => ({
      name: s.name,
      hint: s.source === "factory" ? "~/.factory" : s.source === "agents" ? "~/.agents" : "local",
    }));

    const commonDroids = [...data.droids]
      .sort((a, b) => {
        const aTime = a.modifiedAt || 0;
        const bTime = b.modifiedAt || 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      })
      .slice(0, 5)
      .map((d) => ({
      name: d.name,
      hint: d.model || "默认模型",
    }));

    return {
      topProjects,
      modelStats,
      longestStreak,
      peakDay,
      maxSessionHours,
      totalActiveMs,
      totalActiveDays,
      totalActiveHours,
      daysJoined,
      dailyAvg,
      workStylePct,
      favoriteDay,
      activityType,
      monthly,
      badges,
      rangeStart,
      rangeEnd,
      commonSkills,
      commonDroids,
      totalSessions: u.totalSessions,
      totalMessages: u.totalMessages,
    };
  }, [data, settings]);

  if (loading) {
    return (
      <div className="stats-command-loading">
        <div className="loading-cockpit" />
        <div className="stats-command-loading-text">{t("slash.stats.refreshing")}</div>
      </div>
    );
  }

  if (!data?.usage || !computed) {
    return (
      <div className="stats-command-empty">
        <BarChart3 size={48} className="text-faint" />
        <div className="stats-command-empty-text">{t("usage.noData")}</div>
        <div className="stats-command-empty-hint">{t("usage.noDataHint")}</div>
        <button className="btn-cockpit btn-cockpit-primary" onClick={() => load(true)}>
          <RefreshCw size={14} />
          {t("slash.stats.refresh")}
        </button>
      </div>
    );
  }

  const earnedBadges = computed.badges.filter((b) => b.earned);
  const barWidth = (pct: number) => clamp(pct, 0, 100);

  return (
    <div className="stats-command-container">
      {/* Header */}
      <div className="stats-command-header">
        <div className="stats-command-header-title">
          {t("slash.stats.title")}
        </div>
        <button
          className="btn-cockpit btn-cockpit-ghost"
          onClick={() => load(true)}
          title={t("slash.stats.refresh")}
        >
          <RefreshCw size={14} />
          {t("slash.stats.refresh")}
        </button>
      </div>

      <div className="stats-command-body">
        {/* Hot Projects */}
        <StatsSection title={t("slash.stats.hotProjects")}>
          <div className="stats-bar-list">
            {computed.topProjects.map((p, i) => (
              <div key={i} className="stats-bar-row">
                <span className="stats-bar-rank">{i + 1}.</span>
                <span className="stats-bar-label">{p.name}</span>
                <div className="stats-bar-track">
                  <div
                    className="stats-bar-fill"
                    style={{ width: `${barWidth(p.pct)}%` }}
                  />
                </div>
                <span className="stats-bar-value">{p.sessions} {t("slash.stats.sessions", { count: p.sessions })}</span>
              </div>
            ))}
          </div>
        </StatsSection>

        {/* Models */}
        <StatsSection title={t("slash.stats.models")}>
          <div className="stats-bar-list">
            {computed.modelStats.map((m, i) => (
              <div key={i} className="stats-bar-row">
                <span className="stats-bar-label">{m.name}</span>
                <div className="stats-bar-track">
                  <div
                    className="stats-bar-fill stats-bar-fill-accent"
                    style={{ width: `${barWidth(m.pct)}%` }}
                  />
                </div>
                <span className="stats-bar-value">{Math.round(m.pct)}%</span>
              </div>
            ))}
          </div>
        </StatsSection>

        {/* Your Style */}
        <StatsSection title={t("slash.stats.yourStyle")}>
          <div className="stats-keyvalue-grid">
            <StatsKeyValue label={t("slash.stats.activityType")} value={computed.activityType} />
            <StatsKeyValue label={t("slash.stats.favoriteDay")} value={computed.favoriteDay} />
            <StatsKeyValue label={t("slash.stats.dailyAvg")} value={computed.dailyAvg} />
            <StatsKeyValue label={t("slash.stats.workStyle")} value={`${computed.workStylePct}% ${t("slash.stats.workStyle")}`} />
            <StatsKeyValue
              label={t("slash.stats.peakDay")}
              value={`${computed.peakDay.date} ${computed.peakDay.sessions} ${t("slash.stats.sessions", { count: computed.peakDay.sessions })}`}
            />
            <StatsKeyValue
              label={t("slash.stats.maxSession")}
              value={computed.maxSessionHours > 0 ? `${computed.maxSessionHours.toFixed(1)} 小时` : "—"}
            />
          </div>
        </StatsSection>

        {/* Your Config */}
        <StatsSection title={t("slash.stats.yourConfig")}>
          <div className="stats-config-summary">
            <span>{data.skills.length} {t("slash.stats.skills")}</span>
            <span className="stats-config-sep">|</span>
            <span>{data.droids.length} {t("slash.stats.customDroids")}</span>
          </div>
          {computed.commonSkills.length > 0 && (
            <div className="stats-config-subsection">
              <div className="stats-config-subtitle">{t("slash.stats.commonSkills")}</div>
              <div className="stats-config-list">
                {computed.commonSkills.map((s, i) => (
                  <span key={i} className="stats-config-tag" title="当前索引未提供技能调用次数">
                    {s.name} <em>{s.hint}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
          {computed.commonDroids.length > 0 && (
            <div className="stats-config-subsection">
              <div className="stats-config-subtitle">{t("slash.stats.commonDroids")}</div>
              <div className="stats-config-list">
                {computed.commonDroids.map((d, i) => (
                  <span key={i} className="stats-config-tag" title="按最近修改时间展示">
                    {d.name} <em>{d.hint}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="stats-config-subsection">
            <span className="stats-config-sound">
              {t("slash.stats.sound")}: {settings.completionSound && settings.completionSound !== "none" ? t("slash.stats.soundOn") : t("slash.stats.soundOff")}
            </span>
          </div>
        </StatsSection>

        {/* Badges */}
        <StatsSection title={t("slash.stats.badges")}>
          <div className="stats-badge-list">
            {earnedBadges.map((badge) => (
              <div key={badge.id} className="stats-badge-item">
                <Star size={14} className="stats-badge-star" />
                <span className="stats-badge-label">{badge.label}</span>
                <span className="stats-badge-desc">- {badge.desc}</span>
              </div>
            ))}
          </div>
        </StatsSection>

        {/* Data Overview */}
        <StatsSection title={t("slash.stats.dataOverview")}>
          <div className="stats-keyvalue-grid">
            <StatsKeyValue label={t("slash.stats.totalSessions")} value={computed.totalSessions.toLocaleString()} />
            <StatsKeyValue label={t("slash.stats.totalMessages")} value={computed.totalMessages.toLocaleString()} />
            <StatsKeyValue
              label={t("slash.stats.timeWithDroid")}
              value={`${computed.totalActiveDays}天 ${computed.totalActiveHours}小时`}
            />
            <StatsKeyValue
              label={t("slash.stats.longestSession")}
              value={computed.maxSessionHours > 0 ? `${Math.floor(computed.maxSessionHours / 24)}天 ${Math.round(computed.maxSessionHours % 24)}小时` : "—"}
            />
            <StatsKeyValue label={t("slash.stats.daysJoined")} value={`${computed.daysJoined}天`} />
            <StatsKeyValue label={t("slash.stats.longestStreak")} value={`${computed.longestStreak}天`} />
          </div>
          <div className="stats-data-range">
            {t("slash.stats.dataRange")}: {computed.rangeStart} 至 {computed.rangeEnd}
            {statsCache.isFresh && <span className="stats-cached-badge">{t("slash.stats.cached")}</span>}
          </div>
        </StatsSection>

        {/* Monthly Breakdown */}
        <StatsSection title="FACTORY WRAPPED">
          <div className="stats-monthly-list">
            {computed.monthly.map((m) => (
              <div key={m.month} className="stats-monthly-row">
                <span className="stats-monthly-label">{m.month.slice(5)}月</span>
                <span className="stats-monthly-bar">{m.bar}</span>
                <span className="stats-monthly-value">{m.sessions} 个会话</span>
              </div>
            ))}
          </div>
          <div className="stats-monthly-legend">
            <span>少 </span>
            <span className="stats-monthly-legend-bar">████████████</span>
            <span> 多</span>
          </div>
          <div className="stats-monthly-summary">
            <div className="stats-monthly-summary-item">
              <div className="stats-monthly-summary-value">{(computed.totalSessions / 1000).toFixed(1)}K</div>
              <div className="stats-monthly-summary-label">{t("slash.stats.totalSessions")}</div>
            </div>
            <div className="stats-monthly-summary-item">
              <div className="stats-monthly-summary-value">{computed.totalActiveDays}d {computed.totalActiveHours}h</div>
              <div className="stats-monthly-summary-label">{t("slash.stats.timeWithDroid")}</div>
            </div>
            <div className="stats-monthly-summary-item">
              <div className="stats-monthly-summary-value">{computed.longestStreak}d</div>
              <div className="stats-monthly-summary-label">{t("slash.stats.longestStreak")}</div>
            </div>
            <div className="stats-monthly-summary-item">
              <div className="stats-monthly-summary-value">{computed.daysJoined}d</div>
              <div className="stats-monthly-summary-label">{t("slash.stats.daysJoined")}</div>
            </div>
          </div>
        </StatsSection>
      </div>
    </div>
  );
}

function StatsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stats-section">
      <div className="stats-section-title">{title}</div>
      <div className="stats-section-divider" />
      <div className="stats-section-content">{children}</div>
    </div>
  );
}

function StatsKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="stats-keyvalue-item">
      <span className="stats-keyvalue-label">{label}</span>
      <span className="stats-keyvalue-value">{value}</span>
    </div>
  );
}
