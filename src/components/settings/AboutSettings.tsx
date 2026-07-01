import { useState, useEffect, useCallback } from "react";
import { getDroidVersion } from "../../utils/tauri";
import { checkDroidVersion, type VersionCheckResult } from "../../utils/versionCheck";
import { ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { APP_VERSION, DROID_SETTINGS_BASE_VERSION, GITHUB_RELEASES_URL } from "../../config/app";
import { useTranslation } from "react-i18next";
import brandIcon from "../../assets/generated/droid-cockpit-icon.png";

export function AboutSettings() {
  const { t } = useTranslation();
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [autoCheck, setAutoCheck] = useState(
    () => localStorage.getItem("droid-cockpit-auto-check") !== "false",
  );

  const fetchVersion = useCallback(async (force = false) => {
    setLoadingVersion(true);
    try {
      const result = await checkDroidVersion(force);
      setVersionInfo(result);
    } catch (e) {
      setVersionInfo({
        currentVersion: "未检测到",
        latestVersion: null,
        isUpToDate: false,
        hasUpdate: false,
        error: String(e),
        checkedAt: Date.now(),
      });
    } finally {
      setLoadingVersion(false);
    }
  }, []);

  useEffect(() => {
    // Silent auto-check on mount if enabled
    if (autoCheck) {
      fetchVersion();
    } else {
      // Still get local version
      getDroidVersion().then((v) => {
        setVersionInfo({
          currentVersion: v,
          latestVersion: null,
          isUpToDate: false,
          hasUpdate: false,
          error: null,
          checkedAt: Date.now(),
        });
      }).catch(() => {
        setVersionInfo({
          currentVersion: "未检测到",
          latestVersion: null,
          isUpToDate: false,
          hasUpdate: false,
          error: "Failed to detect",
          checkedAt: Date.now(),
        });
      });
    }
  }, [autoCheck, fetchVersion]);

  const toggleAutoCheck = (value: boolean) => {
    setAutoCheck(value);
    localStorage.setItem("droid-cockpit-auto-check", value ? "true" : "false");
  };

  const links = [
    { label: "Factory 官网", url: "https://factory.ai", desc: "Factory AI 主站" },
    { label: "Droid CLI 文档", url: "https://docs.factory.ai/cli/getting-started/overview", desc: "CLI 使用入门" },
    { label: "BYOK 配置文档", url: "https://docs.factory.ai/cli/byok/overview", desc: "自定义模型配置指南" },
    { label: "Settings 参考", url: "https://docs.factory.ai/cli/configuration/settings", desc: "完整 settings.json 字段说明" },
    { label: "可用模型列表", url: "https://docs.factory.ai/models", desc: "Factory 平台提供的模型" },
    { label: "Release Notes", url: "https://docs.factory.ai/changelog/release-notes", desc: "版本更新日志" },
    { label: "GitHub", url: GITHUB_RELEASES_URL, desc: "源码与发布版本" },
  ];

  return (
    <div className="page-container">
      <div style={{ maxWidth: "42rem" }}>
        {/* App info */}
        <div className="cockpit-card mb-6">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-16 h-16 flex items-center justify-center overflow-hidden"
                style={{ borderRadius: "8px", background: "#0a0b0d", boxShadow: "var(--shadow-md)" }}
              >
                <img src={brandIcon} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-strong">Droid Cockpit</h2>
                <p className="text-sm text-muted">
                  {t("app.tagline")}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="cockpit-badge cockpit-badge-primary">v{APP_VERSION}</span>
                  <span className="cockpit-badge cockpit-badge-ghost">
                    Droid {DROID_SETTINGS_BASE_VERSION}+
                  </span>
                </div>
              </div>
            </div>

            <div
              className="my-3"
              style={{ borderTop: "1px solid var(--color-border)" }}
            />

            {/* Version detection section */}
            <div className="space-y-3">
              {/* Droid CLI Version */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="settings-row-title">{t("settings.about.droidVersion")}</div>
                  <div className="settings-row-desc">{t("settings.about.droidVersionDesc")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {loadingVersion ? (
                    <div className="loading-cockpit" style={{ width: 20, height: 20 }} />
                  ) : versionInfo?.error ? (
                    <span className="flex items-center gap-1 text-sm" style={{ color: "#f87171" }}>
                      <AlertCircle size={16} /> {t("settings.about.versionError")}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm" style={{ color: "#34d399" }}>
                      <CheckCircle2 size={16} />
                      <span className="font-mono-sm">{versionInfo?.currentVersion}</span>
                    </span>
                  )}
                  <button
                    className="btn-icon"
                    onClick={() => fetchVersion(true)}
                    title={t("settings.about.checkUpdate")}
                  >
                    <RefreshCw size={14} className={loadingVersion ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Latest Version */}
              {versionInfo?.latestVersion && (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="settings-row-title">{t("settings.about.latestVersion")}</div>
                    <div className="settings-row-desc">{t("settings.about.latestVersionDesc")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {versionInfo.hasUpdate ? (
                      <span className="flex items-center gap-1 text-sm" style={{ color: "#f59e0b" }}>
                        <Sparkles size={16} />
                        <span className="font-mono-sm">{versionInfo.latestVersion}</span>
                      </span>
                    ) : versionInfo.isUpToDate ? (
                      <span className="flex items-center gap-1 text-sm" style={{ color: "#34d399" }}>
                        <CheckCircle2 size={16} />
                        {t("settings.about.upToDate")}
                      </span>
                    ) : (
                      <span className="font-mono-sm text-sm text-muted">
                        {versionInfo.latestVersion}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Update available notification */}
              {versionInfo?.hasUpdate && (
                <div className="alert-cockpit alert-cockpit-warning" style={{ padding: "0.75rem 1rem" }}>
                  <div className="flex items-start gap-2">
                    <Sparkles size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                    <div className="text-xs">
                      <div className="font-semibold mb-1">
                        {t("settings.about.updateAvailable")}
                      </div>
                      <div className="text-muted">
                        {t("settings.about.updateAvailableDesc", {
                          version: versionInfo.latestVersion,
                          current: versionInfo.currentVersion,
                        })}
                      </div>
                      <div className="mt-2">
                        <code
                          className="font-mono-sm px-2 py-1 rounded"
                          style={{ background: "var(--color-base-300)" }}
                        >
                          droid update
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-check toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="settings-row-title">{t("settings.about.autoCheck")}</div>
                  <div className="settings-row-desc">{t("settings.about.autoCheckDesc")}</div>
                </div>
                <label className="cockpit-toggle">
                  <input
                    type="checkbox"
                    checked={autoCheck}
                    onChange={(e) => toggleAutoCheck(e.target.checked)}
                  />
                  <span className="cockpit-toggle-slider" />
                </label>
              </div>

              {/* Cockpit Version */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="settings-row-title">{t("settings.about.cockpitVersion")}</div>
                  <div className="settings-row-desc">{t("settings.about.cockpitVersionDesc")}</div>
                </div>
                <span className="text-sm font-mono-sm text-muted">v{APP_VERSION}</span>
              </div>

              {/* OS */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="settings-row-title">{t("settings.about.os")}</div>
                  <div className="settings-row-desc">{t("settings.about.osDesc")}</div>
                </div>
                <span className="text-sm font-mono-sm text-muted">
                  {navigator.platform || "Unknown"}
                </span>
              </div>

              {/* Config path */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="settings-row-title">{t("settings.about.configPath")}</div>
                  <div className="settings-row-desc">{t("settings.about.configPathDesc")}</div>
                </div>
                <code
                  className="font-mono-sm px-2 py-1 rounded"
                  style={{ background: "var(--color-base-300)" }}
                >
                  ~/.factory/settings.json
                </code>
              </div>
            </div>

            <div className="alert-cockpit alert-cockpit-info mt-4" style={{ padding: "0.5rem 0.75rem" }}>
              <div className="text-xs">
                <b>{t("settings.about.upgradeHint")}</b>{" "}
                <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>droid update</code>
              </div>
            </div>
          </div>
        </div>

        {/* External links */}
        <div className="cockpit-card">
          <div className="p-4">
            <h3 className="font-semibold mb-3 text-strong">{t("settings.about.links")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-md transition-colors group"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-strong">{link.label}</div>
                    <div className="text-xs text-faint truncate">{link.desc}</div>
                  </div>
                  <ExternalLink size={14} className="text-faint flex-shrink-0 ml-2" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Project note */}
        <div className="cockpit-card mt-6">
          <div className="p-4">
            <h3 className="font-semibold mb-2 text-strong">
              {t("settings.about.openSource")}
            </h3>
            <p className="text-sm text-muted">
              {t("settings.about.openSourceDesc")}
            </p>
            <p className="text-center text-xs text-faint mt-4">
              {t("app.basedOn")} · {t("settings.about.techStack")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
