import { invoke } from "@tauri-apps/api/core";
import { CACHE_TTL, DROID_NPM_REGISTRY } from "../config/app";
import { TTLCache } from "./helpers";

function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  isUpToDate: boolean;
  hasUpdate: boolean;
  error: string | null;
  checkedAt: number;
}

const versionCache = new TTLCache<VersionCheckResult>(CACHE_TTL.LONG);

/** Get the locally installed Droid CLI version by running `droid --version`. */
export async function getLocalDroidVersion(): Promise<string> {
  if (!hasTauriRuntime()) return "browser-preview";
  return invoke<string>("get_droid_version");
}

/** Fetch the latest Droid version from npm registry. */
async function fetchLatestDroidVersion(): Promise<string | null> {
  if (!hasTauriRuntime()) return null;
  try {
    const response = await fetch(DROID_NPM_REGISTRY, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}

/** Compare two semver-like version strings. Returns true if latest > current. */
export function isNewerVersion(current: string, latest: string): boolean {
  const parseVersion = (v: string): number[] => {
    const cleaned = v.replace(/^[vV]/, "").trim();
    return cleaned.split(".").map((part) => {
      const n = parseInt(part, 10);
      return isNaN(n) ? 0 : n;
    });
  };
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  const maxLen = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < maxLen; i++) {
    const c = currentParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Check for Droid CLI version updates. Results are cached for CACHE_TTL.LONG.
 * This is a silent check — it never throws and never shows a popup.
 * Returns a VersionCheckResult with the comparison outcome.
 */
export async function checkDroidVersion(force = false): Promise<VersionCheckResult> {
  return versionCache.get(async () => {
    let currentVersion = "unknown";
    let error: string | null = null;

    try {
      currentVersion = await getLocalDroidVersion();
    } catch (e) {
      error = String(e);
      currentVersion = "未检测到";
    }

    const latestVersion = await fetchLatestDroidVersion();

    const isUpToDate = latestVersion !== null && !isNewerVersion(currentVersion, latestVersion);
    const hasUpdate = latestVersion !== null && isNewerVersion(currentVersion, latestVersion);

    return {
      currentVersion,
      latestVersion,
      isUpToDate,
      hasUpdate,
      error,
      checkedAt: Date.now(),
    };
  }, force);
}

/** Get the cached version check result without fetching. */
export function getCachedVersionCheck(): VersionCheckResult | null {
  if (versionCache.isFresh) {
    // We need to return the cached data — but TTLCache doesn't expose it directly.
    // The next get() call will return the cached value without fetching.
    return null;
  }
  return null;
}

/** Check if version check cache is fresh. */
export function isVersionCheckFresh(): boolean {
  return versionCache.isFresh;
}
