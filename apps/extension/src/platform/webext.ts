// The single place shared source code reads the WebExtension API from,
// instead of calling `chrome.*` directly. Chrome doesn't define a
// `browser` global; Firefox does (natively, promise-based, and has since
// before Chrome's own promise support existed). Detecting it at runtime
// means the exact same compiled bundle works unmodified on both browsers
// — only the manifest (background model, browser_specific_settings) needs
// a separate build; see vite.config.ts / copy-static.mjs.
//
// Typed as `typeof chrome` on both branches: the WebExtensions API
// surface this extension actually uses (tabs, storage, scripting,
// downloads, runtime messaging) is common to both browsers, so reusing
// @types/chrome's shapes avoids pulling in a second types package for a
// nearly-identical API.
export const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

/**
 * Safe pacing interval for `tabs.captureVisibleTab`, in calls per second.
 * `chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` has been
 * hard-capped at 2 since Chrome 92 with no override, and @types/chrome
 * doesn't declare it even though it exists at runtime — read it
 * defensively. Firefox exposes no equivalent constant at all, so the same
 * fallback value (2) covers it too.
 */
export function captureRateLimit(): number {
  const tabsApi = ext.tabs as typeof chrome.tabs & { MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND?: number };
  // `||` (not `??`) is deliberate: a value of exactly 0 must also fall
  // back to 2, since Math.ceil(1000/0) is Infinity and would hang every
  // capture.
  return tabsApi.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2;
}
