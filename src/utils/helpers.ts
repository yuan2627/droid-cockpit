// Shared helper functions extracted from multiple components to eliminate duplication.

/** Format a timestamp (ms) into a human-readable date-time string. */
export function formatTime(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** Format a timestamp (ms) into a date-only string (YYYY-MM-DD). */
export function formatDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convert a timestamp (ms) to a local date key (YYYY-MM-DD) for grouping. */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Format a byte count into a human-readable file size string. */
export function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let unit = 0;
  while (val >= 1024 && unit < units.length - 1) {
    val /= 1024;
    unit += 1;
  }
  return `${val.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Format a token count with K/M suffixes for compact display. */
export function formatTokens(n: number): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format a duration in milliseconds to a human-readable string (e.g., "2h 15m"). */
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0m";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Format a duration in milliseconds to a long human-readable string (e.g., "50天 8小时"). */
export function formatDurationLong(ms: number): string {
  if (!ms || ms <= 0) return "0小时";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  if (days > 0) return `${days}天 ${hours}小时`;
  return `${hours}小时`;
}

/** Standard reasoning effort options used across settings and model forms.
 * Per official docs: off, none, low, medium, high.
 * Some models may also support "max" (kept for backward compat with user configs). */
export const REASONING_EFFORT_OPTIONS = [
  { value: "off", label: "Off (关闭)" },
  { value: "none", label: "None (无)" },
  { value: "low", label: "Low (低)" },
  { value: "medium", label: "Medium (中)" },
  { value: "high", label: "High (高)" },
  { value: "max", label: "Max (最大)" },
] as const;

/** Autonomy level options. */
export const AUTONOMY_LEVEL_OPTIONS = [
  { value: "off", label: "关闭" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
] as const;

/** Interaction mode options. */
export const INTERACTION_MODE_OPTIONS = [
  { value: "auto", label: "自动模式" },
  { value: "spec", label: "规格模式 (Spec)" },
] as const;

/** Locale options for the Droid CLI TUI. */
export const LOCALE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "it", label: "Italiano" },
] as const;

/** Diff mode options. */
export const DIFF_MODE_OPTIONS = [
  { value: "github", label: "GitHub Diff" },
  { value: "unified", label: "Unified Diff" },
] as const;

/** Tool result display options. */
export const TOOL_RESULT_DISPLAY_OPTIONS = [
  { value: "expanded", label: "展开" },
  { value: "compact", label: "紧凑" },
] as const;

/** Logo animation options. */
export const LOGO_ANIMATION_OPTIONS = [
  { value: "once", label: "仅一次" },
  { value: "always", label: "始终" },
  { value: "off", label: "关闭" },
] as const;

/** Sound focus mode options. */
export const SOUND_FOCUS_MODE_OPTIONS = [
  { value: "always", label: "始终" },
  { value: "focused", label: "仅聚焦窗口" },
  { value: "unfocused", label: "仅失焦窗口" },
] as const;

/** Subagent sounds options. */
export const SUBAGENT_SOUNDS_OPTIONS = [
  { value: "off", label: "关闭" },
  { value: "quiet", label: "安静" },
  { value: "inherit", label: "继承主设置" },
] as const;

/** Completion sound options. */
export const COMPLETION_SOUND_OPTIONS = [
  { value: "fx-ok01", label: "FX OK 01" },
  { value: "fx-ok02", label: "FX OK 02" },
  { value: "bell", label: "铃声" },
  { value: "none", label: "无" },
] as const;

/** Todo display mode options. */
export const TODO_DISPLAY_MODE_OPTIONS = [
  { value: "inline", label: "内联" },
  { value: "pinned", label: "固定" },
] as const;

/** Compaction model options. */
export const COMPACTION_MODEL_OPTIONS = [
  { value: "current-model", label: "使用当前模型" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (省 Token)" },
] as const;

/** Simple in-memory cache with TTL. Returns cached data if fresh, otherwise calls fetcher. */
export class TTLCache<T> {
  private data: T | null = null;
  private fetchedAt = 0;
  private inFlight: Promise<T> | null = null;
  private readonly ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  async get(fetcher: () => Promise<T>, force = false): Promise<T> {
    const now = Date.now();
    if (!force && this.data && now - this.fetchedAt < this.ttl) {
      return this.data;
    }
    if (this.inFlight && !force) {
      return this.inFlight;
    }
    this.inFlight = fetcher().then((result) => {
      this.data = result;
      this.fetchedAt = Date.now();
      this.inFlight = null;
      return result;
    }).catch((err) => {
      this.inFlight = null;
      throw err;
    });
    return this.inFlight;
  }

  invalidate(): void {
    this.data = null;
    this.fetchedAt = 0;
  }

  get isFresh(): boolean {
    return this.data !== null && Date.now() - this.fetchedAt < this.ttl;
  }

  get lastFetchedAt(): number {
    return this.fetchedAt;
  }
}

/** Debounce a function call by the given delay (ms). */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

/** Truncate a string to maxLen characters, appending "..." if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

/** Clamp a number between min and max. */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Generate a simple unique ID. */
export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
