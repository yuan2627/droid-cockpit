import {
  getEffectiveModel,
  getEffectiveReasoningEffort,
  useAppStore,
} from "../../stores/appStore";
import { useState } from "react";
import { GroupedModelSelect } from "../common/GroupedModelSelect";

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

const smSelectStyle: React.CSSProperties = {
  width: "auto",
  minWidth: "9rem",
  maxWidth: "16rem",
  fontSize: "0.8rem",
  padding: "0.4rem 2rem 0.4rem 0.7rem",
};

const smInputStyle: React.CSSProperties = {
  width: "8rem",
  fontSize: "0.8rem",
  padding: "0.4rem 0.7rem",
};

const monoInputStyle: React.CSSProperties = {
  width: "16rem",
  fontSize: "0.75rem",
  padding: "0.4rem 0.7rem",
};

export function DroidConfigSettings() {
  const { settings, updateSettings } = useAppStore();
  const s = settings;
  const [newCompactionModel, setNewCompactionModel] = useState("");
  const [newCompactionLimit, setNewCompactionLimit] = useState("");
  const [fallbackFrom, setFallbackFrom] = useState("");
  const [fallbackTo, setFallbackTo] = useState("");

  const reasoningEffortOptions = [
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

  const sessionDefaults = s.sessionDefaultSettings || {};

  const updateSessionDefaults = (updates: Partial<typeof sessionDefaults>) => {
    updateSettings({
      sessionDefaultSettings: { ...sessionDefaults, ...updates },
    });
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: "48rem" }}>
        <Section title="会话默认设置">
          <Row label="默认模型" desc="新会话启动时使用的模型">
            <GroupedModelSelect
              value={getEffectiveModel(s) || ""}
              onChange={(value) =>
                updateSettings({
                  model: undefined,
                  sessionDefaultSettings: {
                    ...sessionDefaults,
                    model: value,
                  },
                })
              }
              placeholder="产品默认 / 选择模型"
              style={{ width: "min(100%, 320px)" }}
            />
          </Row>
          <Row label="默认推理等级" desc="控制模型进行多少结构化思考">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={getEffectiveReasoningEffort(s) || ""}
              onChange={(e) =>
                updateSettings({
                  reasoningEffort: undefined,
                  sessionDefaultSettings: {
                    ...sessionDefaults,
                    reasoningEffort: e.target.value || undefined,
                  },
                })
              }
            >
              <option value="">模型默认</option>
              {reasoningEffortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="默认交互模式" desc="新会话的默认模式">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={sessionDefaults.interactionMode || "auto"}
              onChange={(e) =>
                updateSessionDefaults({
                  interactionMode: e.target.value as "auto" | "spec",
                })
              }
            >
              <option value="auto">Auto (自动)</option>
              <option value="spec">Spec (规格)</option>
            </select>
          </Row>
          <Row label="默认自主等级" desc="新会话的自主运行级别">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={sessionDefaults.autonomyLevel || "off"}
              onChange={(e) =>
                updateSessionDefaults({
                  autonomyLevel: e.target.value as "off" | "low" | "medium" | "high",
                })
              }
            >
              <option value="off">Off (手动确认)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Row>
          <Row label="Spec 模式模型" desc="进入 Spec 模式时使用的模型；留空继承默认模型">
            <GroupedModelSelect
              value={sessionDefaults.specModeModel || ""}
              onChange={(value) => updateSessionDefaults({ specModeModel: value })}
              placeholder="继承默认 / 选择模型"
              style={{ width: "min(100%, 320px)" }}
            />
          </Row>
          <Row label="Spec 模式推理等级" desc="Spec 模式下的 reasoningEffort；留空使用模型默认">
            <select
              className="input-cockpit"
              style={smSelectStyle}
              value={sessionDefaults.specModeReasoningEffort || ""}
              onChange={(e) =>
                updateSessionDefaults({
                  specModeReasoningEffort: e.target.value || undefined,
                })
              }
            >
              <option value="">模型默认</option>
              {reasoningEffortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="上下文与压缩">
          <Row label="默认上下文压缩限制" desc="触发自动压缩的 Token 阈值">
            <input
              className="input-cockpit"
              style={smInputStyle}
              type="number"
              value={s.compactionTokenLimit ?? ""}
              onChange={(e) =>
                updateSettings({
                  compactionTokenLimit: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              placeholder="模型默认"
            />
          </Row>
          <Row label="压缩模型" desc="使用哪个模型执行上下文压缩；current-model 表示跟随当前会话模型">
            <GroupedModelSelect
              value={s.compactionModel || s.compactionModelMode || "current-model"}
              onChange={(value) =>
                updateSettings({
                  compactionModel: value || "current-model",
                  compactionModelMode: undefined,
                })
              }
              placeholder="跟随当前模型"
              specialOptions={[{ value: "current-model", label: "跟随当前模型", detail: "current-model" }]}
              style={{ width: "min(100%, 320px)" }}
            />
          </Row>

          {/* Per-model compaction limits */}
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">按模型设置压缩限制</div>
              <div className="settings-row-desc">为特定模型设置独立的上下文压缩阈值</div>
            </div>
            {Object.entries(s.compactionTokenLimitPerModel || {}).length === 0 ? (
              <div className="text-xs text-faint italic">暂无模型专属设置</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(s.compactionTokenLimitPerModel || {}).map(
                  ([modelId, limit]) => (
                    <div
                      key={modelId}
                      className="flex items-center justify-between rounded-md px-2.5 py-1.5"
                      style={{ background: "var(--color-base-300)" }}
                    >
                      <span className="font-mono-sm text-muted truncate flex-1 mr-2">
                        {modelId}
                      </span>
                      <span className="text-xs text-muted mr-2">
                        {(limit / 1000).toFixed(0)}K
                      </span>
                      <button
                        className="btn-icon btn-icon-danger"
                        style={{ width: 24, height: 24 }}
                        onClick={() => {
                          const next = { ...s.compactionTokenLimitPerModel };
                          delete next[modelId];
                          updateSettings({ compactionTokenLimitPerModel: next });
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
            <div className="flex gap-1">
              <GroupedModelSelect
                value={newCompactionModel}
                onChange={(value) => setNewCompactionModel(value || "")}
                placeholder="选择模型..."
                style={{ flex: 1, minWidth: 0 }}
              />
              <input
                className="input-cockpit"
                style={{ width: "6rem", fontSize: "0.75rem" }}
                type="number"
                value={newCompactionLimit}
                onChange={(event) => setNewCompactionLimit(event.target.value)}
                placeholder="Token数"
                step="10000"
              />
              <button
                className="btn-cockpit btn-cockpit-primary"
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
                onClick={() => {
                  if (newCompactionModel && newCompactionLimit) {
                    updateSettings({
                      compactionTokenLimitPerModel: {
                        ...s.compactionTokenLimitPerModel,
                        [newCompactionModel]: parseInt(newCompactionLimit),
                      },
                    });
                    setNewCompactionModel("");
                    setNewCompactionLimit("");
                  }
                }}
              >
                添加
              </button>
            </div>
          </div>
        </Section>

        <Section title="状态栏 (Status Line)">
          <Row label="状态栏命令" desc="执行的命令，stdout 渲染在输入框上方">
            <input
              className="input-cockpit font-mono-sm"
              style={monoInputStyle}
              value={s.statusLine?.command || ""}
              onChange={(e) =>
                updateSettings({
                  statusLine: { ...s.statusLine, command: e.target.value },
                })
              }
              placeholder="例如: node ~/.factory/statusline.js"
            />
          </Row>
          <Row label="状态栏内边距" desc="状态栏的 padding（行数）">
            <input
              className="input-cockpit"
              style={{ width: "5rem", fontSize: "0.8rem" }}
              type="number"
              value={s.statusLine?.padding ?? ""}
              onChange={(e) =>
                updateSettings({
                  statusLine: {
                    ...s.statusLine,
                    padding: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })
              }
              placeholder="默认"
            />
          </Row>
          <Row label="状态栏最大行数" desc="状态栏显示的最大行数">
            <input
              className="input-cockpit"
              style={{ width: "5rem", fontSize: "0.8rem" }}
              type="number"
              value={s.statusLine?.maxRows ?? ""}
              onChange={(e) =>
                updateSettings({
                  statusLine: {
                    ...s.statusLine,
                    maxRows: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })
              }
              placeholder="默认"
            />
          </Row>
        </Section>

        <Section title="基础设施路径">
          <Row label="Worktree 目录" desc="git worktree 的默认父目录（--worktree/-w 创建）">
            <input
              className="input-cockpit font-mono-sm"
              style={monoInputStyle}
              value={s.worktreeDirectory || ""}
              onChange={(e) => updateSettings({ worktreeDirectory: e.target.value })}
              placeholder="~/.factory/worktrees"
            />
          </Row>
          <Row label="Spec 保存目录" desc="Spec 模式输出文件的写入目录">
            <input
              className="input-cockpit font-mono-sm"
              style={monoInputStyle}
              value={s.specSaveDir || ""}
              onChange={(e) => updateSettings({ specSaveDir: e.target.value })}
              placeholder="~/.factory/specs"
            />
          </Row>
          <Row label="LLM 请求超时" desc="单个 LLM 请求的超时时间（毫秒）">
            <input
              className="input-cockpit"
              style={smInputStyle}
              type="number"
              value={s.llmRequestTimeout ?? ""}
              onChange={(e) =>
                updateSettings({
                  llmRequestTimeout: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              placeholder="产品默认"
            />
          </Row>
          <Row label="MCP 调用超时" desc="全局 MCP 工具调用超时（毫秒）；服务器 timeoutMs 优先">
            <input
              className="input-cockpit"
              style={smInputStyle}
              type="number"
              min={1}
              value={s.mcp?.callTimeoutMs ?? ""}
              onChange={(e) =>
                updateSettings({
                  mcp: {
                    ...s.mcp,
                    callTimeoutMs: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })
              }
              placeholder="产品默认"
            />
          </Row>
          <Row label="Mission 期间保持唤醒" desc="Mission 运行时防止系统休眠">
            <input
              type="checkbox"
              className="toggle-cockpit"
              checked={s.keepSystemAwakeDuringMissions ?? true}
              onChange={(e) => updateSettings({ keepSystemAwakeDuringMissions: e.target.checked })}
            />
          </Row>
        </Section>

        <Section title="模型收藏">
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">收藏的模型</div>
              <div className="settings-row-desc">在模型选择器中快速访问的模型列表</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(s.modelFavorites || []).map((mid, i) => (
                <span key={i} className="cockpit-badge cockpit-badge-accent" style={{ padding: "0.25rem 0.5rem" }}>
                  <span className="font-mono-sm">{mid}</span>
                  <button
                    onClick={() =>
                      updateSettings({
                        modelFavorites: s.modelFavorites?.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
              {(s.modelFavorites || []).length === 0 && (
                <span className="text-xs text-faint italic">暂无收藏</span>
              )}
            </div>
            <GroupedModelSelect
              value=""
              onChange={(value) => {
                if (value) {
                  updateSettings({
                    modelFavorites: [...(s.modelFavorites || []), value],
                  });
                }
              }}
              placeholder="添加收藏模型..."
              includeFavorites={false}
              style={{ maxWidth: "320px" }}
            />
          </div>
        </Section>

        <Section title="模型回退">
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div>
              <div className="settings-row-title">模型回退映射</div>
              <div className="settings-row-desc">
                当自定义 Droid 或配置引用的模型不可用时，用这里指定的模型替代。
              </div>
            </div>
            {Object.entries(s.modelFallbacks || {}).length === 0 ? (
              <div className="text-xs text-faint italic">暂无模型回退映射</div>
            ) : (
              <div className="space-y-1">
                {Object.entries(s.modelFallbacks || {}).map(([source, target]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between rounded-md px-2.5 py-1.5"
                    style={{ background: "var(--color-base-300)" }}
                  >
                    <span className="font-mono-sm text-muted truncate flex-1 mr-2">{source}</span>
                    <span className="text-xs text-faint mr-2">→</span>
                    <span className="font-mono-sm text-muted truncate flex-1 mr-2">{target}</span>
                    <button
                      className="btn-icon btn-icon-danger"
                      style={{ width: 24, height: 24 }}
                      onClick={() => {
                        const next = { ...(s.modelFallbacks || {}) };
                        delete next[source];
                        updateSettings({ modelFallbacks: next });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                className="input-cockpit font-mono-sm"
                value={fallbackFrom}
                onChange={(event) => setFallbackFrom(event.target.value)}
                placeholder="原模型 ID（如 claude-old-model）"
              />
              <GroupedModelSelect
                value={fallbackTo}
                onChange={(value) => setFallbackTo(value || "")}
                placeholder="替代模型..."
              />
              <button
                className="btn-cockpit btn-cockpit-primary"
                onClick={() => {
                  if (!fallbackFrom.trim() || !fallbackTo.trim()) return;
                  updateSettings({
                    modelFallbacks: {
                      ...(s.modelFallbacks || {}),
                      [fallbackFrom.trim()]: fallbackTo.trim(),
                    },
                  });
                  setFallbackFrom("");
                  setFallbackTo("");
                }}
              >
                添加
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
