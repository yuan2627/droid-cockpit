import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAppStore, ensureModelIds, getShownModels } from "./stores/appStore";
import {
  readSettings,
  readMcpConfig,
  readCockpitModels,
  getSettingsMetadata,
} from "./utils/tauri";
import { Sidebar } from "./components/layout/Sidebar";
import { Sun, Moon, Monitor, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { checkDroidVersion, type VersionCheckResult } from "./utils/versionCheck";
import { SlashCommandBar } from "./components/common/SlashCommandBar";
import cockpitSurface from "./assets/generated/cockpit-surface.png";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard").then((module) => ({ default: module.Dashboard })));
const ModelsPage = lazy(() => import("./components/models/ModelsPage").then((module) => ({ default: module.ModelsPage })));
const SkillsPage = lazy(() => import("./components/skills/SkillsPage").then((module) => ({ default: module.SkillsPage })));
const DroidsPage = lazy(() => import("./components/droids/DroidsPage").then((module) => ({ default: module.DroidsPage })));
const PromptsPage = lazy(() => import("./components/prompts/PromptsPage").then((module) => ({ default: module.PromptsPage })));
const SessionsPage = lazy(() => import("./components/sessions/SessionsPage").then((module) => ({ default: module.SessionsPage })));
const McpPage = lazy(() => import("./components/mcp/McpPage").then((module) => ({ default: module.McpPage })));
const UsageDashboard = lazy(() => import("./components/usage/UsageDashboard").then((module) => ({ default: module.UsageDashboard })));
const SettingsPage = lazy(() => import("./components/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function App() {
  const {
    currentPage,
    settings,
    setSettings,
    setMcpConfig,
    allModels,
    setAllModels,
    shownModelIds,
    setShownModelIds,
    sortOrder,
    setSortOrder,
    settingsLoaded,
    setSettingsLoaded,
    persistCockpitModels,
    cockpitModelsDirty,
    cockpitModelsSaveError,
    modelSettingsDirty,
    markModelSettingsPersisted,
    settingsSaveStatus,
    settingsSaveError,
    saveSettings,
    theme,
    setTheme,
  } = useAppStore();

  const initialized = useRef(false);
  const lastWrittenCustomModels = useRef<string>("");
  const lastSettingsFileVersion = useRef("");
  const usageVisited = useRef(false);
  const { t } = useTranslation();
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  if (currentPage === "usage") usageVisited.current = true;

  const metadataVersion = (metadata: { exists: boolean; modifiedMs: number; size: number }) =>
    `${metadata.exists ? 1 : 0}:${metadata.modifiedMs}:${metadata.size}`;

  // Sync theme attribute on mount (in case localStorage was set out-of-band)
  useEffect(() => {
    setTheme(theme);
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => setTheme("system");
    query.addEventListener("change", syncSystemTheme);
    return () => query.removeEventListener("change", syncSystemTheme);
  }, [theme, setTheme]);
  // Silent version check on startup — no popup, no error display
  useEffect(() => {
    let active = true;
    checkDroidVersion().then((result) => {
      if (active) setVersionInfo(result);
    }).catch(() => { /* Silent failure */ });
    return () => { active = false; };
  }, []);

  // Keyboard shortcut: Ctrl+K to open slash command bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSlashOpen(true);
      }
      if (e.key === 'Escape') setSlashOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  useEffect(() => {
    (async () => {
      let droidSettings;
      try {
        droidSettings = await readSettings();
        setSettings(droidSettings);
        const metadata = await getSettingsMetadata();
        lastSettingsFileVersion.current = metadataVersion(metadata);
      } catch (e) {
        console.error("Failed to load settings:", e);
        droidSettings = {};
      }

      try {
        const mcp = await readMcpConfig();
        setMcpConfig(mcp);
      } catch (e) {
        console.error("Failed to load mcp config:", e);
      }

      try {
        const cockpitStore = await readCockpitModels();
        if (cockpitStore.allModels.length > 0) {
          const storedModels = ensureModelIds(cockpitStore.allModels);
          const liveModels = ensureModelIds(droidSettings.customModels || []);
          const liveById = new Map(liveModels.map((model) => [model.id!, model]));
          const storedIds = new Set(storedModels.map((model) => model.id!));
          const models = ensureModelIds([
            ...storedModels.map((model) => {
              const live = liveById.get(model.id!);
              return live ? { ...model, ...live, tags: model.tags, notes: model.notes } : model;
            }),
            ...liveModels.filter((model) => !storedIds.has(model.id!)),
          ]);
          const validIds = new Set(models.map((model) => model.id!));
          const shown = liveModels.map((model) => model.id!).filter((id) => validIds.has(id));
          const order = cockpitStore.sortOrder.filter((id) => validIds.has(id));
          const effectiveOrder = order.length > 0 ? order : models.map((model) => model.id!);
          setAllModels(models);
          setShownModelIds(shown);
          setSortOrder(effectiveOrder);
          lastWrittenCustomModels.current = JSON.stringify(
            getShownModels(models, shown, effectiveOrder),
          );
        } else {
          const settingsModels = ensureModelIds(droidSettings.customModels || []);
          setAllModels(settingsModels);
          const ids = settingsModels.map((m) => m.id!);
          setShownModelIds(ids);
          setSortOrder(ids);
          lastWrittenCustomModels.current = JSON.stringify(
            getShownModels(settingsModels, ids, ids),
          );
        }
      } catch (e) {
        console.error("Failed to load cockpit-models.json:", e);
        const settingsModels = droidSettings.customModels || [];
        const normalizedModels = ensureModelIds(settingsModels);
        setAllModels(normalizedModels);
        const ids = normalizedModels.map((m) => m.id!);
        setShownModelIds(ids);
        setSortOrder(ids);
        lastWrittenCustomModels.current = JSON.stringify(
          getShownModels(normalizedModels, ids, ids),
        );
      }

      setSettingsLoaded(true);
      initialized.current = true;
    })();
  }, [setSettings, setMcpConfig, setAllModels, setShownModelIds, setSortOrder, setSettingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    let active = true;

    const syncExternalSettings = async () => {
      try {
        const metadata = await getSettingsMetadata();
        const version = metadataVersion(metadata);
        if (!active || version === lastSettingsFileVersion.current) return;

        const state = useAppStore.getState();
        if (
          state.settingsDirty ||
          state.modelSettingsDirty ||
          state.settingsSaveStatus === "saving"
        ) {
          return;
        }

        const externalSettings = await readSettings();
        if (!active) return;
        const liveModels = ensureModelIds(externalSettings.customModels || []);
        const liveById = new Map(liveModels.map((model) => [model.id!, model]));
        const storedIds = new Set(state.allModels.map((model) => model.id!));
        const mergedModels = ensureModelIds([
          ...state.allModels.map((model) => {
            const live = liveById.get(model.id!);
            return live ? { ...model, ...live, tags: model.tags, notes: model.notes } : model;
          }),
          ...liveModels.filter((model) => !storedIds.has(model.id!)),
        ]);
        const validIds = new Set(mergedModels.map((model) => model.id!));
        const shown = liveModels.map((model) => model.id!).filter((id) => validIds.has(id));
        const retainedOrder = state.sortOrder.filter((id) => validIds.has(id));
        const retainedIds = new Set(retainedOrder);
        const effectiveOrder = [
          ...retainedOrder,
          ...mergedModels.map((model) => model.id!).filter((id) => !retainedIds.has(id)),
        ];

        setSettings(externalSettings);
        setAllModels(mergedModels);
        setShownModelIds(shown);
        setSortOrder(effectiveOrder);
        lastWrittenCustomModels.current = JSON.stringify(
          getShownModels(mergedModels, shown, effectiveOrder),
        );
        lastSettingsFileVersion.current = version;
      } catch (error) {
        console.error("Failed to synchronize external settings.json changes:", error);
      }
    };

    const interval = window.setInterval(syncExternalSettings, 5000);
    const onFocus = () => void syncExternalSettings();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [settingsLoaded, setSettings, setAllModels, setShownModelIds, setSortOrder]);

  useEffect(() => {
    if (!initialized.current || !modelSettingsDirty) return;

    const shownModels = getShownModels(allModels, shownModelIds, sortOrder);
    const newCustomModelsJson = JSON.stringify(shownModels);

    if (newCustomModelsJson !== lastWrittenCustomModels.current) {
      lastWrittenCustomModels.current = newCustomModelsJson;
      const newSettings = { ...settings, customModels: shownModels };
      saveSettings(newSettings)
        .then(markModelSettingsPersisted)
        .catch((e) => console.error("Failed to persist settings.json:", e));
    } else {
      markModelSettingsPersisted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownModelIds, allModels, sortOrder, modelSettingsDirty]);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!initialized.current || !cockpitModelsDirty) return;

    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistCockpitModels().catch((error) => {
        console.error("Failed to persist cockpit-models.json:", error);
      });
    }, 300);

    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [allModels, shownModelIds, sortOrder, cockpitModelsDirty, persistCockpitModels]);

  const pageTitles: Record<string, string> = {
    dashboard: t("nav.dashboard"),
    models: t("nav.models"),
    skills: t("nav.skills"),
    droids: t("nav.droids"),
    prompts: t("nav.prompts"),
    sessions: t("nav.sessions"),
    mcp: t("nav.mcp"),
    usage: t("nav.usage"),
    settings: t("nav.settings"),
  };

  return (
    <div
      className="flex h-screen w-screen app-shell-surface"
      style={{
        background: "var(--color-base-200)",
        ["--cockpit-surface-image" as string]: `url(${cockpitSurface})`,
      }}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden app-main-offset">
        {/* Header */}
        <header className="app-header">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="app-title truncate text-gradient-brand">{pageTitles[currentPage]}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="cockpit-badge cockpit-badge-primary"
              title="已展示 / 总模型数"
            >
              {shownModelIds.length} / {allModels.length} 模型展示
            </div>
            {settingsSaveStatus !== "idle" && (
              <div
                className={`cockpit-badge ${
                  settingsSaveStatus === "error"
                    ? "cockpit-badge-error"
                    : settingsSaveStatus === "saved"
                      ? "cockpit-badge-success"
                      : "cockpit-badge-ghost"
                }`}
                title={settingsSaveError || "Droid settings.json 保存状态"}
              >
                {settingsSaveStatus === "saving"
                  ? "保存中…"
                  : settingsSaveStatus === "error"
                    ? "保存失败"
                    : settingsSaveStatus === "dirty"
                      ? "待保存"
                      : "已保存"}
              </div>
            )}
            {cockpitModelsSaveError && (
              <div className="cockpit-badge cockpit-badge-error" title={cockpitModelsSaveError}>
                模型库保存失败
              </div>
            )}
            {versionInfo?.hasUpdate && (
              <button
                className="cockpit-badge cockpit-badge-accent"
                onClick={() => useAppStore.getState().setPage("settings")}
                title={t("header.updateAvailable") + ": " + versionInfo.latestVersion}
              >
                <Sparkles size={12} />
                {t("header.updateAvailable")}
              </button>
            )}
            <button
              className="btn-icon"
              onClick={() => useAppStore.getState().toggleTheme()}
              title={theme === "light" ? "当前浅色；切换到深色" : theme === "dark" ? "当前深色；切换到跟随系统" : "当前跟随系统；切换到浅色"}
            >
              {theme === "light" ? <Moon size={16} /> : theme === "dark" ? <Monitor size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden" style={{ background: "transparent" }}>
          <div className="cockpit-fade-in h-full">
            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="loading-cockpit" /></div>}>
              {currentPage === "dashboard" && <Dashboard />}
              {currentPage === "models" && <ModelsPage />}
              {currentPage === "skills" && <SkillsPage />}
              {currentPage === "droids" && <DroidsPage />}
              {currentPage === "prompts" && <PromptsPage />}
              {currentPage === "sessions" && <SessionsPage />}
              {currentPage === "mcp" && <McpPage />}
              {usageVisited.current && (
                <div className={currentPage === "usage" ? "h-full" : "hidden"}>
                  <UsageDashboard />
                </div>
              )}
              {currentPage === "settings" && <SettingsPage />}
            </Suspense>
          </div>
        </main>
      </div>
      <SlashCommandBar open={slashOpen} onClose={() => setSlashOpen(false)} />
    </div>
  );
}

export default App;
