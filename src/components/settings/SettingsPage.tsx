import { useAppStore } from "../../stores/appStore";
import { GeneralSettings } from "./GeneralSettings";
import { DroidConfigSettings } from "./DroidConfigSettings";
import { MissionSettings } from "./MissionSettings";
import { UsageSettings } from "./UsageSettings";
import { DataSettings } from "./DataSettings";
import { SlashCommandsSettings } from "./SlashCommandsSettings";
import { AboutSettings } from "./AboutSettings";
import { Settings, Sliders, Rocket, BarChart3, Database, Info, Save, Terminal } from "lucide-react";
import type { SettingsTab } from "../../types";

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "general", label: "常规", icon: <Settings size={16} />, desc: "界面、声音、安全" },
  { id: "droid-config", label: "Droid 配置", icon: <Sliders size={16} />, desc: "模型、压缩、状态栏" },
  { id: "mission", label: "Mission / 子代理", icon: <Rocket size={16} />, desc: "编排器、工作器、复杂度默认值" },
  { id: "usage", label: "模型能力", icon: <BarChart3 size={16} />, desc: "输出、压缩、启用状态" },
  { id: "data", label: "数据管理", icon: <Database size={16} />, desc: "导入导出、备份" },
  { id: "slash-commands", label: "斜杠命令", icon: <Terminal size={16} />, desc: "官方命令、动态技能、配置映射" },
  { id: "about", label: "关于", icon: <Info size={16} />, desc: "版本、链接" },
];

export function SettingsPage() {
  const {
    settingsTab,
    setSettingsTab,
    settingsDirty,
    settingsSaveStatus,
    settingsSaveError,
    lastSettingsSavedAt,
    saveSettings,
  } = useAppStore();

  const handleSaveSettings = () => {
    saveSettings().catch((error) => {
      console.error("Failed to save Droid settings:", error);
    });
  };

  const saveHint = settingsDirty
    ? "设置已修改，点击保存后才会写入 ~/.factory/settings.json。"
    : lastSettingsSavedAt
      ? `上次保存：${new Date(lastSettingsSavedAt).toLocaleString()}`
      : "已从当前 ~/.factory/settings.json 同步；未检测到待保存修改。";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Vertical tabs */}
      <div
        className="w-56 flex flex-col py-4"
        style={{
          background: "var(--color-base-100)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        <div className="settings-section-title px-4 mb-2">设置</div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSettingsTab(tab.id)}
            className={`nav-item ${settingsTab === tab.id ? "active" : ""} mx-2`}
          >
            <span className="flex-shrink-0">{tab.icon}</span>
            <div className="flex-1 text-left min-w-0">
              <div className="truncate">{tab.label}</div>
              {settingsTab !== tab.id && (
                <div className="text-[10px] text-faint truncate">{tab.desc}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-base-200)" }}>
        <div className="px-6 pt-5">
          <div className="card-cockpit p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="settings-row-title">配置写入保护</div>
              <div className="settings-row-desc">
                {saveHint} 程序启动、页面切换和外部配置同步只读不写，避免覆盖已有个人配置。
              </div>
              {settingsSaveStatus === "error" && (
                <div className="mt-2 text-xs text-error break-all">{settingsSaveError}</div>
              )}
            </div>
            <button
              className={`btn-cockpit ${settingsDirty ? "btn-cockpit-primary" : "btn-cockpit-outline"}`}
              type="button"
              onClick={handleSaveSettings}
              disabled={!settingsDirty || settingsSaveStatus === "saving"}
              title="明确写入 Droid settings.json"
            >
              <Save size={15} />
              {settingsSaveStatus === "saving" ? "保存中…" : "保存设置"}
            </button>
          </div>
        </div>
        <div key={settingsTab} className="cockpit-fade-in">
          {settingsTab === "general" && <GeneralSettings />}
          {settingsTab === "droid-config" && <DroidConfigSettings />}
          {settingsTab === "mission" && <MissionSettings />}
          {settingsTab === "usage" && <UsageSettings />}
          {settingsTab === "data" && <DataSettings />}
          {settingsTab === "slash-commands" && <SlashCommandsSettings />}
          {settingsTab === "about" && <AboutSettings />}
        </div>
      </div>
    </div>
  );
}
