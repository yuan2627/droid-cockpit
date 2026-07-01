import {
  getEffectiveModel,
  getEffectiveReasoningEffort,
  useAppStore,
} from "../../stores/appStore";
import {
  Eye, Star, ArrowRight, Command,
} from "lucide-react";
import type { Page } from "../../types";
import { useTranslation } from "react-i18next";
import { APP_VERSION, DROID_SETTINGS_BASE_VERSION } from "../../config/app";
import cockpitSurface from "../../assets/generated/cockpit-surface.png";
import { PAGE_ICON_SRC } from "../../config/pageIcons";

export function Dashboard() {
  const { t } = useTranslation();
  const { allModels, shownModelIds, settings, setPage } = useAppStore();
  const defaultModelId = getEffectiveModel(settings);
  const defaultModel = allModels.find(
    (m) => (m.id || m.model) === defaultModelId,
  );

  const stats = [
    {
      label: t("dashboard.configuredModels"),
      value: String(allModels.length),
      sub: `${shownModelIds.length} ${t("dashboard.shownModels")}`,
      iconSrc: PAGE_ICON_SRC.models,
      iconClass: "stat-icon-primary",
      accent: "#10b981",
      page: "models" as Page,
    },
    {
      label: t("dashboard.defaultModel"),
      value: defaultModel?.displayName || defaultModelId || t("common.notSet"),
      sub: `${t("settings.droidConfig.reasoningEffort")}: ${getEffectiveReasoningEffort(settings) || t("common.default")}`,
      iconSrc: PAGE_ICON_SRC.dashboard,
      iconClass: "stat-icon-soft",
      accent: "#10b981",
      page: "models" as Page,
    },
    {
      label: t("dashboard.interactionMode"),
      value: settings.sessionDefaultSettings?.interactionMode === "spec" ? "Spec" : "Auto",
      sub: `${t("settings.droidConfig.autonomyLevel")}: ${settings.sessionDefaultSettings?.autonomyLevel || "off"}`,
      iconSrc: PAGE_ICON_SRC.settings,
      iconClass: "stat-icon-accent",
      accent: "#0891b2",
      page: "settings" as Page,
    },
    {
      label: t("dashboard.compactionLimit"),
      value: settings.compactionTokenLimit
        ? `${(settings.compactionTokenLimit / 1000).toFixed(0)}K`
        : t("common.default"),
      sub: `${Object.keys(settings.compactionTokenLimitPerModel || {}).length} ${t("settings.droidConfig.perModelLimits")}`,
      iconSrc: PAGE_ICON_SRC.usage,
      iconClass: "stat-icon-info",
      accent: "#d97706",
      page: "settings" as Page,
    },
  ];

  const quickNav: { label: string; desc: string; iconSrc: string; page: Page; tone: "primary" | "accent" }[] = [
    { label: t("nav.models"), desc: "模型、供应商与 BYOK", iconSrc: PAGE_ICON_SRC.models, page: "models", tone: "primary" },
    { label: t("nav.usage"), desc: "会话与 Token 统计", iconSrc: PAGE_ICON_SRC.usage, page: "usage", tone: "accent" },
    { label: t("nav.mcp"), desc: "工具服务器配置", iconSrc: PAGE_ICON_SRC.mcp, page: "mcp", tone: "primary" },
    { label: t("nav.droids"), desc: "自定义子代理", iconSrc: PAGE_ICON_SRC.droids, page: "droids", tone: "accent" },
    { label: t("nav.prompts"), desc: "全局提示词", iconSrc: PAGE_ICON_SRC.prompts, page: "prompts", tone: "accent" },
    { label: t("nav.skills"), desc: "技能与斜杠入口", iconSrc: PAGE_ICON_SRC.skills, page: "skills", tone: "primary" },
    { label: t("nav.sessions"), desc: "历史会话索引", iconSrc: PAGE_ICON_SRC.sessions, page: "sessions", tone: "accent" },
    { label: t("nav.settings"), desc: "Droid 细项设置", iconSrc: PAGE_ICON_SRC.settings, page: "settings", tone: "primary" },
  ];

  const toneStyles: Record<"primary" | "accent", { bg: string; color: string }> = {
    primary: { bg: "rgb(16 185 129 / 0.14)", color: "#10b981" },
    accent: { bg: "rgb(217 119 6 / 0.14)", color: "#d97706" },
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Welcome banner */}
        <div
          className="mb-6 p-5 rounded-2xl relative overflow-hidden cockpit-fade-in"
          style={{
            backgroundImage: `linear-gradient(90deg, rgb(12 13 14 / 0.86), rgb(12 13 14 / 0.52)), url(${cockpitSurface})`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            border: "1px solid var(--color-border-strong)",
          }}
        >
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-1 tracking-tight text-gradient-brand">
              {t("dashboard.welcome")}
            </h2>
            <p className="text-sm text-muted">
              {t("app.tagline")} · v{APP_VERSION} · Droid {DROID_SETTINGS_BASE_VERSION}+
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="btn-cockpit btn-cockpit-primary"
                onClick={() => {
                  // Trigger slash command bar via keyboard event
                  window.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "k",
                    ctrlKey: true,
                    bubbles: true,
                  }));
                }}
              >
                <Command size={14} />
                {t("slash.title")} /stats
              </button>
              <span className="text-xs text-faint">
                Ctrl+K
              </span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <button
              key={stat.label}
              className="stat-card text-left cursor-pointer"
              style={{ ["--stat-accent" as string]: stat.accent }}
              onClick={() => setPage(stat.page)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="stat-label">{stat.label}</div>
                  <div className="stat-value truncate" title={stat.value}>
                    {stat.value}
                  </div>
                  <div className="stat-sub truncate">{stat.sub}</div>
                </div>
                <div className={`stat-icon-bg ${stat.iconClass}`}>
                  <img src={stat.iconSrc} alt="" className="section-icon section-icon-stat" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick navigation cards */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-strong">{t("dashboard.quickNav")}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {quickNav.map((nav) => {
            const tone = toneStyles[nav.tone];
            return (
              <button
                key={nav.label}
                onClick={() => setPage(nav.page)}
                className="cockpit-card p-4 text-left group"
              >
                <div
                  className="section-icon-tile mb-3 transition-transform group-hover:scale-110"
                  style={{ background: tone.bg, color: tone.color }}
                >
                  <img src={nav.iconSrc} alt="" className="section-icon section-icon-quick" />
                </div>
                <div className="text-sm font-semibold mb-0.5 text-strong">{nav.label}</div>
                <div className="text-xs text-faint truncate">{nav.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Active models overview */}
        {shownModelIds.length > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight text-strong flex items-center gap-2">
                <Eye size={18} style={{ color: "#10b981" }} />
                {t("dashboard.shownModels")}
              </h3>
              <button
                className="btn-cockpit btn-cockpit-ghost text-xs"
                onClick={() => setPage("models")}
              >
                {t("common.view")} <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allModels
                .filter((m) => shownModelIds.includes(m.id || m.model))
                .slice(0, 6)
                .map((model) => {
                  const key = model.id || model.model;
                  const isDefault = key === defaultModelId;
                  const providerClass =
                    model.provider === "anthropic"
                      ? "provider-anthropic"
                      : model.provider === "openai"
                        ? "provider-openai"
                        : "provider-generic";
                  return (
                    <div key={key} className="cockpit-card p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm truncate text-strong">
                              {model.displayName || model.model}
                            </span>
                            {isDefault && (
                              <Star size={12} style={{ color: "#f59e0b" }} className="flex-shrink-0" fill="currentColor" />
                            )}
                          </div>
                          <div className="font-mono-sm text-faint truncate mt-0.5">
                            {model.model}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`cockpit-badge ${providerClass}`}>
                          {model.provider === "anthropic"
                            ? "Anthropic"
                            : model.provider === "openai"
                              ? "OpenAI"
                              : "Chat API"}
                        </span>
                        {model.maxOutputTokens && (
                          <span className="cockpit-badge cockpit-badge-ghost">
                            {(model.maxOutputTokens / 1000).toFixed(0)}K out
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
