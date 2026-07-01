import { useAppStore } from "../../stores/appStore";
import type { Page } from "../../types";
import {
  PanelLeftClose, PanelLeftOpen, Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { APP_VERSION } from "../../config/app";
import { checkDroidVersion, type VersionCheckResult } from "../../utils/versionCheck";
import { useTranslation } from "react-i18next";
import brandIcon from "../../assets/generated/droid-cockpit-icon.png";
import { PAGE_ICON_SRC } from "../../config/pageIcons";

interface NavItem {
  id: Page;
  label: string;
  iconSrc: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function useNavGroups(): NavGroup[] {
  const { t } = useTranslation();
  return [
    {
      label: t("nav.groupOverview"),
      items: [
        { id: "dashboard", label: t("nav.dashboard"), iconSrc: PAGE_ICON_SRC.dashboard },
        { id: "usage", label: t("nav.usage"), iconSrc: PAGE_ICON_SRC.usage },
        { id: "sessions", label: t("nav.sessions"), iconSrc: PAGE_ICON_SRC.sessions },
      ],
    },
    {
      label: t("nav.groupConfig"),
      items: [
        { id: "models", label: t("nav.models"), iconSrc: PAGE_ICON_SRC.models },
        { id: "mcp", label: t("nav.mcp"), iconSrc: PAGE_ICON_SRC.mcp },
      ],
    },
    {
      label: t("nav.groupExtensions"),
      items: [
        { id: "droids", label: t("nav.droids"), iconSrc: PAGE_ICON_SRC.droids },
        { id: "skills", label: t("nav.skills"), iconSrc: PAGE_ICON_SRC.skills },
        { id: "prompts", label: t("nav.prompts"), iconSrc: PAGE_ICON_SRC.prompts },
      ],
    },
  ];
}

export function Sidebar() {
  const { currentPage, setPage } = useAppStore();
  const { t } = useTranslation();
  const navGroups = useNavGroups();
  const [expanded, setExpandedState] = useState(
    () => localStorage.getItem("droid-cockpit-sidebar") === "expanded",
  );
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);

  const setExpanded = (value: boolean) => {
    setExpandedState(value);
    localStorage.setItem("droid-cockpit-sidebar", value ? "expanded" : "collapsed");
  };

  // Silent version check on mount
  useEffect(() => {
    let active = true;
    checkDroidVersion().then((result) => {
      if (active) setVersionInfo(result);
    }).catch(() => {
      // Silent — never show errors for version check
    });
    return () => { active = false; };
  }, []);

  const allItems = navGroups.flatMap((g) => g.items);

  return (
    <>
      {/* Floating capsule sidebar */}
      <nav className={`side-nav-floating ${expanded ? "side-nav-expanded" : ""}`}>
        {/* Brand logo */}
        <div className="side-nav-brand">
          <div
            className="side-nav-brand-logo"
            onClick={() => setPage("dashboard")}
            title="Droid Cockpit"
          >
            <img src={brandIcon} alt="" className="side-nav-brand-img" />
          </div>
          {expanded && (
            <div className="side-nav-brand-text">
              <div className="side-nav-brand-name">Droid Cockpit</div>
              <div className="side-nav-brand-version">v{APP_VERSION}</div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="side-nav-divider" />

        {/* Nav items */}
        <div className="side-nav-items">
          {allItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                className={`side-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setPage(item.id)}
                title={expanded ? undefined : item.label}
              >
                <span className="side-nav-item-icon">
                  <img src={item.iconSrc} alt="" className="side-nav-section-icon" />
                </span>
                {expanded && <span className="side-nav-item-label">{item.label}</span>}
                {!expanded && <span className="side-nav-tooltip">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="side-nav-divider" />

        {/* Bottom actions */}
        <div className="side-nav-bottom">
          {/* Update indicator (silent, non-intrusive) */}
          {versionInfo?.hasUpdate && (
            <button
              className="side-nav-item side-nav-update-indicator"
              onClick={() => setPage("settings")}
              title={t("header.updateAvailable") + ": " + versionInfo.latestVersion}
            >
              <span className="side-nav-item-icon">
                <Sparkles size={20} />
              </span>
              {expanded && (
                <span className="side-nav-item-label side-nav-update-text">
                  {t("header.updateAvailable")}
                </span>
              )}
              {!expanded && (
                <span className="side-nav-tooltip">
                  {t("header.updateAvailable")}: {versionInfo.latestVersion}
                </span>
              )}
              <span className="side-nav-update-dot" />
            </button>
          )}

          {/* Settings */}
          <button
            className={`side-nav-item ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
            title={expanded ? undefined : t("nav.settings")}
          >
            <span className="side-nav-item-icon">
              <img src={PAGE_ICON_SRC.settings} alt="" className="side-nav-section-icon" />
            </span>
            {expanded && <span className="side-nav-item-label">{t("nav.settings")}</span>}
            {!expanded && <span className="side-nav-tooltip">{t("nav.settings")}</span>}
          </button>

          {/* Collapse/expand toggle */}
          <button
            className="side-nav-item side-nav-toggle"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? t("nav.collapse") : t("nav.expand")}
          >
            <span className="side-nav-item-icon">
              {expanded ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </span>
            {expanded && (
              <span className="side-nav-item-label">{expanded ? t("nav.collapse") : t("nav.expand")}</span>
            )}
            {!expanded && (
              <span className="side-nav-tooltip">{expanded ? t("nav.collapse") : t("nav.expand")}</span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
