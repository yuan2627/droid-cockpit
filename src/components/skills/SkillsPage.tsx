import { useMemo, useState, useEffect, useCallback } from "react";
import { listSkills, uninstallSkill, type SkillInfo } from "../../utils/tauri";
import { TTLCache } from "../../utils/helpers";
import { CACHE_TTL } from "../../config/app";
import { useTranslation } from "react-i18next";
import {
  Brain, RefreshCw, FolderOpen, Trash2, CheckCircle2,
  FileCode, Download, Search, Package, AlertTriangle,
} from "lucide-react";

// Module-level cache for skills — avoids refetching on every page visit
const skillsCache = new TTLCache<SkillInfo[]>(CACHE_TTL.MEDIUM);

export function SkillsPage() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<SkillInfo | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "managed" | "unmanaged">("all");

  const fetchSkills = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const list = await skillsCache.get(() => listSkills(), force);
      setSkills(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleUninstall = async () => {
    if (!uninstallTarget) return;
    const name = uninstallTarget.id;
    setUninstalling(name);
    setUninstallTarget(null);
    try {
      await uninstallSkill(name);
      await fetchSkills(true);
    } catch (e) {
      setError(t("skills.uninstallError", { error: String(e) }));
    } finally {
      setUninstalling(null);
    }
  };

  const managedCount = skills.filter((s) => s.managed).length;
  const unmanagedCount = skills.length - managedCount;
  const factoryCount = skills.filter((s) => s.source === "factory").length;
  const agentsCount = skills.filter((s) => s.source === "agents").length;

  const filteredSkills = useMemo(
    () =>
      skills.filter((skill) => {
        const text = `${skill.name} ${skill.description || ""} ${skill.path || ""}`.toLowerCase();
        const matchesQuery = text.includes(query.trim().toLowerCase());
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "managed" && skill.managed) ||
          (statusFilter === "unmanaged" && !skill.managed);
        return matchesQuery && matchesStatus;
      }),
    [query, skills, statusFilter],
  );

  const getSourceBadge = (source?: string) => {
    if (source === "agents") {
      return (
        <span className="cockpit-badge cockpit-badge-ghost" title={t("skills.sourceAgents")}>
          <Package size={9} /> Agents
        </span>
      );
    }
    return (
      <span className="cockpit-badge cockpit-badge-info" title={t("skills.sourceFactory")}>
        <Package size={9} /> Factory
      </span>
    );
  };

  return (
    <div className="page-container">
      <div className="page-inner">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-strong">
              <Brain size={20} style={{ color: "var(--color-primary)" }} /> {t("skills.title")}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              {t("skills.totalSkills", { count: skills.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {skillsCache.isFresh && (
              <span className="text-xs text-faint">
                {t("slash.stats.cached")}
              </span>
            )}
            <button className="btn-cockpit btn-cockpit-ghost" onClick={() => fetchSkills(true)}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("skills.refresh")}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="alert-cockpit alert-cockpit-info mb-5">
          <div>
            {t("skills.sourceFactory")}: <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>~/.factory/skills/</code>
            {" · "}
            {t("skills.sourceAgents")}: <code className="font-mono-sm px-1 rounded" style={{ background: "var(--color-base-300)" }}>~/.agents/skills/</code>
            {" · "}
            {t("skills.installGuide")}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted">
          <span>
            <b className="text-strong">{skills.length}</b> {t("skills.totalSkills", { count: skills.length })}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 size={13} style={{ color: "#34d399" }} />
            {t("skills.managed")} <b style={{ color: "#34d399" }}>{managedCount}</b>
          </span>
          <span>
            {t("skills.unmanaged")} <b className="text-faint">{unmanagedCount}</b>
          </span>
          <span>
            Factory <b className="text-strong">{factoryCount}</b>
          </span>
          <span>
            Agents <b className="text-strong">{agentsCount}</b>
          </span>
        </div>

        {/* Search & filter */}
        <div className="cockpit-card p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                className="input-cockpit pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("skills.searchPlaceholder")}
              />
            </div>
            <select
              className="input-cockpit"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">{t("skills.filterAll")}</option>
              <option value="managed">{t("skills.filterManaged")}</option>
              <option value="unmanaged">{t("skills.filterUnmanaged")}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading-cockpit" />
          </div>
        ) : error ? (
          <div className="alert-cockpit alert-cockpit-error">
            <span>{error}</span>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Brain size={32} />
            </div>
            <div className="empty-state-title">
              {skills.length === 0 ? t("skills.noSkills") : t("slash.noResults")}
            </div>
            <div className="empty-state-desc">
              {skills.length === 0 ? t("skills.noSkillsHint") : t("skills.searchPlaceholder")}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <div key={skill.id} className="cockpit-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 stat-icon-primary">
                      <Brain size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-strong truncate">{skill.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {skill.managed ? (
                          <span className="cockpit-badge cockpit-badge-success">
                            <CheckCircle2 size={9} /> SKILL.md
                          </span>
                        ) : (
                          <span className="cockpit-badge cockpit-badge-ghost">
                            {t("skills.unmanaged")}
                          </span>
                        )}
                        {getSourceBadge(skill.source)}
                        {skill.version && (
                          <span className="cockpit-badge cockpit-badge-ghost">
                            v{skill.version}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {skill.description && (
                  <p className="text-xs text-muted mt-2 line-clamp-2">
                    {skill.description}
                  </p>
                )}
                {skill.path && (
                  <div className="flex items-center gap-1 text-xs text-faint mt-2 truncate">
                    <FolderOpen size={12} className="flex-shrink-0" />
                    <span className="font-mono-sm truncate">{skill.path}</span>
                  </div>
                )}
                <div
                  className="flex justify-end mt-3 pt-2"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => setUninstallTarget(skill)}
                    disabled={uninstalling === skill.id}
                    title={t("skills.uninstall")}
                  >
                    {uninstalling === skill.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Installation guide */}
        <div className="cockpit-card p-4 mt-6">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-strong">
            <Download size={16} style={{ color: "var(--color-primary)" }} /> {t("skills.installGuideTitle")}
          </h3>
          <div className="space-y-2 text-xs">
            <div
              className="rounded-md p-2.5 font-mono-sm"
              style={{ background: "var(--color-base-300)" }}
            >
              <div className="text-faint mb-1"># {t("skills.installGuide")} 1: /skills</div>
              <div>droid  # {t("skills.installGuide")}</div>
            </div>
            <div
              className="rounded-md p-2.5 font-mono-sm"
              style={{ background: "var(--color-base-300)" }}
            >
              <div className="text-faint mb-1"># {t("skills.installGuide")} 2: git clone</div>
              <div>cd ~/.factory/skills && git clone &lt;repo-url&gt;</div>
            </div>
          </div>
          <div className="alert-cockpit alert-cockpit-warning mt-3" style={{ padding: "0.5rem 0.75rem" }}>
            <div className="text-xs">
              <FileCode size={14} className="inline mr-1 align-text-bottom" />
              SKILL.md (name + description YAML frontmatter)
            </div>
          </div>
        </div>
      </div>

      {/* Uninstall confirmation dialog */}
      {uninstallTarget && (
        <div className="slash-command-overlay" onClick={() => setUninstallTarget(null)}>
          <div className="slash-command-modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="slash-command-modal-header">
              <span className="slash-command-modal-title flex items-center gap-2">
                <AlertTriangle size={16} style={{ color: "#f59e0b" }} />
                {t("skills.uninstall")}
              </span>
              <button className="btn-icon" onClick={() => setUninstallTarget(null)}>
                ✕
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted">
                {t("skills.uninstallConfirm", { name: uninstallTarget.name })}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 pt-0">
              <button
                className="btn-cockpit btn-cockpit-ghost"
                onClick={() => setUninstallTarget(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn-cockpit btn-cockpit-primary"
                style={{ background: "var(--color-error)" }}
                onClick={handleUninstall}
              >
                <Trash2 size={14} />
                {t("skills.uninstall")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
