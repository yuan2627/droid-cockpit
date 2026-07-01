import { useState, useEffect } from "react";
import {
  listBackups, createBackup, restoreBackup, deleteBackup,
  importBackupBundle,
  type BackupInfo,
} from "../../utils/tauri";
import { useAppStore } from "../../stores/appStore";
import {
  Download, Upload, Save, RotateCcw, Trash2, RefreshCw, Database, FileJson,
} from "lucide-react";

const REDACTED = "***REDACTED***";

function isSecretKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return [
    "apikey",
    "authorization",
    "authheader",
    "password",
    "passwd",
    "secret",
    "clientsecret",
    "token",
    "accesstoken",
    "refreshtoken",
    "privatekey",
    "credential",
    "bearer",
  ].some((part) => normalized === part || normalized.endsWith(part));
}

function isSecretContainer(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ["env", "environment", "headers", "extraheaders"].includes(normalized);
}

function redactInlineSecret(value: string) {
  return value
    .replace(/([?&](?:api[_-]?key|access[_-]?token|token|secret|password)=)[^&#\s]+/gi, `$1${REDACTED}`)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`);
}

function redactConfig(value: unknown, parentKey = "", forceStringRedaction = false): unknown {
  if (typeof value === "string") {
    if (forceStringRedaction || isSecretKey(parentKey)) return REDACTED;
    return redactInlineSecret(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactConfig(item, parentKey, forceStringRedaction || isSecretContainer(parentKey)));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      if (isSecretKey(key)) {
        return [key, REDACTED];
      }
      return [key, redactConfig(child, key, forceStringRedaction || isSecretContainer(parentKey) || isSecretContainer(key))];
    }),
  );
}

export function DataSettings() {
  const { settings, mcpConfig, allModels, shownModelIds, sortOrder } = useAppStore();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const list = await listBackups();
      setBackups(list);
    } catch (e) {
      setMsg("加载备份失败: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      const name = await createBackup();
      setMsg(`已创建备份: ${name}`);
      await fetchBackups();
    } catch (e) {
      setMsg("创建备份失败: " + String(e));
    }
  };

  const handleRestore = async (name: string) => {
    if (!confirm(`确定从备份 ${name} 恢复吗？当前 settings.json、mcp.json 和 cockpit-models.json 会先自动备份，再被覆盖。`)) return;
    try {
      await restoreBackup(name);
      window.location.reload();
    } catch (e) {
      setMsg("恢复失败: " + String(e));
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除备份 ${name} 吗？`)) return;
    try {
      await deleteBackup(name);
      await fetchBackups();
    } catch (e) {
      setMsg("删除失败: " + String(e));
    }
  };

  const handleExport = (includeSecrets: boolean) => {
    if (includeSecrets && !confirm("完整导出会包含 API Key、MCP Header 和环境变量明文。只应保存到可信位置。继续？")) {
      return;
    }
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      mcpConfig,
      cockpitModels: { allModels, shownModelIds, sortOrder },
    };
    const data = includeSecrets ? bundle : redactConfig(bundle);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `droid-cockpit-${includeSecrets ? "full" : "redacted"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(includeSecrets ? "已导出完整配置（包含敏感信息）" : "已导出脱敏配置（仅用于审阅，不可直接恢复密钥）");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      if (content.includes(`"${REDACTED}"`)) {
        throw new Error("脱敏导出仅用于审阅，不能导入恢复；请使用完整导出或备份包");
      }
      const data = JSON.parse(content);
      if (!data || typeof data !== "object" || !data.settings || !data.mcpConfig || !data.cockpitModels) {
        throw new Error("不是有效的 Droid Cockpit 配置包");
      }
      if (!confirm("导入会先自动备份当前三份配置，再应用所选文件。确认继续？")) return;
      await importBackupBundle(content);
      window.location.reload();
    } catch (err) {
      setMsg("导入失败: " + String(err));
    } finally {
      e.target.value = "";
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString("zh-CN");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="page-container">
      <div style={{ maxWidth: "48rem" }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-strong">
            <Database size={24} style={{ color: "var(--color-primary)" }} /> 数据管理
          </h2>
          <p className="text-sm text-muted">
            配置导入导出、自动备份与恢复
          </p>
        </div>

        {msg && (
          <div className="alert-cockpit alert-cockpit-info mb-4">
            <span>{msg}</span>
          </div>
        )}

        {/* Export / Import */}
        <div className="cockpit-card mb-6">
          <div className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-strong">
              <FileJson size={18} style={{ color: "var(--color-primary)" }} /> 导入 / 导出
            </h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn-cockpit btn-cockpit-primary" onClick={() => handleExport(false)}>
                <Download size={14} /> 脱敏导出
              </button>
              <button className="btn-cockpit btn-cockpit-outline" onClick={() => handleExport(true)}>
                <Download size={14} /> 完整导出（含密钥）
              </button>
              <label className="btn-cockpit btn-cockpit-outline cursor-pointer">
                <Upload size={14} /> 导入配置
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </div>
            <p className="text-xs text-muted mt-2">
              配置包包含 settings.json、mcp.json 和 cockpit-models.json。导入和恢复前会自动备份当前配置；
              脱敏文件仅用于审阅，不能恢复被隐藏的密钥。
            </p>
          </div>
        </div>

        {/* Backups */}
        <div className="cockpit-card">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-strong">
                <Save size={18} style={{ color: "var(--color-primary)" }} /> 配置备份
              </h3>
              <div className="flex gap-1">
                <button
                  className="btn-cockpit btn-cockpit-ghost"
                  style={{ fontSize: "0.72rem", padding: "0.3rem 0.55rem" }}
                  onClick={fetchBackups}
                  disabled={loading}
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> 刷新
                </button>
                <button
                  className="btn-cockpit btn-cockpit-primary"
                  style={{ fontSize: "0.72rem", padding: "0.3rem 0.55rem" }}
                  onClick={handleCreateBackup}
                >
                  <Save size={12} /> 立即备份
                </button>
              </div>
            </div>

            <p className="text-xs text-muted mb-3">
              版本化完整备份存储在{" "}
              <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>~/.factory/cockpit-backups/</code>，
              保留最近 10 个。
            </p>

            {backups.length === 0 ? (
              <div className="text-center py-8 text-faint">
                <Save size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无备份</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between rounded-md px-3 py-2"
                    style={{ background: "var(--color-base-300)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono-sm text-muted truncate">{b.name}</div>
                      <div className="text-xs text-faint">
                        {formatTime(b.timestamp)} · {formatSize(b.size)}
                      </div>
                    </div>
                    <div className="flex gap-0.5 ml-2">
                      <button
                        className="btn-icon"
                        onClick={() => handleRestore(b.name)}
                        title="恢复"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => handleDelete(b.name)}
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
