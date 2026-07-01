import { useState } from "react";
import { getEffectiveModel, useAppStore } from "../../stores/appStore";
import { ModelCard } from "./ModelCard";
import { ModelForm } from "./ModelForm";
import { Plus, Search, Eye, EyeOff, Star, LayoutGrid, List, Rows3, KeyRound } from "lucide-react";
import type { CustomModel } from "../../types";
import { maskApiKey } from "../../utils/tauri";

type ViewMode = "card" | "list" | "compact";

export function ModelsPage() {
  const {
    allModels,
    shownModelIds,
    settings,
    showModelForm,
    setShowModelForm,
    setEditingModel,
    toggleModelShown,
    updateSettings,
    updateModel,
    removeModel,
  } = useAppStore();

  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | "shown" | "hidden" | "default">("all");
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem("droid-cockpit-model-view");
    return stored === "list" || stored === "compact" || stored === "card" ? stored : "card";
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem("droid-cockpit-model-view", mode);
  };

  const defaultModelId = getEffectiveModel(settings);
  const openCodeGoModels = allModels.filter((model) =>
    (model.id || "").startsWith("custom:opencode-go-") ||
    model.baseUrl.trim().replace(/\/+$/, "") === "https://opencode.ai/zen/go/v1",
  );

  const filtered = allModels.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.model.toLowerCase().includes(q) ||
      (m.displayName || "").toLowerCase().includes(q) ||
      m.baseUrl.toLowerCase().includes(q);

    const matchesProvider = !filterProvider || m.provider === filterProvider;

    const key = m.id || m.model;
    const isShown = shownModelIds.includes(key);
    const matchesCategory =
      filterCategory === "all" ||
      (filterCategory === "shown" && isShown) ||
      (filterCategory === "hidden" && !isShown) ||
      (filterCategory === "default" && key === defaultModelId);

    return matchesSearch && matchesProvider && matchesCategory;
  });

  const handleAdd = () => {
    setEditingModel(null);
    setShowModelForm(true);
  };

  const providerCounts = allModels.reduce(
    (acc, m) => {
      acc[m.provider] = (acc[m.provider] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const filterButtons = [
    { id: "all" as const, label: "全部", count: allModels.length },
    { id: "shown" as const, label: "已展示", count: shownModelIds.length },
    { id: "hidden" as const, label: "已隐藏", count: allModels.length - shownModelIds.length },
    { id: "default" as const, label: "默认", count: defaultModelId ? 1 : 0 },
  ];

  const viewModes: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "card", icon: <LayoutGrid size={14} />, label: "卡片" },
    { id: "list", icon: <List size={14} />, label: "列表" },
    { id: "compact", icon: <Rows3 size={14} />, label: "紧凑" },
  ];

  const handleSetDefault = (modelKey: string) => {
    updateSettings({
      model: undefined,
      sessionDefaultSettings: {
        ...(settings.sessionDefaultSettings || {}),
        model: modelKey,
      },
    });
  };

  const handleDelete = (model: CustomModel) => {
    if (confirm(`确定删除模型 "${model.displayName || model.model}" 吗？`)) {
      removeModel(model.id || model.model);
    }
  };

  const handleBulkSetOpenCodeGoKey = () => {
    if (openCodeGoModels.length === 0) return;
    const apiKey = prompt(
      `请输入 OpenCode Go API Key。将写入 ${openCodeGoModels.length} 个 OpenCode Go 模型；不会自动展示到 settings.json。`,
    );
    const trimmed = apiKey?.trim();
    if (!trimmed) return;
    openCodeGoModels.forEach((model) => {
      updateModel(model.id || model.model, { apiKey: trimmed });
    });
    alert(`已为 ${openCodeGoModels.length} 个 OpenCode Go 模型写入 API Key。请手动点击“展示”启用需要的模型。`);
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-6xl mx-auto">
        {/* Info banner */}
        <div className="alert-cockpit alert-cockpit-info mb-5">
          <div>
            <b>展示机制：</b> 所有模型保留在应用内，只有点击 <Eye size={12} className="inline" />{" "}
            <b>"展示"</b> 的模型才会写入 <code className="font-mono-sm bg-base-300 px-1 rounded">settings.json</code> 的{" "}
            <code className="font-mono-sm bg-base-300 px-1 rounded">customModels</code> 数组，被 Droid CLI 识别。
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 min-w-[200px] relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              className="input-cockpit pl-9"
              placeholder="搜索模型名称、ID 或 URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-cockpit"
            style={{ width: "auto" }}
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
          >
            <option value="">所有协议</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="generic-chat-completion-api">Chat Completions</option>
          </select>

          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--color-base-300)" }}>
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  filterCategory === btn.id
                    ? { color: "var(--color-primary)", background: "var(--color-base-100)" }
                    : { color: "var(--color-neutral)" }
                }
                onClick={() => setFilterCategory(btn.id)}
              >
                {btn.label} <span className="opacity-60">({btn.count})</span>
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="view-toggle">
            {viewModes.map((vm) => (
              <button
                key={vm.id}
                className={`view-toggle-btn ${viewMode === vm.id ? "active" : ""}`}
                onClick={() => setViewMode(vm.id)}
                title={vm.label}
              >
                {vm.icon}
                <span className="hidden sm:inline">{vm.label}</span>
              </button>
            ))}
          </div>

          <button className="btn-cockpit btn-cockpit-primary" onClick={handleAdd}>
            <Plus size={15} /> 新增模型
          </button>
          {openCodeGoModels.length > 0 && (
            <button className="btn-cockpit btn-cockpit-outline" onClick={handleBulkSetOpenCodeGoKey}>
              <KeyRound size={15} /> 批量填 Go Key
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted">
          <span>
            共 <b className="text-strong">{allModels.length}</b> 个模型
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} style={{ color: "#10b981" }} />
            展示 <b style={{ color: "#10b981" }}>{shownModelIds.length}</b>
          </span>
          <span className="flex items-center gap-1">
            <EyeOff size={13} className="text-faint" />
            隐藏 <b className="text-faint">{allModels.length - shownModelIds.length}</b>
          </span>
          {defaultModelId && (
            <span className="flex items-center gap-1">
              <Star size={13} style={{ color: "#f59e0b" }} fill="currentColor" />
              默认: <b className="text-strong">{defaultModelId}</b>
            </span>
          )}
          {Object.entries(providerCounts).map(([p, c]) => (
            <span key={p}>
              {p}: <b className="text-strong">{c}</b>
            </span>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={32} />
            </div>
            <div className="empty-state-title">
              {allModels.length === 0 ? "还没有配置任何模型" : "没有匹配的模型"}
            </div>
            <div className="empty-state-desc">
              {allModels.length === 0
                ? "点击「新增模型」从官方供应商预设开始配置"
                : "尝试调整搜索或筛选条件"}
            </div>
            {allModels.length === 0 && (
              <button className="btn-cockpit btn-cockpit-primary mt-5" onClick={handleAdd}>
                <Plus size={15} /> 添加第一个模型
              </button>
            )}
          </div>
        ) : viewMode === "card" ? (
          /* Card view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((model) => {
              const key = model.id || model.model;
              return (
                <ModelCard
                  key={key}
                  model={model}
                  shown={shownModelIds.includes(key)}
                  isDefault={key === defaultModelId}
                />
              );
            })}
          </div>
        ) : viewMode === "list" ? (
          /* List view */
          <div className="cockpit-card overflow-hidden">
            <div className="model-list-header">
              <div>模型</div>
              <div>协议</div>
              <div>Base URL</div>
              <div>最大输出</div>
              <div className="text-center">展示</div>
              <div className="text-center">默认</div>
              <div className="text-right">操作</div>
            </div>
            {filtered.map((model) => {
              const key = model.id || model.model;
              const shown = shownModelIds.includes(key);
              const isDefault = key === defaultModelId;
              const providerClass =
                model.provider === "anthropic"
                  ? "provider-anthropic"
                  : model.provider === "openai"
                    ? "provider-openai"
                    : "provider-generic";
              return (
                <div key={key} className="model-list-row">
                  <div className="min-w-0">
                    <div className="font-medium truncate text-strong">{model.displayName || model.model}</div>
                    <div className="font-mono-sm text-faint truncate">{model.model}</div>
                  </div>
                  <div>
                    <span className={`cockpit-badge ${providerClass}`}>
                      {model.provider === "anthropic" ? "Anthropic" : model.provider === "openai" ? "OpenAI" : "Chat"}
                    </span>
                  </div>
                  <div className="font-mono-sm text-muted truncate">{model.baseUrl}</div>
                  <div className="text-muted">
                    {model.maxOutputTokens ? `${(model.maxOutputTokens / 1000).toFixed(0)}K` : "—"}
                  </div>
                  <div className="text-center">
                    <button
                      className={`btn-icon ${shown ? "" : "opacity-50"}`}
                      onClick={() => toggleModelShown(key)}
                      title={shown ? "已展示" : "已隐藏"}
                    >
                      {shown ? <Eye size={14} style={{ color: "#10b981" }} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                  <div className="text-center">
                    {isDefault ? (
                      <Star size={14} style={{ color: "#f59e0b" }} fill="currentColor" className="inline" />
                    ) : (
                      <button
                        className="btn-icon"
                        onClick={() => handleSetDefault(key)}
                        title="设为默认"
                      >
                        <Star size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end gap-0.5">
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(model)}
                      title="删除"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Compact view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {filtered.map((model) => {
              const key = model.id || model.model;
              const shown = shownModelIds.includes(key);
              const isDefault = key === defaultModelId;
              const providerClass =
                model.provider === "anthropic"
                  ? "provider-anthropic"
                  : model.provider === "openai"
                    ? "provider-openai"
                    : "provider-generic";
              return (
                <div key={key} className="cockpit-card-compact flex items-center gap-2">
                  <button
                    className="btn-icon flex-shrink-0"
                    onClick={() => toggleModelShown(key)}
                    title={shown ? "已展示" : "已隐藏"}
                  >
                    {shown ? <Eye size={14} style={{ color: "#10b981" }} /> : <EyeOff size={14} className="text-faint" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm truncate text-strong">
                        {model.displayName || model.model}
                      </span>
                      {isDefault && (
                        <Star size={11} style={{ color: "#f59e0b" }} fill="currentColor" className="flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`cockpit-badge ${providerClass}`} style={{ fontSize: "0.6rem", padding: "0.05rem 0.35rem" }}>
                        {model.provider === "anthropic" ? "A" : model.provider === "openai" ? "O" : "G"}
                      </span>
                      <span className="font-mono-sm text-faint truncate">{maskApiKey(model.apiKey)}</span>
                    </div>
                  </div>
                  <button
                    className="btn-icon flex-shrink-0"
                    onClick={() => handleDelete(model)}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model form modal */}
      {showModelForm && <ModelForm />}
    </div>
  );
}
