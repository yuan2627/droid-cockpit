import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { writeMcpConfig } from "../../utils/tauri";
import {
  Server, Plus, Pencil, Trash2, X, Terminal, Globe,
} from "lucide-react";
import type { McpServerSpec } from "../../types";

export function McpPage() {
  const { mcpConfig, setMcpConfig } = useAppStore();
  const [editing, setEditing] = useState<{
    name: string;
    spec: McpServerSpec;
    isNew: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const servers = Object.entries(mcpConfig.mcpServers || {});

  const handleSave = async (name: string, spec: McpServerSpec, oldName?: string) => {
    setSaving(true);
    try {
      const next = { ...mcpConfig.mcpServers };
      if (oldName && oldName !== name) {
        delete next[oldName];
      }
      next[name] = spec;
      const newConfig = { mcpServers: next };
      await writeMcpConfig(newConfig);
      setMcpConfig(newConfig);
      setEditing(null);
    } catch (e) {
      console.error("Failed to save MCP config:", e);
      alert("保存失败: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除 MCP 服务器 "${name}" 吗？`)) return;
    const next = { ...mcpConfig.mcpServers };
    delete next[name];
    const newConfig = { mcpServers: next };
    try {
      await writeMcpConfig(newConfig);
      setMcpConfig(newConfig);
    } catch (e) {
      alert("删除失败: " + String(e));
    }
  };

  const getTypeIcon = (type?: string) => {
    if (type === "http" || type === "sse") return <Globe size={14} />;
    return <Terminal size={14} />;
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <Server size={20} style={{ color: "var(--color-primary)" }} /> MCP 服务器
            </h2>
            <p className="text-sm text-muted mt-0.5">
              管理 Model Context Protocol 服务器配置
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="cockpit-badge cockpit-badge-ghost">
              {servers.length} 个服务器
            </span>
            <button
              className="btn-cockpit btn-cockpit-primary"
              onClick={() =>
                setEditing({
                  name: "",
                  spec: { type: "stdio", command: "", args: [] },
                  isNew: true,
                })
              }
            >
              <Plus size={15} /> 新增
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="alert-cockpit alert-cockpit-info mb-5">
          <div>
            MCP 配置存储在 <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>~/.factory/mcp.json</code>。
            可通过 <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>droid mcp</code> 命令管理。
          </div>
        </div>

        {servers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Server size={32} />
            </div>
            <div className="empty-state-title">暂无 MCP 服务器</div>
            <div className="empty-state-desc">
              添加 MCP 服务器以扩展 Droid 的工具能力
            </div>
            <button
              className="btn-cockpit btn-cockpit-primary mt-5"
              onClick={() =>
                setEditing({
                  name: "",
                  spec: { type: "stdio", command: "", args: [] },
                  isNew: true,
                })
              }
            >
              <Plus size={15} /> 添加第一个服务器
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {servers.map(([name, spec]) => (
              <div key={name} className="cockpit-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 stat-icon-primary"
                    >
                      {getTypeIcon(spec.type)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-strong truncate">{name}</h3>
                      <span className="cockpit-badge cockpit-badge-ghost mt-0.5">
                        {spec.type || "stdio"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button
                      className="btn-icon"
                      onClick={() => setEditing({ name, spec, isNew: false })}
                      title="编辑"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(name)}
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div
                  className="mt-3 space-y-1.5 text-xs"
                  style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.75rem" }}
                >
                  {spec.type === "http" || spec.type === "sse" ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-faint flex-shrink-0">URL</span>
                      <span className="font-mono-sm text-muted truncate text-right">
                        {spec.url}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between gap-2">
                        <span className="text-faint flex-shrink-0">命令</span>
                        <span className="font-mono-sm text-muted truncate text-right">
                          {spec.command}
                        </span>
                      </div>
                      {spec.args && spec.args.length > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-faint flex-shrink-0">参数</span>
                          <span className="font-mono-sm text-muted truncate text-right">
                            {spec.args.join(" ")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {spec.env && Object.keys(spec.env).length > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-faint flex-shrink-0">环境变量</span>
                      <span className="text-muted">{Object.keys(spec.env).length} 个</span>
                    </div>
                  )}
                  {spec.timeoutMs && (
                    <div className="flex justify-between gap-2">
                      <span className="text-faint flex-shrink-0">超时</span>
                      <span className="text-muted">{(spec.timeoutMs / 1000).toFixed(0)}s</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <McpEditModal
            name={editing.name}
            spec={editing.spec}
            isNew={editing.isNew}
            saving={saving}
            onSave={handleSave}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    </div>
  );
}

function McpEditModal({
  name,
  spec,
  isNew,
  saving,
  onSave,
  onClose,
}: {
  name: string;
  spec: McpServerSpec;
  isNew: boolean;
  saving: boolean;
  onSave: (name: string, spec: McpServerSpec, oldName?: string) => void;
  onClose: () => void;
}) {
  const [editName, setEditName] = useState(name);
  const [editSpec, setEditSpec] = useState<McpServerSpec>(spec);
  const [argsText, setArgsText] = useState((spec.args || []).join("\n"));
  const [envText, setEnvText] = useState(
    Object.entries(spec.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );
  const [headersText, setHeadersText] = useState(
    Object.entries(spec.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  );
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    if (!editName.trim()) {
      setError("服务器名称不能为空");
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(editName.trim())) {
      setError("服务器名称只能包含字母、数字、点、下划线和连字符");
      return;
    }

    const type = editSpec.type || "stdio";
    const finalSpec: McpServerSpec = { ...editSpec, type };

    if (type === "stdio") {
      if (!finalSpec.command?.trim()) {
        setError("stdio 类型必须填写 command");
        return;
      }
      finalSpec.args = argsText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const env: Record<string, string> = {};
      for (const line of envText.split("\n").filter((value) => value.trim())) {
        const idx = line.indexOf("=");
        const key = line.slice(0, idx).trim();
        if (idx <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          setError(`环境变量格式错误: ${line}`);
          return;
        }
        env[key] = line.slice(idx + 1).trim();
      }
      if (Object.keys(env).length > 0) finalSpec.env = env;
      else delete finalSpec.env;
      delete finalSpec.url;
      delete finalSpec.headers;
    } else {
      if (!finalSpec.url?.trim()) {
        setError(`${type} 类型必须填写 URL`);
        return;
      }
      try {
        const url = new URL(finalSpec.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      } catch {
        setError("URL 必须是有效的 http(s) 地址");
        return;
      }
      const headers: Record<string, string> = {};
      for (const line of headersText.split("\n").filter((value) => value.trim())) {
        const idx = line.indexOf(":");
        const key = line.slice(0, idx).trim();
        if (idx <= 0 || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)) {
          setError(`请求头格式错误: ${line}`);
          return;
        }
        headers[key] = line.slice(idx + 1).trim();
      }
      if (Object.keys(headers).length > 0) finalSpec.headers = headers;
      else delete finalSpec.headers;
      delete finalSpec.command;
      delete finalSpec.args;
      delete finalSpec.env;
    }

    if (finalSpec.timeoutMs !== undefined && (!Number.isInteger(finalSpec.timeoutMs) || finalSpec.timeoutMs <= 0)) {
      setError("超时必须是正整数毫秒数");
      return;
    }

    onSave(editName.trim(), finalSpec, isNew ? undefined : name);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-strong">
              {isNew ? "新增 MCP 服务器" : "编辑 MCP 服务器"}
            </h2>
            <button className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="form-field">
              <label className="form-field-label">服务器名称 *</label>
              <input
                className="input-cockpit"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例如: filesystem"
                disabled={!isNew}
              />
            </div>

            <div className="form-field">
              <label className="form-field-label">类型</label>
              <select
                className="input-cockpit"
                value={editSpec.type || "stdio"}
                onChange={(e) =>
                  setEditSpec({ ...editSpec, type: e.target.value as McpServerSpec["type"] })
                }
              >
                <option value="stdio">stdio (本地进程)</option>
                <option value="http">http (远程 HTTP)</option>
                {editSpec.type === "sse" && (
                  <option value="sse" disabled>sse (旧配置，仅兼容读取)</option>
                )}
              </select>
            </div>

            {(editSpec.type || "stdio") === "stdio" ? (
              <>
                <div className="form-field">
                  <label className="form-field-label">命令 *</label>
                  <input
                    className="input-cockpit font-mono-sm"
                    value={editSpec.command || ""}
                    onChange={(e) =>
                      setEditSpec({ ...editSpec, command: e.target.value })
                    }
                    placeholder="例如: npx"
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">参数 (每行一个，空格会保留在参数内)</label>
                  <textarea
                    className="input-cockpit font-mono-sm"
                    value={argsText}
                    onChange={(e) => setArgsText(e.target.value)}
                    placeholder={"-y\n@modelcontextprotocol/server-filesystem\nD:\\workspace"}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">环境变量 (每行 KEY=VALUE)</label>
                  <textarea
                    className="input-cockpit font-mono-sm"
                    value={envText}
                    onChange={(e) => setEnvText(e.target.value)}
                    placeholder={"API_KEY=xxx\nDEBUG=true"}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label className="form-field-label">URL *</label>
                  <input
                    className="input-cockpit font-mono-sm"
                    value={editSpec.url || ""}
                    onChange={(e) => setEditSpec({ ...editSpec, url: e.target.value })}
                    placeholder="https://example.com/mcp"
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">请求头 (每行 KEY: VALUE)</label>
                  <textarea
                    className="input-cockpit font-mono-sm"
                    value={headersText}
                    onChange={(e) => setHeadersText(e.target.value)}
                    placeholder={"Authorization: Bearer xxx"}
                  />
                </div>
              </>
            )}

            <div className="form-field">
              <label className="form-field-label">超时 (毫秒，可选)</label>
              <input
                className="input-cockpit"
                type="number"
                value={editSpec.timeoutMs ?? ""}
                onChange={(e) =>
                  setEditSpec({
                    ...editSpec,
                    timeoutMs: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="留空使用默认值"
              />
            </div>
          </div>

          {error && (
            <div className="alert-cockpit alert-cockpit-error mt-4">
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button className="btn-cockpit btn-cockpit-ghost" onClick={onClose}>
              取消
            </button>
            <button
              className="btn-cockpit btn-cockpit-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
