import { GroupedModelSelect } from "../common/GroupedModelSelect";
import { useAppStore } from "../../stores/appStore";

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
  maxWidth: "15rem",
  fontSize: "0.8rem",
  padding: "0.4rem 2rem 0.4rem 0.7rem",
};

export function MissionSettings() {
  const { settings, updateSettings } = useAppStore();
  const s = settings;

  const effortOptions = [
    { value: "off", label: "Off" },
    { value: "none", label: "None" },
    { value: "minimal", label: "Minimal" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "max", label: "Max" },
    { value: "xhigh", label: "Extra High (xhigh)" },
    { value: "dynamic", label: "Dynamic" },
  ];

  const missionSettings = s.missionModelSettings || {};
  const subagentSettings = s.subagentModelSettings || {};

  const updateMission = (updates: Partial<typeof missionSettings>) => {
    updateSettings({
      missionModelSettings: { ...missionSettings, ...updates },
    });
  };

  const updateSubagents = (updates: Partial<typeof subagentSettings>) => {
    updateSettings({
      subagentModelSettings: { ...subagentSettings, ...updates },
    });
  };

  const renderModelInput = (
    value: string | undefined,
    onChange: (value: string | undefined) => void,
  ) => (
    <GroupedModelSelect
      value={value || ""}
      onChange={onChange}
      placeholder="继承默认 / 选择模型"
      style={{ width: "min(100%, 320px)" }}
    />
  );

  const renderEffortSelect = (
    value: string | undefined,
    onChange: (value: string | undefined) => void,
  ) => (
    <select
      className="input-cockpit"
      style={smSelectStyle}
      value={value || ""}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">模型默认</option>
      {effortOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );

  return (
    <div className="page-container">
      <div style={{ maxWidth: "48rem" }}>
        <Section title="编排器 (Orchestrator)">
          <Row label="编排模型" desc="Mission 编排器使用的模型；可从 Factory 官方模型、BYOK 预设和已展示自定义模型中选择">
            {renderModelInput(s.missionOrchestratorModel, (value) =>
              updateSettings({ missionOrchestratorModel: value }),
            )}
          </Row>
          <Row label="编排推理等级" desc="编排器的推理强度">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.missionOrchestratorReasoningEffort || ""}
              onChange={(e) =>
                updateSettings({ missionOrchestratorReasoningEffort: e.target.value })
              }
            >
              <option value="">模型默认</option>
              {effortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="工作器 (Worker)">
          <Row label="工作器模型" desc="Mission worker 子代理使用的模型；留空时使用 Droid 默认策略">
            {renderModelInput(missionSettings.workerModel, (value) =>
              updateMission({ workerModel: value }),
            )}
          </Row>
          <Row label="工作器推理等级">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={missionSettings.workerReasoningEffort || ""}
              onChange={(e) =>
                updateMission({ workerReasoningEffort: e.target.value })
              }
            >
              <option value="">模型默认</option>
              {effortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="验证器 (Validator)">
          <Row label="验证器模型" desc="Mission 验证器（scrutiny / user-testing）使用的模型">
            {renderModelInput(missionSettings.validationWorkerModel, (value) =>
              updateMission({ validationWorkerModel: value }),
            )}
          </Row>
          <Row label="验证器推理等级">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={missionSettings.validationWorkerReasoningEffort || ""}
              onChange={(e) =>
                updateMission({ validationWorkerReasoningEffort: e.target.value })
              }
            >
              <option value="">模型默认</option>
              {effortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="子代理复杂度默认值">
          <Row label="子代理自主级别" desc="inherit 表示继承父会话；也可为子代理单独限制自主级别">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={s.subagentAutonomyLevel || "inherit"}
              onChange={(event) =>
                updateSettings({
                  subagentAutonomyLevel: event.target.value as "inherit" | "off" | "low" | "medium" | "high",
                })
              }
            >
              <option value="inherit">继承父会话</option>
              <option value="off">关闭</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </Row>
          <Row label="轻量任务模型" desc="未设置时继承主模型">
            {renderModelInput(subagentSettings.lightModel, (value) => updateSubagents({ lightModel: value }))}
          </Row>
          <Row label="轻量任务推理等级">
            {renderEffortSelect(subagentSettings.lightReasoningEffort, (value) => updateSubagents({ lightReasoningEffort: value }))}
          </Row>
          <Row label="中等任务模型" desc="未设置时继承主模型">
            {renderModelInput(subagentSettings.mediumModel, (value) => updateSubagents({ mediumModel: value }))}
          </Row>
          <Row label="中等任务推理等级">
            {renderEffortSelect(subagentSettings.mediumReasoningEffort, (value) => updateSubagents({ mediumReasoningEffort: value }))}
          </Row>
          <Row label="高复杂度任务模型" desc="未设置时继承主模型">
            {renderModelInput(subagentSettings.heavyModel, (value) => updateSubagents({ heavyModel: value }))}
          </Row>
          <Row label="高复杂度任务推理等级">
            {renderEffortSelect(subagentSettings.heavyReasoningEffort, (value) => updateSubagents({ heavyReasoningEffort: value }))}
          </Row>
        </Section>

        <Section title="审核与测试">
          <Row label="跳过代码审查 (Skip Scrutiny)" desc="跳过 Mission 的 scrutiny 验证里程碑">
            <Toggle
              checked={missionSettings.skipScrutiny ?? false}
              onChange={(v) => updateMission({ skipScrutiny: v })}
            />
          </Row>
          <Row label="跳过用户测试 (Skip User Testing)" desc="跳过 Mission 的 user-testing 验证里程碑">
            <Toggle
              checked={missionSettings.skipUserTesting ?? false}
              onChange={(v) => updateMission({ skipUserTesting: v })}
            />
          </Row>
        </Section>

        <Section title="系统">
          <Row label="子代理空闲超时" desc="子代理无活动多久后视为超时（毫秒）；留空使用 Droid 默认值">
            <input
              className="input-cockpit"
              style={{ width: "8rem", fontSize: "0.8rem", padding: "0.4rem 0.7rem" }}
              type="number"
              min={1000}
              value={s.subagentInactivityTimeout ?? ""}
              onChange={(event) =>
                updateSettings({
                  subagentInactivityTimeout: event.target.value ? parseInt(event.target.value, 10) : undefined,
                })
              }
              placeholder="产品默认"
            />
          </Row>
          <Row label="Mission 期间保持唤醒" desc="Mission 运行时防止系统休眠">
            <Toggle
              checked={s.keepSystemAwakeDuringMissions ?? true}
              onChange={(v) => updateSettings({ keepSystemAwakeDuringMissions: v })}
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}
