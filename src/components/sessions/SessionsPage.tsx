import { useState, useEffect, useMemo, useCallback } from "react";
import {
  listSessions,
  readSessionMessages,
  deleteSession,
  searchSessions,
  type SessionInfo,
  type SessionMessage,
  type SessionSearchResult,
} from "../../utils/tauri";
import { TTLCache } from "../../utils/helpers";
import { CACHE_TTL } from "../../config/app";
import {
  History, RefreshCw, Search, MessageSquare, Clock,
  Trash2, ChevronDown, ChevronRight, FolderTree, Copy, FileSearch,
} from "lucide-react";

const PAGE_SIZE = 60;

// Module-level cache for sessions list — avoids expensive reindexing on every page visit
const sessionsCache = new TTLCache<SessionInfo[]>(CACHE_TTL.LONG);

function cleanSearchSnippet(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatTime(ts: number | string | undefined): string {
  if (!ts) return "—";
  const date = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return String(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN");
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function localDateKey(ts: number | undefined): string {
  if (!ts) return "";
  const date = new Date(ts);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [groupByProject, setGroupByProject] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [fullSearchResults, setFullSearchResults] = useState<SessionSearchResult[]>([]);
  const [searchingContent, setSearchingContent] = useState(false);
  const [hasSearchedContent, setHasSearchedContent] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchSessions = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const list = await sessionsCache.get(() => listSessions(force), force);
      setSessions(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    setPage(1);
    setFullSearchResults([]);
    setHasSearchedContent(false);
  }, [search, groupByProject, projectFilter, dateFrom, dateTo]);

  const projectOptions = useMemo(
    () =>
      Array.from(new Set(sessions.map((s) => s.cwd || s.projectDir || "未知项目")))
        .filter(Boolean)
        .sort(),
    [sessions],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sessions.filter((s) => {
      const project = s.cwd || s.projectDir || "未知项目";
      const date = localDateKey(s.lastActiveAt);
      const matchesSearch = !q || (
        (s.title || "").toLowerCase().includes(q) ||
        project.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
      const matchesProject = !projectFilter || project === projectFilter;
      const matchesDateFrom = !dateFrom || date >= dateFrom;
      const matchesDateTo = !dateTo || date <= dateTo;
      return matchesSearch && matchesProject && matchesDateFrom && matchesDateTo;
    });
  }, [sessions, search, projectFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedSessions = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const grouped = useMemo(() => {
    if (!groupByProject) {
      return [{ project: "全部", sessions: pagedSessions }];
    }
    const map = new Map<string, SessionInfo[]>();
    for (const s of pagedSessions) {
      const key = s.cwd || s.projectDir || "未知项目";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([project, sessions]) => ({ project, sessions }));
  }, [pagedSessions, groupByProject]);

  const handleFullSearch = async () => {
    const query = search.trim();
    if (query.length < 2) {
      setError("全文搜索至少需要 2 个字符");
      return;
    }
    setSearchingContent(true);
    setHasSearchedContent(true);
    setError("");
    try {
      const result = await searchSessions(query);
      setFullSearchResults(result.sessions);
    } catch (e) {
      setFullSearchResults([]);
      setError("全文搜索失败: " + String(e));
    } finally {
      setSearchingContent(false);
    }
  };

  const handleExpand = async (s: SessionInfo) => {
    const id = s.id;
    if (expandedId === id) {
      setExpandedId(null);
      setMessages([]);
      return;
    }
    setExpandedId(id);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const msgs = await readSessionMessages(id, s.projectDir || "", 50);
      setMessages(msgs);
    } catch (e) {
      setError("加载消息失败: " + String(e));
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDelete = async (s: SessionInfo) => {
    if (!confirm(`确定将会话 "${s.title || s.id.slice(0, 8)}" 移到 Droid Cockpit 回收站吗？`)) return;
    setDeleting(s.id);
    try {
      await deleteSession(s.id, s.projectDir || "");
      await fetchSessions(true);
      if (expandedId === s.id) {
        setExpandedId(null);
        setMessages([]);
      }
    } catch (e) {
      setError("删除失败: " + String(e));
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyResume = (s: SessionInfo) => {
    const cmd = `droid --resume ${s.id}`;
    navigator.clipboard?.writeText(cmd);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <History size={20} style={{ color: "var(--color-primary)" }} /> 会话管理
            </h2>
            <p className="text-sm text-muted mt-0.5">
              浏览 Factory Droid 的历史会话记录
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn-cockpit ${groupByProject ? "btn-cockpit-outline" : "btn-cockpit-ghost"}`}
              onClick={() => setGroupByProject(!groupByProject)}
            >
              <FolderTree size={14} /> {groupByProject ? "已分组" : "未分组"}
            </button>
            <button className="btn-cockpit btn-cockpit-ghost" onClick={() => fetchSessions(true)}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 刷新
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              className="input-cockpit pl-9"
              placeholder="先筛选标题、项目路径或 ID，也可搜索会话正文..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFullSearch();
              }}
            />
          </div>
          <button
            className="btn-cockpit btn-cockpit-outline"
            disabled={searchingContent || search.trim().length < 2}
            onClick={handleFullSearch}
            title="调用 Droid 原生索引搜索会话正文"
          >
            {searchingContent ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <FileSearch size={14} />
            )}
            全文搜索
          </button>
        </div>

        <div className="cockpit-card p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-muted">
              开始日期
              <input
                className="input-cockpit mt-1"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted">
              结束日期
              <input
                className="input-cockpit mt-1"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted md:col-span-2">
              项目 / 文件夹
              <div className="flex gap-2 mt-1">
                <select
                  className="input-cockpit flex-1"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">全部项目</option>
                  {projectOptions.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
                {(projectFilter || dateFrom || dateTo) && (
                  <button
                    className="btn-cockpit btn-cockpit-ghost"
                    onClick={() => {
                      setProjectFilter("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
            </label>
          </div>
          <p className="text-xs text-faint mt-2">
            标题、路径、ID 使用本地索引即时筛选；正文内容请点击“全文搜索”调用 Droid 原生索引。
          </p>
        </div>

        {error && (
          <div className="alert-cockpit alert-cockpit-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {hasSearchedContent && !searchingContent && (
          <div className="cockpit-card p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-medium text-strong">正文搜索结果</div>
              <span className="cockpit-badge cockpit-badge-ghost">
                {fullSearchResults.length} 个会话
              </span>
            </div>
            {fullSearchResults.length === 0 ? (
              <p className="text-sm text-faint">没有匹配的会话正文。</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fullSearchResults.map((result) => {
                  const snippets = result.hits.flatMap((hit) => hit.snippets).slice(0, 3);
                  return (
                    <div
                      key={result.sessionId}
                      className="p-3 rounded-md"
                      style={{ background: "var(--color-base-300)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-strong line-clamp-1">
                          {result.title || `会话 ${result.sessionId.slice(0, 8)}`}
                        </div>
                        <button
                          className="btn-icon"
                          title="复制恢复命令"
                          onClick={() => {
                            navigator.clipboard?.writeText(`droid --resume ${result.sessionId}`);
                            setCopiedId(result.sessionId);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                        >
                          {copiedId === result.sessionId ? (
                            <span style={{ color: "#34d399", fontSize: "0.7rem" }}>✓</span>
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-faint font-mono-sm mt-1">
                        {result.sessionId.slice(0, 12)} · {formatTime(result.updatedAt)}
                      </div>
                      {snippets.map((snippet, index) => (
                        <p key={index} className="text-xs text-muted mt-2 whitespace-pre-wrap break-words">
                          {cleanSearchSnippet(snippet)}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading-cockpit" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <History size={32} />
            </div>
            <div className="empty-state-title">
              {sessions.length === 0 ? "暂无会话记录" : "没有匹配的会话"}
            </div>
            <div className="empty-state-desc">
              会话存储在{" "}
              <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>~/.factory/sessions/</code>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted mb-3">
              共 {sessions.length} 个会话，筛选后 {filtered.length} 个；当前显示第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} 个
            </div>

            {grouped.map((group) => (
              <div key={group.project} className="mb-6">
                {groupByProject && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted">
                    <FolderTree size={14} />
                    <span className="font-medium truncate text-strong">{group.project}</span>
                    <span className="cockpit-badge cockpit-badge-ghost">{group.sessions.length}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {group.sessions.map((s) => (
                    <div key={s.id}>
                      <div className="cockpit-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm text-strong line-clamp-1">
                              {s.title || `会话 ${s.id.slice(0, 8)}`}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-faint">
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                {s.messageCount == null ? "未计数" : `${s.messageCount} 条`}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatTime(s.lastActiveAt)}
                              </span>
                              <span>{formatSize(s.fileSize)}</span>
                            </div>
                            {s.cwd && !groupByProject && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-faint">
                                <span className="truncate font-mono-sm">{s.cwd}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <code className="text-xs text-faint font-mono-sm">
                              {s.id.slice(0, 8)}
                            </code>
                            <div className="flex gap-0.5">
                              <button
                                className="btn-icon"
                                onClick={() => handleExpand(s)}
                                title="展开消息预览"
                              >
                                {expandedId === s.id ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleCopyResume(s)}
                                title="复制恢复命令"
                              >
                                {copiedId === s.id ? (
                                  <span style={{ color: "#34d399", fontSize: "0.7rem" }}>✓</span>
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                              <button
                                className="btn-icon btn-icon-danger"
                                onClick={() => handleDelete(s)}
                                disabled={deleting === s.id}
                                title="删除"
                              >
                                {deleting === s.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded message preview */}
                        {expandedId === s.id && (
                          <div
                            className="mt-3 pt-3"
                            style={{ borderTop: "1px solid var(--color-border)" }}
                          >
                            {loadingMessages ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="loading-cockpit" style={{ width: 24, height: 24 }} />
                              </div>
                            ) : messages.length === 0 ? (
                              <p className="text-xs text-faint text-center py-4">
                                无法加载消息或会话为空
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                {messages.map((msg, i) => (
                                  <div
                                    key={i}
                                    className="text-xs p-2 rounded-md"
                                    style={
                                      msg.role === "user"
                                        ? { background: "rgb(16 185 129 / 0.10)", marginLeft: "2rem" }
                                        : { background: "var(--color-base-300)", marginRight: "2rem" }
                                    }
                                  >
                                    <div className="text-xs font-semibold mb-1 text-muted">
                                      {msg.role === "user" ? "User" : "Assistant"}
                                    </div>
                                    <div
                                      className="whitespace-pre-wrap break-words text-muted line-clamp-4"
                                    >
                                      {msg.content || "[empty]"}
                                    </div>
                                  </div>
                                ))}
                                {messages.length >= 50 && (
                                  <p className="text-xs text-faint text-center py-2">
                                    仅显示前 50 条消息，完整内容请用{" "}
                                    <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>
                                      droid --resume {s.id.slice(0, 8)}
                                    </code>{" "}
                                    恢复
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  className="btn-cockpit btn-cockpit-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  上一页
                </button>
                <span className="text-sm text-muted">第 {page} / {totalPages} 页</span>
                <button
                  className="btn-cockpit btn-cockpit-ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}

        <div className="alert-cockpit alert-cockpit-info mt-6">
          <div>
            <b>提示：</b> 使用{" "}
            <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>droid --resume &lt;sessionId&gt;</code>{" "}
            恢复指定会话，或{" "}
            <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>droid -r</code>{" "}
            恢复最近的会话。点击 <Copy size={12} className="inline align-text-bottom" /> 可快速复制恢复命令。
          </div>
        </div>
      </div>
    </div>
  );
}
