import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { CustomModel, ProviderPreset, ProviderType } from "../../types";
import { providerPresets } from "../../config/presets";
import { useAppStore } from "../../stores/appStore";
import { testModelConnection, fetchProviderModels, isEnvVarKey } from "../../utils/tauri";
import { X, ChevronDown, ChevronUp, Zap, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude Messages API)" },
  { value: "openai", label: "OpenAI (Responses API)" },
  { value: "generic-chat-completion-api", label: "Generic Chat Completions (OpenAI 兼容)" },
];

const REASONING_EFFORT_OPTIONS = [
  { value: "none", label: "none（无推理）" },
  { value: "off", label: "off（禁用）" },
  { value: "minimal", label: "minimal（最小）" },
  { value: "low", label: "low（低）" },
  { value: "medium", label: "medium（中）" },
  { value: "high", label: "high（高）" },
  { value: "xhigh", label: "xhigh（超高）" },
  { value: "max", label: "max（最大）" },
  { value: "dynamic", label: "dynamic（动态）" },
];

function providerLabel(provider: ProviderType): string {
  return PROVIDER_OPTIONS.find((option) => option.value === provider)?.label || provider;
}

type PresetProtocol = NonNullable<ProviderPreset["protocols"]>[number];

function presetProtocols(preset?: ProviderPreset): PresetProtocol[] {
  if (!preset) return [];
  if (preset.protocols?.length) return preset.protocols;
  return [
    {
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      status: "recommended",
      endpointNote: preset.endpointNote,
      note: preset.protocolNote,
      referenceUrl: preset.referenceUrl,
    },
  ];
}

function recommendedProtocol(preset?: ProviderPreset): PresetProtocol | undefined {
  const protocols = presetProtocols(preset);
  return protocols.find((protocol) => protocol.status === "recommended") || protocols[0];
}

function protocolStatusLabel(status: PresetProtocol["status"]): string {
  return status === "recommended" ? "★ 官方推荐" : "✓ 官方支持";
}

function protocolBadgeClass(status: PresetProtocol["status"]): string {
  return status === "recommended" ? "cockpit-badge-success" : "cockpit-badge-info";
}

function verificationStatusLabel(status?: ProviderPreset["verificationStatus"]): string {
  if (status === "verified") return "已核验";
  if (status === "partial") return "部分核验";
  if (status === "dynamic") return "动态目录";
  return "待核验";
}

function verificationStatusBadgeClass(status?: ProviderPreset["verificationStatus"]): string {
  if (status === "verified") return "cockpit-badge-success";
  if (status === "partial") return "cockpit-badge-warning";
  if (status === "dynamic") return "cockpit-badge-info";
  return "cockpit-badge-ghost";
}

function normalizedBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function protocolKey(protocol: PresetProtocol): string {
  return protocol.id || `${protocol.provider}|${normalizedBaseUrl(protocol.baseUrl)}`;
}

function protocolDisplayLabel(protocol: PresetProtocol): string {
  const protocolName = protocol.label || providerLabel(protocol.provider);
  const service = protocol.serviceLabel ? `${protocol.serviceLabel} · ` : "";
  return `${protocolStatusLabel(protocol.status)} · ${service}${protocolName}`;
}

function FieldLabel({
  children,
  required,
  optional,
}: {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="form-field-label">
      {children}
      {required && <span className="required-mark" aria-label="必填">*</span>}
      {optional && <span className="optional-mark">（可选）</span>}
    </label>
  );
}

export function ModelForm() {
  const {
    editingModel,
    addModel,
    updateModel,
    setShowModelForm,
    setEditingModel,
    allModels,
  } = useAppStore();

  const isEdit = !!editingModel;

  const [form, setForm] = useState<CustomModel>(
    editingModel || {
      model: "",
      displayName: "",
      baseUrl: "",
      apiKey: "",
      provider: "anthropic",
      maxOutputTokens: undefined,
      noImageSupport: false,
    },
  );

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [selectedModelIdx, setSelectedModelIdx] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [extraArgsText, setExtraArgsText] = useState(
    editingModel?.extraArgs ? JSON.stringify(editingModel.extraArgs, null, 2) : "",
  );
  const [extraHeadersText, setExtraHeadersText] = useState(
    editingModel?.extraHeaders ? JSON.stringify(editingModel.extraHeaders, null, 2) : "",
  );
  const [useEnvVar, setUseEnvVar] = useState(isEnvVarKey(editingModel?.apiKey || ""));
  const [envVarName, setEnvVarName] = useState(() => {
    const k = editingModel?.apiKey || "";
    const m = k.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
    return m ? m[1] : "";
  });
  const [error, setError] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; httpCode: string; body: string } | null>(null);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const selectedPreset = providerPresets.find((p) => p.id === selectedPresetId);
  const selectedPresetProtocols = presetProtocols(selectedPreset);
  const selectedProtocol = selectedPresetProtocols.find(
    (protocol) =>
      protocol.provider === form.provider &&
      normalizedBaseUrl(protocol.baseUrl) === normalizedBaseUrl(form.baseUrl),
  );
  const selectedPresetModel = selectedPreset?.models?.[selectedModelIdx ? parseInt(selectedModelIdx, 10) : 0];
  const presetProtocolMismatch = selectedPreset && !selectedProtocol;

  useEffect(() => {
    if (!selectedPresetId) return;
    const preset = providerPresets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    const protocol = recommendedProtocol(preset);
    setForm((f) => ({
      ...f,
      baseUrl: protocol?.baseUrl || preset.baseUrl,
      provider: protocol?.provider || preset.provider,
      noImageSupport: preset.noImageSupport === true ? true : undefined,
    }));
    if (preset.models && preset.models.length > 0) {
      setSelectedModelIdx("0");
    } else {
      setSelectedModelIdx("");
      if (preset.model) {
        setForm((f) => ({ ...f, model: preset.model }));
      }
    }
  }, [selectedPresetId]);

  useEffect(() => {
    if (!selectedPresetId || selectedModelIdx === "") return;
    const preset = providerPresets.find((p) => p.id === selectedPresetId);
    if (!preset || !preset.models) return;
    const idx = parseInt(selectedModelIdx);
    const m = preset.models[idx];
    if (!m) return;
    setForm((f) => ({
      ...f,
      model: m.model,
      displayName: m.displayName,
      maxOutputTokens: m.maxOutputVerified ? m.maxOutputTokens : undefined,
      maxContextLimit: m.contextWindowVerified ? m.contextWindow : undefined,
    }));
  }, [selectedPresetId, selectedModelIdx]);

  useEffect(() => {
    if (useEnvVar && envVarName) {
      setForm((f) => ({ ...f, apiKey: `\${${envVarName}}` }));
    }
  }, [useEnvVar, envVarName]);

  const handleOpenExternal = async (url: string) => {
    setError("");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("unsupported url protocol");
      }
      await openUrl(url);
    } catch (tauriError) {
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        setError(`无法打开链接，请手动复制到浏览器：${url}`);
        console.error("Failed to open external URL:", tauriError);
      }
    }
  };

  const handleTest = async () => {
    setError("");
    if (!form.baseUrl || !form.apiKey || !form.model) {
      setError("请先填写 baseUrl, apiKey 和 model");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      let headers: Record<string, string> | undefined;
      if (extraHeadersText.trim()) headers = JSON.parse(extraHeadersText);
      const result = await testModelConnection(
        form.baseUrl,
        form.apiKey,
        form.model,
        form.provider,
        headers,
      );
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, httpCode: "0", body: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setError("");
    if (!form.baseUrl || !form.apiKey) {
      setError("请先填写 baseUrl 和 apiKey");
      return;
    }
    setFetchingModels(true);
    try {
      let headers: Record<string, string> | undefined;
      if (extraHeadersText.trim()) headers = JSON.parse(extraHeadersText);
      const models = await fetchProviderModels(
        form.baseUrl,
        form.apiKey,
        form.provider,
        headers,
      );
      setFetchedModels(models);
      if (models.length === 0) {
        setError("未获取到模型列表（该供应商可能不支持 /models 接口）");
      }
    } catch (e) {
      setError("获取模型列表失败: " + String(e));
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = () => {
    setError("");

    if (!form.model.trim()) {
      setError("模型 ID (model) 不能为空");
      return;
    }
    if (!form.baseUrl.trim()) {
      setError("Base URL 不能为空");
      return;
    }
    try {
      const url = new URL(form.baseUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
    } catch {
      setError("Base URL 必须是有效的 http(s) 地址");
      return;
    }
    if (
      form.maxOutputTokens !== undefined &&
      (!Number.isInteger(form.maxOutputTokens) || form.maxOutputTokens <= 0)
    ) {
      setError("最大输出 Token 必须是正整数");
      return;
    }
    if (
      form.maxContextLimit !== undefined &&
      (!Number.isInteger(form.maxContextLimit) || form.maxContextLimit <= 0)
    ) {
      setError("最大上下文 Token 必须是正整数");
      return;
    }
    if (
      form.thinkingMaxTokens !== undefined &&
      (!Number.isInteger(form.thinkingMaxTokens) || form.thinkingMaxTokens <= 0)
    ) {
      setError("思考预算 Token 必须是正整数");
      return;
    }

    let finalApiKey = form.apiKey;
    if (useEnvVar) {
      if (!envVarName.trim()) {
        setError("请填写环境变量名");
        return;
      }
      if (!/^[A-Z_][A-Z0-9_]*$/.test(envVarName.trim())) {
        setError("环境变量名只能包含大写字母、数字和下划线");
        return;
      }
      finalApiKey = `\${${envVarName.trim()}}`;
    } else {
      if (!finalApiKey.trim()) {
        setError("API Key 不能为空");
        return;
      }
    }

    let extraArgs: Record<string, unknown> | undefined;
    let extraHeaders: Record<string, string> | undefined;
    if (extraArgsText.trim()) {
      try {
        extraArgs = JSON.parse(extraArgsText);
      } catch {
        setError("extraArgs JSON 格式错误");
        return;
      }
    }
    if (extraHeadersText.trim()) {
      try {
        extraHeaders = JSON.parse(extraHeadersText);
      } catch {
        setError("extraHeaders JSON 格式错误");
        return;
      }
    }

    const modelData: CustomModel = {
      ...form,
      apiKey: finalApiKey,
      maxOutputTokens: form.maxOutputTokens || undefined,
      extraArgs: extraArgs || undefined,
      extraHeaders: extraHeaders || undefined,
    };

    const duplicate = allModels.some((item) => {
      if (isEdit && (item.id || item.model) === (editingModel?.id || editingModel?.model)) {
        return false;
      }
      return (
        item.provider === modelData.provider &&
        item.model.trim() === modelData.model.trim() &&
        item.baseUrl.trim().replace(/\/+$/, "") === modelData.baseUrl.trim().replace(/\/+$/, "")
      );
    });
    if (duplicate) {
      setError("同一协议、Base URL 和模型 ID 的配置已存在");
      return;
    }

    if (isEdit && editingModel) {
      const key = editingModel.id || editingModel.model;
      updateModel(key, modelData);
    } else {
      addModel(modelData);
    }

    setShowModelForm(false);
    setEditingModel(null);
  };

  const handleClose = () => {
    setShowModelForm(false);
    setEditingModel(null);
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-panel w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-strong">
              {isEdit ? "编辑模型" : "新增模型"}
            </h2>
            <button className="btn-icon" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>

          {/* Preset selector */}
          {!isEdit && (
            <div className="form-field mb-4">
              <FieldLabel optional>从预设模板选择（官方渠道）</FieldLabel>
              <select
                className="input-cockpit"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                <option value="">-- 自定义（不使用预设）--</option>
                <optgroup label="官方直连 API">
                  {providerPresets
                    .filter((p) => p.category === "official")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="订阅与 Coding Plan">
                  {providerPresets
                    .filter((p) => p.category === "plan")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="模型网关">
                  {providerPresets
                    .filter((p) => p.category === "gateway")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              </select>

              {selectedPresetId && (
                <div className="mt-2">
                  {selectedPreset?.models?.length ? (
                    <select
                      className="input-cockpit"
                      style={{ fontSize: "0.8rem" }}
                      value={selectedModelIdx}
                      onChange={(e) => setSelectedModelIdx(e.target.value)}
                    >
                      <option value="">-- 选择模型 --</option>
                      {selectedPreset.models.map((m, i) => (
                        <option key={i} value={String(i)}>
                          {m.displayName} ({m.model})
                          {m.contextWindow
                            ? ` - ${Math.round(m.contextWindow / 1000)}K ctx${m.contextWindowVerified ? " · 已核验" : " · 待复核"}`
                            : ""}
                          {m.maxOutputTokens
                            ? ` - ${Math.round(m.maxOutputTokens / 1000)}K out${m.maxOutputVerified ? " · 已核验" : " · 待复核"}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="alert-cockpit alert-cockpit-info">
                      <span>
                        该预设的模型目录是动态的。填写 API Key 后点击“拉取可用模型”，
                        或直接在“模型 ID”中输入供应商官方模型 ID。
                      </span>
                    </div>
                  )}
                  {selectedPreset?.apiKeyUrl && (
                    <button
                      type="button"
                      onClick={() => handleOpenExternal(selectedPreset.apiKeyUrl!)}
                      className="text-xs mt-1 inline-block"
                      style={{ color: "var(--color-primary)" }}
                    >
                      → 获取 API Key
                    </button>
                  )}
                  {selectedPreset && (
                    <div className="preset-reference-card mt-2">
                      <div className="preset-reference-title" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                        <span>{selectedPreset.name} · 预设依据</span>
                        <span className={`cockpit-badge ${verificationStatusBadgeClass(selectedPreset.verificationStatus)}`}>
                          {verificationStatusLabel(selectedPreset.verificationStatus)}
                        </span>
                      </div>
                      <div className="preset-reference-grid">
                        <span>参考模型</span>
                        <strong>{selectedPresetModel?.displayName || selectedPreset.model || "动态模型目录"}</strong>
                        <span>核验状态</span>
                        <strong>{verificationStatusLabel(selectedPreset.verificationStatus)}</strong>
                        <span>官方协议</span>
                        <strong>
                          {selectedProtocol
                            ? protocolDisplayLabel(selectedProtocol)
                            : `${providerLabel(form.provider)}（未见该预设官方标注）`}
                          {selectedPresetProtocols.length > 1 ? ` · 支持 ${selectedPresetProtocols.length} 种` : ""}
                        </strong>
                        <span>服务 / 计划</span>
                        <strong>{selectedProtocol?.serviceLabel || selectedPreset.name}</strong>
                        <span>Endpoint</span>
                        <code>{selectedProtocol?.endpointNote || selectedPreset.endpointNote || selectedPreset.baseUrl}</code>
                        <span>计费 / 额度</span>
                        <p>{selectedProtocol?.billingNote || selectedPreset.billingNote || "按供应商当前计费规则；请在开通页面确认。"}</p>
                        <span>核验说明</span>
                        <p>{selectedPreset.verificationNote || "已按供应商官方说明整理；动态目录请以拉取结果为准。"}</p>
                        <span>最大上下文</span>
                        <p>{selectedPreset.contextWindowVerificationNote || "未写入固定上下文上限，使用供应商或 Droid 默认。"}</p>
                        <span>最大输出</span>
                        <p>{selectedPreset.maxOutputVerificationNote || "未写入固定最大输出，使用供应商或 Droid 默认。"}</p>
                      </div>
                      {selectedPresetProtocols.length > 0 && (
                        <div className="protocol-support-list">
                          {selectedPresetProtocols.map((protocol) => (
                            <span
                              key={protocolKey(protocol)}
                              className={`cockpit-badge ${protocolBadgeClass(protocol.status)}`}
                              title={protocol.note || protocol.endpointNote || protocol.baseUrl}
                            >
                              {protocolDisplayLabel(protocol)}
                            </span>
                          ))}
                        </div>
                      )}
                      {(selectedProtocol?.note || selectedPreset.protocolNote) && (
                        <p className="preset-reference-note">{selectedProtocol?.note || selectedPreset.protocolNote}</p>
                      )}
                      {selectedPresetModel && (
                        <p className="preset-reference-note">
                          参数：{selectedPresetModel.contextWindow
                            ? `上下文 ${selectedPresetModel.contextWindow.toLocaleString()} tokens${selectedPresetModel.contextWindowVerified ? "（已核验）" : "（待复核）"}；`
                            : "上下文未强制写入，使用供应商或 Droid 默认；"}
                          {selectedPresetModel.maxOutputTokens
                            ? `最大输出 ${selectedPresetModel.maxOutputTokens.toLocaleString()} tokens${selectedPresetModel.maxOutputVerified ? "（已核验）" : "（待复核）"}；`
                            : "最大输出未强制写入，使用供应商或 Droid 默认；"}
                          稳定性 {selectedPresetModel.stability || "未标注"}。
                        </p>
                      )}
                      {selectedPreset.referenceUrl && (
                        <button
                          type="button"
                          onClick={() => handleOpenExternal(selectedProtocol?.referenceUrl || selectedPreset.referenceUrl!)}
                          className="preset-reference-link"
                        >
                          查看官方参考文档 →
                        </button>
                      )}
                      {presetProtocolMismatch && (
                        <div className="alert-cockpit alert-cockpit-warning mt-2">
                          <span>
                            当前 {providerLabel(form.provider)} 与 Base URL 组合未在该预设中核验；
                            请选择带 ★ / ✓ 的接入方式，或确认这是供应商允许的自定义 Endpoint。
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {selectedPresetId && !isEdit && (
            <div
              className="my-3 text-xs text-faint text-center"
              style={{
                borderTop: "1px solid var(--color-border)",
                paddingTop: "0.5rem",
              }}
            >
              以下字段已自动填充，可修改
            </div>
          )}

          {/* Required fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-field">
              <FieldLabel required>模型 ID</FieldLabel>
              <div className="flex gap-1">
                <input
                  className="input-cockpit font-mono-sm flex-1"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="例如: claude-sonnet-4-6"
                  list={fetchedModels.length > 0 ? "fetched-models" : undefined}
                />
                {fetchedModels.length > 0 && (
                  <datalist id="fetched-models">
                    {fetchedModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                )}
              </div>
              <button
                type="button"
                className="btn-cockpit btn-cockpit-ghost self-start mt-1"
                style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                onClick={handleFetchModels}
                disabled={fetchingModels}
              >
                {fetchingModels ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                拉取可用模型
              </button>
            </div>

            <div className="form-field">
              <FieldLabel optional>显示名称</FieldLabel>
              <input
                className="input-cockpit"
                value={form.displayName || ""}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="例如: Claude Sonnet 4.6"
              />
            </div>

            <div className="form-field sm:col-span-2">
              <FieldLabel required>Base URL</FieldLabel>
              <input
                className="input-cockpit font-mono-sm"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="例如: https://api.anthropic.com"
              />
              {selectedPreset && (
                <p className="form-field-hint mt-1">
                  Endpoint 已与上方接入方式自动关联。手动修改会被标记为未核验覆盖。
                </p>
              )}
            </div>

            {/* API Key with env var support */}
            <div className="form-field sm:col-span-2">
              <div className="flex items-center justify-between">
                <FieldLabel required>API Key</FieldLabel>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="form-field-hint">使用环境变量</span>
                  <input
                    type="checkbox"
                    className="toggle-cockpit"
                    checked={useEnvVar}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseEnvVar(checked);
                      if (!checked && isEnvVarKey(form.apiKey)) {
                        setForm({ ...form, apiKey: "" });
                      }
                    }}
                  />
                </label>
              </div>
              {useEnvVar ? (
                <div className="flex w-full">
                  <span
                    className="flex items-center px-2.5 text-sm font-mono-sm text-faint"
                    style={{
                      background: "var(--color-base-300)",
                      border: "1px solid var(--color-border)",
                      borderRight: "none",
                      borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
                    }}
                  >
                    {"${"}
                  </span>
                  <input
                    className="input-cockpit font-mono-sm"
                    style={{ borderRadius: 0, borderLeft: "none", borderRight: "none" }}
                    value={envVarName}
                    onChange={(e) => setEnvVarName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
                    placeholder="PROVIDER_API_KEY"
                  />
                  <span
                    className="flex items-center px-2.5 text-sm font-mono-sm text-faint"
                    style={{
                      background: "var(--color-base-300)",
                      border: "1px solid var(--color-border)",
                      borderLeft: "none",
                      borderRadius: "0 var(--radius-md) var(--radius-md) 0",
                    }}
                  >
                    {"}"}
                  </span>
                </div>
              ) : (
                <input
                  className="input-cockpit font-mono-sm"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              )}
              {useEnvVar && (
                <p className="form-field-hint mt-1">
                  Droid 会从环境变量{" "}
                  <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>{`\${${envVarName || "VAR"}}`}</code>{" "}
                  读取。请确保运行 Droid 前已设置该环境变量。
                </p>
              )}
            </div>

            <div className="form-field">
              <FieldLabel required>接入协议 / Endpoint</FieldLabel>
              <select
                className="input-cockpit"
                value={selectedPreset
                  ? (selectedProtocol ? protocolKey(selectedProtocol) : "__custom__")
                  : form.provider}
                onChange={(e) => {
                  if (selectedPreset) {
                    const nextProtocol = selectedPresetProtocols.find(
                      (protocol) => protocolKey(protocol) === e.target.value,
                    );
                    if (!nextProtocol) return;
                    setForm({
                      ...form,
                      provider: nextProtocol.provider,
                      baseUrl: nextProtocol.baseUrl,
                    });
                    return;
                  }
                  setForm({ ...form, provider: e.target.value as ProviderType });
                }}
              >
                {selectedPreset ? (
                  <>
                    {presetProtocolMismatch && (
                      <option value="__custom__">⚠ 手动 Endpoint（未在预设中核验）</option>
                    )}
                    {selectedPresetProtocols.map((protocol) => (
                      <option key={protocolKey(protocol)} value={protocolKey(protocol)}>
                        {protocolDisplayLabel(protocol)}
                      </option>
                    ))}
                  </>
                ) : (
                  PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                )}
              </select>
              {selectedPreset && (
                <div className="protocol-support-summary">
                  <div>
                    只显示该预设已核验的 <b>{selectedPresetProtocols.length || 1}</b> 种接入方式；当前：
                    <b>
                      {selectedProtocol
                        ? protocolDisplayLabel(selectedProtocol)
                        : "未见官方标注"}
                    </b>
                  </div>
                  {selectedProtocol?.endpointNote && (
                    <code>{selectedProtocol.endpointNote}</code>
                  )}
                </div>
              )}
            </div>

            <div className="form-field">
              <FieldLabel optional>最大输出 Token</FieldLabel>
              <input
                className="input-cockpit"
                type="number"
                value={form.maxOutputTokens ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxOutputTokens: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                placeholder="留空使用默认值"
              />
              <p className="form-field-hint mt-1">
                仅精确模型且已交叉核验时自动填充；滚动别名保持为空。
              </p>
            </div>

            <div className="form-field">
              <FieldLabel optional>最大上下文 Token</FieldLabel>
              <input
                className="input-cockpit"
                type="number"
                value={form.maxContextLimit ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxContextLimit: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="留空使用 Droid/供应商默认"
              />
              <p className="form-field-hint mt-1">
                推荐字段；表示输入与输出共享的模型上下文窗口，不等于最大输出。
              </p>
            </div>

            <div className="form-field">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle-cockpit"
                  checked={form.noImageSupport ?? false}
                  onChange={(e) =>
                    setForm({ ...form, noImageSupport: e.target.checked })
                  }
                />
                <span className="form-field-label">不支持图片输入 <span className="optional-mark">（可选）</span></span>
              </label>
            </div>
          </div>

          {/* Connection test button + result */}
          <div className="mt-4">
            <button
              className="btn-cockpit btn-cockpit-outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              测试连接
            </button>
            {testResult && (
              <div className={`alert-cockpit mt-2 ${testResult.success ? "alert-cockpit-success" : "alert-cockpit-error"}`}>
                <div>
                  {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>
                    {testResult.success ? "连接成功" : "连接失败"} (HTTP {testResult.httpCode})
                    {!testResult.success && testResult.body && (
                      <pre className="text-xs mt-1 whitespace-pre-wrap max-h-24 overflow-y-auto font-mono-sm">{testResult.body.slice(0, 500)}</pre>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Advanced options (collapsible) */}
          <div className="mt-4">
            <button
              className="btn-cockpit btn-cockpit-ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              高级选项（推理 / Thinking / extraArgs）
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-field">
                    <FieldLabel optional>声明推理等级</FieldLabel>
                    <select
                      className="input-cockpit"
                      value={(form.reasoningEffort as string | undefined) || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          reasoningEffort: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">不写入（Droid 自动推断）</option>
                      {REASONING_EFFORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="form-field-hint mt-1">
                      已按 Droid 0.159.1 实测：未匹配内置模型时，填 high 会显示“推理已禁用/低/中/高”，填 max 会额外显示“最大”；其中 max 只是菜单档位，未知自定义模型选 max 本身不会自动传更大预算。
                    </p>
                  </div>

                  <div className="form-field">
                    <FieldLabel optional>基础模型 ID</FieldLabel>
                    <input
                      className="input-cockpit font-mono-sm"
                      value={(form.baseModelId as string | undefined) || ""}
                      onChange={(e) =>
                        setForm({ ...form, baseModelId: e.target.value || undefined })
                      }
                      placeholder="例如: glm-5.2"
                    />
                    <p className="form-field-hint mt-1">
                      Droid 兼容字段；用于保留已有配置。实测它不会替代 model 字符串匹配，也不会让 xopglm52 继承 GLM-5.2 的 max 逻辑。
                    </p>
                  </div>

                  <div className="form-field">
                    <FieldLabel optional>固定思考预算 Token</FieldLabel>
                    <input
                      className="input-cockpit"
                      type="number"
                      value={form.thinkingMaxTokens ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          thinkingMaxTokens: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="例如: 24576"
                    />
                    <p className="form-field-hint mt-1">
                      留空时 Droid 按推理等级换算默认预算：low=4096、medium=12288、high=24576；max 不是预算值。填写后会固定覆盖所有等级，实测连 off 也会发送这个预算。
                    </p>
                    {form.thinkingMaxTokens !== undefined && (
                      <div className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                        当前已进入固定预算模式：低/中/高/最大不再对应不同预算；如果想保留等级梯度，请清空该字段。
                      </div>
                    )}
                  </div>

                  <div className="form-field">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="toggle-cockpit"
                        checked={form.enableThinking === true}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            enableThinking: e.target.checked ? true : undefined,
                          })
                        }
                      />
                      <span className="form-field-label">
                        Thinking 兼容开关 <span className="optional-mark">（可选）</span>
                      </span>
                    </label>
                    <p className="form-field-hint mt-1">
                      兼容 Droid 现有字段。对 xopglm52 实测，菜单和 low/medium/high thinking 主要由“声明推理等级”决定；通常不需要再手写 extraArgs。
                    </p>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="toggle-cockpit"
                      checked={form.useInRouter === true}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          useInRouter: e.target.checked ? true : undefined,
                        })
                      }
                    />
                    <span className="form-field-label">
                      允许加入 Router 候选 <span className="optional-mark">（可选）</span>
                    </span>
                  </label>
                </div>

                <div className="form-field">
                  <label className="form-field-hint">
                    extraArgs (JSON)（可选）- 仅用于特殊后端参数；推理菜单和常规 thinking 请优先使用上面的字段
                  </label>
                  <textarea
                    className="input-cockpit font-mono-sm"
                    style={{ height: "6rem" }}
                    value={extraArgsText}
                    onChange={(e) => setExtraArgsText(e.target.value)}
                    placeholder='{"temperature": 0.7}'
                  />
                  <p className="form-field-hint mt-1">
                    不建议在这里重复写 thinking.budget_tokens；否则可能和 Droid 自动生成的 thinking 配置冲突。
                  </p>
                </div>
                <div className="form-field">
                  <label className="form-field-hint">
                    extraHeaders (JSON)（可选）- 额外 HTTP 头；从本地 settings 读取到的已有配置会保留
                  </label>
                  <textarea
                    className="input-cockpit font-mono-sm"
                    style={{ height: "5rem" }}
                    value={extraHeadersText}
                    onChange={(e) => setExtraHeadersText(e.target.value)}
                    placeholder='{"X-Custom-Header": "value"}'
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="alert-cockpit alert-cockpit-error mt-3">
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-cockpit btn-cockpit-ghost" onClick={handleClose}>
              取消
            </button>
            <button className="btn-cockpit btn-cockpit-primary" onClick={handleSave}>
              {isEdit ? "保存" : "添加"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
