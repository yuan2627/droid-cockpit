import { useAppStore } from "../../stores/appStore";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LOCALE_OPTIONS,
  DIFF_MODE_OPTIONS,
  TOOL_RESULT_DISPLAY_OPTIONS,
  LOGO_ANIMATION_OPTIONS,
  SOUND_FOCUS_MODE_OPTIONS,
  SUBAGENT_SOUNDS_OPTIONS,
} from "../../utils/helpers";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="settings-section-title px-1">{title}</h3>
      <div className="settings-group">{children}</div>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="flex-1 min-w-0 pr-4">
        <div className="settings-row-title">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="toggle-cockpit"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

const smSelectStyle: React.CSSProperties = {
  width: "auto",
  minWidth: "9rem",
  fontSize: "0.8rem",
  padding: "0.4rem 2rem 0.4rem 0.7rem",
};

const smInputStyle: React.CSSProperties = {
  width: "10rem",
  fontSize: "0.8rem",
  padding: "0.4rem 0.7rem",
};

export function GeneralSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppStore();
  const [newAllow, setNewAllow] = useState("");
  const [newDeny, setNewDeny] = useState("");
  const [newBlock, setNewBlock] = useState("");

  const s = settings;
  const rawTodoDisplayMode = s.todoDisplayMode as string | undefined;
  const todoDisplayModeLabel =
    rawTodoDisplayMode === "full" ? "pinned（已从 full 兼容迁移）" : rawTodoDisplayMode;
  const rawSubagentSounds = s.subagentSounds as unknown as string | undefined;
  const subagentSoundsValue =
    rawSubagentSounds === "off" ||
    rawSubagentSounds === "quiet" ||
    rawSubagentSounds === "inherit"
      ? rawSubagentSounds
      : "inherit";

  return (
    <div className="page-container">
      <div style={{ maxWidth: "48rem" }}>
        <Section title={t("settings.general.display")}>
          <Row label={t("settings.general.locale")} desc={t("settings.general.localeDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.locale || "zh-CN"}
              onChange={(e) => updateSettings({ locale: e.target.value })}
            >
              {LOCALE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
          <Row label="主题" desc="TUI 颜色主题（可通过 /themes 查看可用主题）">
            <input
              className="input-cockpit"
              style={smInputStyle}
              value={s.theme || ""}
              onChange={(e) => updateSettings({ theme: e.target.value })}
              placeholder="系统默认"
            />
          </Row>
          <Row label="覆盖终端颜色" desc="强制 Droid 主题覆盖终端配色方案">
            <Toggle
              checked={s.overrideTerminalColors ?? false}
              onChange={(v) => updateSettings({ overrideTerminalColors: v })}
            />
          </Row>
          <Row label={t("settings.general.diffMode")} desc={t("settings.general.diffModeDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.diffMode || "github"}
              onChange={(e) =>
                updateSettings({ diffMode: e.target.value as "github" | "unified" })
              }
            >
              {DIFF_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
          <Row label={t("settings.general.toolResultDisplay")} desc={t("settings.general.toolResultDisplayDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.toolResultDisplay || "expanded"}
              onChange={(e) =>
                updateSettings({
                  toolResultDisplay: e.target.value as "expanded" | "compact",
                })
              }
            >
              {TOOL_RESULT_DISPLAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
          {s.todoDisplayMode !== undefined && (
            <Row label="Todo 显示模式（兼容字段）" desc="Droid 0.159.1 已固定使用 pinned；仅保留原值，不再提供无效编辑">
              <span
                className={`cockpit-badge ${
                  rawTodoDisplayMode === "full" ? "cockpit-badge-warning" : "cockpit-badge-ghost"
                }`}
              >
                {todoDisplayModeLabel}
              </span>
            </Row>
          )}
          <Row label={t("settings.general.showThinking")} desc={t("settings.general.showThinkingDesc")}>
            <Toggle
              checked={s.showThinkingInMainView ?? false}
              onChange={(v) => updateSettings({ showThinkingInMainView: v })}
            />
          </Row>
          <Row label={t("settings.general.tokenUsageIndicator")} desc={t("settings.general.tokenUsageIndicatorDesc")}>
            <Toggle
              checked={s.showTokenUsageIndicator ?? false}
              onChange={(v) => updateSettings({ showTokenUsageIndicator: v })}
            />
          </Row>
          <Row label={t("settings.general.logoAnimation")} desc={t("settings.general.logoAnimationDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.logoAnimation || "once"}
              onChange={(e) =>
                updateSettings({
                  logoAnimation: e.target.value as "once" | "always" | "off",
                })
              }
            >
              {LOGO_ANIMATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
          <Row label={t("settings.general.hideChangelog")} desc={t("settings.general.hideChangelogDesc")}>
            <Toggle
              checked={s.hideChangelog ?? false}
              onChange={(v) => updateSettings({ hideChangelog: v })}
            />
          </Row>
          <Row label={t("settings.general.nerdFont")} desc={t("settings.general.nerdFontDesc")}>
            <Toggle
              checked={s.nerdFont ?? false}
              onChange={(v) => updateSettings({ nerdFont: v })}
            />
          </Row>
          <Row label={t("settings.general.readinessReport")} desc={t("settings.general.readinessReportDesc")}>
            <Toggle
              checked={s.enableReadinessReport ?? false}
              onChange={(v) => updateSettings({ enableReadinessReport: v })}
            />
          </Row>
        </Section>

        <Section title={t("settings.general.sound")}>
          <Row label={t("settings.general.completionSound")} desc={t("settings.general.completionSoundDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.completionSound || "fx-ok01"}
              onChange={(e) => updateSettings({ completionSound: e.target.value })}
            >
              <option value="off">关闭</option>
              <option value="bell">系统铃声</option>
              <option value="fx-ok01">fx-ok01 (默认)</option>
              <option value="fx-ack01">fx-ack01</option>
            </select>
          </Row>
          <Row label={t("settings.general.awaitingInputSound")} desc={t("settings.general.awaitingInputSoundDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.awaitingInputSound || "fx-ack01"}
              onChange={(e) => updateSettings({ awaitingInputSound: e.target.value })}
            >
              <option value="off">关闭</option>
              <option value="bell">系统铃声</option>
              <option value="fx-ok01">fx-ok01</option>
              <option value="fx-ack01">fx-ack01 (默认)</option>
            </select>
          </Row>
          <Row label={t("settings.general.soundFocusMode")} desc={t("settings.general.soundFocusModeDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.soundFocusMode || "always"}
              onChange={(e) =>
                updateSettings({
                  soundFocusMode: e.target.value as "always" | "focused" | "unfocused",
                })
              }
            >
              {SOUND_FOCUS_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
          {s.completionSound === undefined && s.enableCompletionBell !== undefined && (
            <Row label="完成铃声（兼容字段）" desc="旧版本回退开关；建议改用上方“完成提示音”">
              <Toggle
                checked={s.enableCompletionBell}
                onChange={(v) => updateSettings({ enableCompletionBell: v })}
              />
            </Row>
          )}
          <Row label={t("settings.general.subagentSounds")} desc={t("settings.general.subagentSoundsDesc")}>
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={subagentSoundsValue}
              onChange={(e) =>
                updateSettings({
                  subagentSounds: e.target.value as "off" | "quiet" | "inherit",
                })
              }
            >
              {SUBAGENT_SOUNDS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title={t("settings.general.security")}>
          <Row label={t("settings.general.droidShield")} desc={t("settings.general.droidShieldDesc")}>
            <Toggle
              checked={s.enableDroidShield ?? true}
              onChange={(v) => updateSettings({ enableDroidShield: v })}
            />
          </Row>
          <Row label={t("settings.general.backgroundProcesses")} desc={t("settings.general.backgroundProcessesDesc")}>
            <Toggle
              checked={s.allowBackgroundProcesses ?? false}
              onChange={(v) => updateSettings({ allowBackgroundProcesses: v })}
            />
          </Row>
          <Row label={t("settings.general.coAuthored")} desc={t("settings.general.coAuthoredDesc")}>
            <Toggle
              checked={s.includeCoAuthoredByDroid ?? true}
              onChange={(v) => updateSettings({ includeCoAuthoredByDroid: v })}
            />
          </Row>
          <Row label={t("settings.general.hooks")} desc={t("settings.general.hooksDesc")}>
            <Toggle
              checked={s.hooksDisabled ?? s.hooks?.hooksDisabled ?? false}
              onChange={(v) =>
                updateSettings({
                  hooksDisabled: undefined,
                  hooks: { ...(s.hooks || {}), hooksDisabled: v },
                })
              }
            />
          </Row>
          <Row label="显示钩子输出" desc="在主视图中显示 Hooks 的执行输出">
            <Toggle
              checked={s.hooks?.showHookOutput ?? false}
              onChange={(v) =>
                updateSettings({
                  hooks: { ...(s.hooks || {}), showHookOutput: v },
                })
              }
            />
          </Row>

          {/* Command allowlist */}
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">命令白名单 (Allowlist)</div>
              <div className="settings-row-desc">这些命令无需额外确认即可运行</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(s.commandAllowlist || []).map((cmd, i) => (
                <span key={i} className="cockpit-badge cockpit-badge-success" style={{ padding: "0.25rem 0.5rem" }}>
                  <span className="font-mono-sm">{cmd}</span>
                  <button
                    onClick={() =>
                      updateSettings({
                        commandAllowlist: s.commandAllowlist?.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                className="input-cockpit flex-1 font-mono-sm"
                placeholder="例如: ls"
                value={newAllow}
                onChange={(e) => setNewAllow(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAllow.trim()) {
                    updateSettings({
                      commandAllowlist: [...(s.commandAllowlist || []), newAllow.trim()],
                    });
                    setNewAllow("");
                  }
                }}
              />
              <button
                className="btn-icon"
                onClick={() => {
                  if (newAllow.trim()) {
                    updateSettings({
                      commandAllowlist: [...(s.commandAllowlist || []), newAllow.trim()],
                    });
                    setNewAllow("");
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Command denylist */}
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">命令黑名单 (Denylist)</div>
              <div className="settings-row-desc">这些命令始终需要确认</div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {(s.commandDenylist || []).map((cmd, i) => (
                <span key={i} className="cockpit-badge cockpit-badge-error" style={{ padding: "0.25rem 0.5rem" }}>
                  <span className="font-mono-sm truncate" style={{ maxWidth: "150px" }}>{cmd}</span>
                  <button
                    onClick={() =>
                      updateSettings({
                        commandDenylist: s.commandDenylist?.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                className="input-cockpit flex-1 font-mono-sm"
                placeholder="添加命令..."
                value={newDeny}
                onChange={(e) => setNewDeny(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDeny.trim()) {
                    updateSettings({
                      commandDenylist: [...(s.commandDenylist || []), newDeny.trim()],
                    });
                    setNewDeny("");
                  }
                }}
              />
              <button
                className="btn-icon"
                onClick={() => {
                  if (newDeny.trim()) {
                    updateSettings({
                      commandDenylist: [...(s.commandDenylist || []), newDeny.trim()],
                    });
                    setNewDeny("");
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Command blocklist */}
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">命令禁止列表 (Blocklist)</div>
              <div className="settings-row-desc">这些命令永远不能运行，即使跳过权限也阻止（比 Denylist 更严格）</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(s.commandBlocklist || []).map((cmd, i) => (
                <span key={i} className="cockpit-badge cockpit-badge-error" style={{ padding: "0.25rem 0.5rem" }}>
                  <span className="font-mono-sm">{cmd}</span>
                  <button
                    onClick={() =>
                      updateSettings({
                        commandBlocklist: s.commandBlocklist?.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              {(s.commandBlocklist || []).length === 0 && (
                <span className="text-xs text-faint italic">暂无</span>
              )}
            </div>
            <div className="flex gap-1">
              <input
                className="input-cockpit flex-1 font-mono-sm"
                placeholder="添加命令..."
                value={newBlock}
                onChange={(e) => setNewBlock(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBlock.trim()) {
                    updateSettings({
                      commandBlocklist: [...(s.commandBlocklist || []), newBlock.trim()],
                    });
                    setNewBlock("");
                  }
                }}
              />
              <button
                className="btn-icon"
                onClick={() => {
                  if (newBlock.trim()) {
                    updateSettings({
                      commandBlocklist: [...(s.commandBlocklist || []), newBlock.trim()],
                    });
                    setNewBlock("");
                  }
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </Section>

        <Section title={t("settings.general.advanced")}>
          <Row label={t("settings.general.cloudSync")} desc={t("settings.general.cloudSyncDesc")}>
            <Toggle
              checked={s.cloudSessionSync ?? true}
              onChange={(v) => updateSettings({ cloudSessionSync: v })}
            />
          </Row>
          <Row label={t("settings.general.ideAutoConnect")} desc={t("settings.general.ideAutoConnectDesc")}>
            <Toggle
              checked={s.ideAutoConnect ?? false}
              onChange={(v) => updateSettings({ ideAutoConnect: v })}
            />
          </Row>
          <Row label={t("settings.general.warmup")} desc={t("settings.general.warmupDesc")}>
            <Toggle
              checked={s.enableWarmup ?? true}
              onChange={(v) => updateSettings({ enableWarmup: v })}
            />
          </Row>
          <Row label={t("settings.general.customDroids")} desc={t("settings.general.customDroidsDesc")}>
            <Toggle
              checked={s.enableCustomDroids ?? false}
              onChange={(v) => updateSettings({ enableCustomDroids: v })}
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}
