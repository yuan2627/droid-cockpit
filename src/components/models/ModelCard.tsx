import type { CustomModel } from "../../types";
import { useAppStore } from "../../stores/appStore";
import { maskApiKey, isEnvVarKey } from "../../utils/tauri";
import {
  Pencil, Trash2, Copy, Star, Eye, EyeOff, Zap, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { useState } from "react";
import { testModelConnection, type ConnectionTestResult } from "../../utils/tauri";

interface ModelCardProps {
  model: CustomModel;
  shown: boolean;
  isDefault: boolean;
}

export function ModelCard({ model, shown, isDefault }: ModelCardProps) {
  const {
    toggleModelShown,
    setEditingModel,
    setShowModelForm,
    removeModel,
    addModel,
    settings,
    updateSettings,
  } = useAppStore();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const modelKey = model.id || model.model;
  const isEnvKey = isEnvVarKey(model.apiKey);

  const providerClass =
    model.provider === "anthropic"
      ? "provider-anthropic"
      : model.provider === "openai"
        ? "provider-openai"
        : "provider-generic";

  const providerLabel =
    model.provider === "anthropic"
      ? "Anthropic"
      : model.provider === "openai"
        ? "OpenAI"
        : "Chat API";

  const handleEdit = () => {
    setEditingModel(model);
    setShowModelForm(true);
  };

  const handleDuplicate = () => {
    const { id, index, ...rest } = model;
    addModel({ ...rest, displayName: `${model.displayName || model.model} (副本)` });
  };

  const handleDelete = () => {
    if (confirm(`确定删除模型 "${model.displayName || model.model}" 吗？\n\n此操作会从应用中移除该模型。如果该模型当前展示在 Droid 中，也会从 settings.json 移除。`)) {
      removeModel(modelKey);
    }
  };

  const handleSetDefault = () => {
    updateSettings({
      model: undefined,
      sessionDefaultSettings: {
        ...(settings.sessionDefaultSettings || {}),
        model: modelKey,
      },
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testModelConnection(
        model.baseUrl,
        model.apiKey,
        model.model,
        model.provider,
        model.extraHeaders,
      );
      setTestResult(result);
    } catch (e) {
      setTestResult({ httpCode: "0", body: String(e), success: false });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={`cockpit-card cockpit-slide-up ${isDefault ? "cockpit-card-elevated" : ""}`}
      style={isDefault ? { borderColor: "#6366f1", borderWidth: "2px" } : undefined}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-[15px] truncate tracking-tight">
                {model.displayName || model.model}
              </h3>
              {isDefault && (
                <span className="cockpit-badge cockpit-badge-warning gap-1">
                  <Star size={10} fill="currentColor" /> 默认
                </span>
              )}
            </div>
            <p className="font-mono-sm text-faint truncate">{model.model}</p>
          </div>
          <span className={`cockpit-badge ${providerClass} flex-shrink-0`}>
            {providerLabel}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-xs mb-3">
          <div className="flex justify-between items-center">
            <span className="text-faint">Base URL</span>
            <span className="font-mono-sm text-muted truncate ml-2 max-w-[60%]" title={model.baseUrl}>
              {model.baseUrl}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-faint">API Key</span>
            <span className="font-mono-sm text-muted">
              {isEnvKey ? (
                <span style={{ color: "var(--color-primary)" }}>{maskApiKey(model.apiKey)}</span>
              ) : (
                maskApiKey(model.apiKey)
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-faint">最大输出</span>
            <span className="text-muted font-medium">
              {model.maxOutputTokens
                ? `${(model.maxOutputTokens / 1000).toFixed(0)}K`
                : "默认"}
            </span>
          </div>
          {(model.noImageSupport || model.extraArgs || model.extraHeaders) && (
            <div className="flex flex-wrap gap-1 pt-1">
              {model.noImageSupport && (
                <span className="cockpit-badge cockpit-badge-ghost">无图片输入</span>
              )}
              {model.extraArgs && (
                <span className="cockpit-badge cockpit-badge-info">extraArgs</span>
              )}
              {model.extraHeaders && (
                <span className="cockpit-badge cockpit-badge-info">extraHeaders</span>
              )}
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs mb-3 ${
              testResult.success ? "alert-cockpit-success" : "alert-cockpit-error"
            }`}
            style={{ padding: "0.375rem 0.625rem" }}
          >
            {testResult.success ? (
              <CheckCircle2 size={13} />
            ) : (
              <XCircle size={13} />
            )}
            <span className="font-mono">
              {testResult.success ? "连接成功" : "连接失败"} · HTTP {testResult.httpCode}
            </span>
          </div>
        )}

        {/* Show/Hide status badge */}
        <div className="mb-3">
          {shown ? (
            <div
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "#10b981" }}
            >
              <Eye size={12} />
              已展示到 Droid settings.json
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-faint">
              <EyeOff size={12} />
              已隐藏（仅保存在应用内）
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderTopColor: "rgb(0 0 0 / 0.05)" }}>
          {/* Show toggle - the KEY additive selective write control */}
          <button
            className={`btn-cockpit text-xs ${shown ? "btn-cockpit-primary" : "btn-cockpit-outline"}`}
            onClick={() => toggleModelShown(modelKey)}
            title={shown ? "从 settings.json 中移除（不删除模型）" : "写入 settings.json 展示给 Droid"}
          >
            {shown ? (
              <>
                <Eye size={13} /> 展示中
              </>
            ) : (
              <>
                <EyeOff size={13} /> 已隐藏
              </>
            )}
          </button>

          <div className="flex gap-0.5">
            <button
              className="btn-icon"
              onClick={handleTest}
              disabled={testing}
              title="测试连接"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            </button>
            {!isDefault && (
              <button
                className="btn-icon"
                onClick={handleSetDefault}
                title="设为默认模型"
              >
                <Star size={14} />
              </button>
            )}
            <button
              className="btn-icon"
              onClick={handleEdit}
              title="编辑"
            >
              <Pencil size={14} />
            </button>
            <button
              className="btn-icon"
              onClick={handleDuplicate}
              title="复制"
            >
              <Copy size={14} />
            </button>
            <button
              className="btn-icon btn-icon-danger"
              onClick={handleDelete}
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
