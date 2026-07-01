import { useEffect, useMemo, useState, useCallback } from "react";
import { Bot, FileText, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import {
  deleteDroid,
  listDroids,
  readDroid,
  writeDroid,
  type DroidInfo,
} from "../../utils/tauri";
import { TTLCache } from "../../utils/helpers";
import { CACHE_TTL } from "../../config/app";

// Module-level cache for droids list — avoids refetching on every page visit
const droidsCache = new TTLCache<DroidInfo[]>(CACHE_TTL.MEDIUM);

function newDroidTemplate(name: string) {
  const safeName = name || "my-droid";
  return `---
name: ${safeName}
description: Describe when Droid should use this custom droid.
model: inherit
---
# ${safeName}

Describe this droid's role, workflow, constraints, and expected output.
`;
}

export function DroidsPage() {
  const [droids, setDroids] = useState<DroidInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [query, setQuery] = useState("");
  const dirty = content !== original;
  const filteredDroids = useMemo(
    () =>
      droids.filter((item) => {
        const text = `${item.id} ${item.name || ""} ${item.description || ""} ${item.model || ""}`.toLowerCase();
        return text.includes(query.trim().toLowerCase());
      }),
    [droids, query],
  );

  const loadList = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const list = await droidsCache.get(() => listDroids(), force);
      setDroids(list);
    } catch (e) {
      setError("加载自定义 Droid 失败：" + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const confirmDiscard = () => !dirty || confirm("当前 Droid 有未保存修改，确定放弃吗？");

  const handleSelect = async (item: DroidInfo) => {
    if (!confirmDiscard()) return;
    setError("");
    try {
      const text = await readDroid(item.id);
      setSelected(item.id);
      setName(item.id);
      setContent(text);
      setOriginal(text);
      setIsNew(false);
    } catch (e) {
      setError("读取失败: " + String(e));
    }
  };

  const handleNew = () => {
    if (!confirmDiscard()) return;
    const initialName = "my-droid";
    const template = newDroidTemplate(initialName);
    setSelected(null);
    setName(initialName);
    setContent(template);
    setOriginal("");
    setIsNew(true);
    setError("");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (isNew && content === newDroidTemplate(name)) {
      setContent(newDroidTemplate(value));
    }
  };

  const handleSave = async () => {
    const id = name.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      setError("文件名只能包含字母、数字、点、下划线和连字符，且必须以字母或数字开头");
      return;
    }
    if (isNew && droids.some((item) => item.id === id)) {
      setError("同名自定义 Droid 已存在");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await writeDroid(id, content);
      setSelected(id);
      setIsNew(false);
      setOriginal(content);
      await loadList(true);
    } catch (e) {
      setError("保存失败: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !confirm(`确定将自定义 Droid“${selected}”移到 Droid Cockpit 回收站吗？`)) return;
    setError("");
    try {
      await deleteDroid(selected);
      setSelected(null);
      setName("");
      setContent("");
      setOriginal("");
      await loadList(true);
    } catch (e) {
      setError("删除失败: " + String(e));
    }
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <Bot size={20} style={{ color: "var(--color-primary)" }} /> Droid 管理
            </h2>
            <p className="text-sm text-muted mt-0.5">管理个人级 ~/.factory/droids/*.md 子代理定义</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-cockpit btn-cockpit-ghost" disabled={loading} onClick={() => {
              if (confirmDiscard()) loadList(true);
            }}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 刷新
            </button>
            <button className="btn-cockpit btn-cockpit-primary" onClick={handleNew}>
              <Plus size={14} /> 新建
            </button>
          </div>
        </div>

        <div className="alert-cockpit alert-cockpit-info mb-4">
          <div>
            这里管理个人级自定义 Droid。项目根目录的 <code className="font-mono-sm">.factory/droids/</code> 会按 Droid 规则覆盖同名个人定义；
            Mission 内置 Droid 也可能由 Droid 更新，请修改前确认用途。
          </div>
        </div>

        <div className="cockpit-card p-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="input-cockpit pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 Droid 名称、描述或模型"
            />
          </div>
        </div>

        {error && <div className="alert-cockpit alert-cockpit-error mb-4"><span>{error}</span></div>}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)] gap-4">
          <div className="cockpit-card overflow-hidden">
            <div className="cockpit-card-header">
              <span className="cockpit-card-title">个人 Droids</span>
              <span className="cockpit-badge cockpit-badge-ghost">{droids.length}</span>
            </div>
            <div className="p-2 max-h-[65vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-10"><div className="loading-cockpit" /></div>
              ) : filteredDroids.length === 0 ? (
                <div className="text-sm text-faint text-center py-10">
                  {droids.length === 0 ? "暂无个人自定义 Droid" : "没有匹配的自定义 Droid"}
                </div>
              ) : filteredDroids.map((item) => (
                <button
                  key={item.id}
                  className={`w-full text-left rounded-md p-3 mb-1 transition-colors ${selected === item.id ? "nav-item active !mx-0" : ""}`}
                  style={selected === item.id ? undefined : { background: "transparent" }}
                  onClick={() => handleSelect(item)}
                >
                  <div className="flex items-start gap-2">
                    <FileText size={15} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-strong truncate">{item.name || item.id}</div>
                      <div className="text-xs text-faint line-clamp-2 mt-0.5">{item.description || "无描述"}</div>
                      <div className="text-xs font-mono-sm text-faint mt-1">{item.model || "inherit"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isNew || selected ? (
            <div className="cockpit-card overflow-hidden">
              <div className="cockpit-card-header gap-3">
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-faint block mb-1">文件标识</label>
                  <input
                    className="input-cockpit font-mono-sm"
                    value={name}
                    disabled={!isNew}
                    onChange={(event) => handleNameChange(event.target.value)}
                  />
                </div>
                <div className="flex gap-2 self-end">
                  {!isNew && (
                    <button className="btn-cockpit btn-cockpit-ghost" onClick={handleDelete}>
                      <Trash2 size={14} /> 移到回收站
                    </button>
                  )}
                  <button className="btn-cockpit btn-cockpit-primary" disabled={saving || (!dirty && !isNew)} onClick={handleSave}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} 保存
                  </button>
                </div>
              </div>
              <textarea
                className="w-full min-h-[55vh] p-4 outline-none resize-y font-mono text-sm"
                style={{ background: "var(--color-base-300)", color: "var(--color-base-content)", border: "none" }}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
              />
              <div className="px-4 py-2 text-xs text-faint">
                必需 frontmatter：name、description；可选 model、reasoningEffort、tools。正文定义行为和输出要求。
              </div>
            </div>
          ) : (
            <div className="empty-state cockpit-card">
              <div className="empty-state-icon"><Bot size={32} /></div>
              <div className="empty-state-title">选择或新建自定义 Droid</div>
              <div className="empty-state-desc">编辑器直接保存为官方 Markdown + YAML frontmatter 格式。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
