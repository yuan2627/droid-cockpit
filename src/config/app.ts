export const APP_VERSION = "1.0.0";
export const DROID_SETTINGS_BASE_VERSION = "0.162.0";

/** GitHub repo for update checks and open-source attribution */
export const GITHUB_REPO = "yuan2627/droid-cockpit";
export const GITHUB_RELEASES_URL = "https://github.com/yuan2627/droid-cockpit/releases";

/** Factory Droid CLI npm registry for version comparison */
export const DROID_NPM_REGISTRY = "https://registry.npmjs.org/droid/latest";

/** Cache TTL constants (ms) */
export const CACHE_TTL = {
  SHORT: 30_000,       // 30 seconds — version checks, quick polls
  MEDIUM: 5 * 60_000,  // 5 minutes — skills, droids, prompts
  LONG: 30 * 60_000,   // 30 minutes — usage stats, sessions
  USAGE_STATS: 60_000, // 1 minute — usage stats (kept short for responsiveness)
} as const;
