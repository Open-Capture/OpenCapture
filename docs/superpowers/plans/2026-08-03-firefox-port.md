# OpenCapture Firefox Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a `dist-firefox/` build of OpenCapture that loads and works in real Firefox, from the same source tree, without changing the existing Chrome `dist/` build's output in any way.

**Architecture:** A new `TARGET_BROWSER=firefox` build path adds a second manifest (`public/manifest.firefox.json`, using `background.scripts` instead of `service_worker`) and a second Vite `outDir` (`dist-firefox/`). All `chrome.*` API call sites in shared TypeScript source route through a tiny new `ext` alias (`src/platform/webext.ts`) that resolves to Firefox's native `browser` global at runtime when present, else `chrome` — so the exact same compiled JS bundle runs correctly on both browsers; only the manifest and output directory differ per target.

**Tech Stack:** TypeScript, Vite, `@types/chrome` (reused for both browsers — no new dependency), Vitest (first real unit tests in this package).

## Global Constraints

- The plain `npm run build` command and its `dist/` output must remain byte-for-byte identical to before this work — verified by a checksum diff in Task 1.
- No new runtime npm dependency (no `webextension-polyfill`). Verified by `package.json` diff review at the end.
- The custom "save to folder" button (File System Access API) must be hidden on any browser lacking `showDirectoryPicker`, not reimplemented — spec section "Folder-picker gap".
- `content/index.ts` must contain zero `import`/`export` syntax in its compiled output (MV3 content script loaded as a classic script) — spec section "API compatibility layer" exception.
- No new Firefox-specific automated e2e suite — verification for Firefox-only behavior is manual (spec section "Testing / verification plan").
- Design source: `docs/superpowers/specs/2026-08-03-firefox-port-design.md`.

---

### Task 1: Firefox build pipeline (manifest + output directory)

**Files:**
- Create: `apps/extension/public/manifest.firefox.json`
- Modify: `apps/extension/vite.config.ts`
- Modify: `apps/extension/scripts/copy-static.mjs`
- Modify: `apps/extension/package.json`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `npm run build:firefox` command; `dist-firefox/manifest.json` with `background.scripts` instead of `service_worker`. Later tasks assume this command exists and that `dist-firefox/` is the Firefox output directory.

- [ ] **Step 1: Snapshot the current Chrome build for a before/after diff**

Run from `apps/extension/`:

```bash
rm -rf dist
npm run build
find dist -type f | sort | xargs shasum -a 256 > /tmp/dist-before.sha256
cat /tmp/dist-before.sha256
```

Keep this output — it's the baseline Task 1 must reproduce exactly at the end.

- [ ] **Step 2: Create `public/manifest.firefox.json`**

```json
{
  "manifest_version": 3,
  "name": "OpenCapture — Private Full-Page Screenshot",
  "version": "0.1.0",
  "description": "100% local full-page screenshots. No cloud upload, no watermark, no paywall.",
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  },
  "permissions": ["activeTab", "scripting", "downloads", "storage"],
  "browser_specific_settings": {
    "gecko": {
      "id": "opencapture@openapps.dev",
      "strict_min_version": "115.0"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

Identical to `public/manifest.json` except: `background` uses `scripts` (Firefox's MV3 event-page model, not Chrome's `service_worker`), `browser_specific_settings.gecko` is added (`strict_min_version: "115.0"` because `storage.session`, which the durable-capture-state architecture depends on, landed in Firefox 115), and `minimum_chrome_version` is dropped (meaningless outside Chrome).

- [ ] **Step 3: Make `vite.config.ts` target-aware**

Replace the full file:

```ts
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Multi-entry build: popup.html (Vite's native HTML-entry handling), plus
// two raw TS entries (background service worker, content script).
// background/index.ts imports freely (the manifest declares it
// `"type": "module"`, so that's fine), but content/index.ts is written
// with zero imports of its own — MV3 content scripts are always loaded as
// classic scripts, never modules, so its bundle must contain no
// import/export syntax.
//
// OPENCAPTURE_E2E gates a test-only hook (background/index.ts) that
// lets Playwright drive captures directly by tabId instead of needing to
// simulate a toolbar-icon click for the activeTab permission grant. Unset,
// `if (false)` dead-code-eliminates the hook out of the shipped bundle
// entirely — see scripts/copy-static.mjs for the matching manifest change.
//
// TARGET_BROWSER switches the output directory only — every JS entry is
// compiled identically for both browsers (see src/platform/webext.ts for
// how the shared bundle picks the right runtime API at load time). Unset,
// this defaults to "chrome" and produces byte-identical output to before
// TARGET_BROWSER existed.
const targetBrowser = process.env.TARGET_BROWSER === "firefox" ? "firefox" : "chrome";

export default defineConfig({
  root: resolve(__dirname),
  define: {
    __OPENCAPTURE_E2E__: JSON.stringify(process.env.OPENCAPTURE_E2E === "1"),
  },
  build: {
    outDir: targetBrowser === "firefox" ? "dist-firefox" : "dist",
    emptyOutDir: true,
    target: "es2022",
    // Extension pages (popup/editor) each live in their own
    // isolated JS world with no shared module cache between them, unlike
    // navigations in a normal tab — Vite's injected modulepreload polyfill
    // (for browsers lacking native support) is meaningless there and
    // Chrome logs a "cross-world extension resource mismatch" warning for
    // the unused <link rel="modulepreload">. Every target browser here
    // (Chrome 116+, Firefox 115+) has native modulepreload support anyway.
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        editor: resolve(__dirname, "src/editor/editor.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
```

- [ ] **Step 4: Make `copy-static.mjs` target-aware and select the right manifest**

Replace the full file:

```js
// Runs after `vite build`. Vite's HTML-entry output mirrors the input
// file's path relative to `root` (so src/popup/popup.html ->
// dist/src/popup/popup.html). The manifest references flat paths
// ("popup.html", "editor.html") to match how every other extension does
// it, so flatten those files up to dist/ root and drop the now-empty
// dist/src tree.
//
// (The wasm-bindgen glue in src/wasm-gen/ needs no such step — it's
// statically imported by background/wasm-loader.ts and bundled by Vite
// like any other module, with shot_core_bg.wasm emitted as a normal
// content-hashed asset.)
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extDir = dirname(dirname(fileURLToPath(import.meta.url)));
const targetBrowser = process.env.TARGET_BROWSER === "firefox" ? "firefox" : "chrome";
const distDir = join(extDir, targetBrowser === "firefox" ? "dist-firefox" : "dist");

function flattenHtmlEntry(nestedRelPath, flatName) {
  const nested = join(distDir, nestedRelPath);
  const flat = join(distDir, flatName);
  if (!existsSync(nested)) {
    throw new Error(`expected Vite to emit ${nestedRelPath} — did the entry name or path change?`);
  }
  renameSync(nested, flat);
}

flattenHtmlEntry("src/popup/popup.html", "popup.html");
flattenHtmlEntry("src/editor/editor.html", "editor.html");
rmSync(join(distDir, "src"), { recursive: true, force: true });

console.log("copy-static: flattened popup.html/editor.html");

// Vite's `publicDir` copies the whole public/ folder verbatim into
// outDir, which means BOTH manifest.json (Chrome) and manifest.firefox.json
// (Firefox) land in every build's output regardless of target. Pick the
// right one for this target and remove the other's leftover copy, so each
// dist directory ends up with exactly one, correctly-shaped manifest.json.
const firefoxManifestPath = join(distDir, "manifest.firefox.json");
if (targetBrowser === "firefox") {
  const manifestPath = join(distDir, "manifest.json");
  rmSync(manifestPath, { force: true }); // Chrome's manifest.json, also auto-copied
  renameSync(firefoxManifestPath, manifestPath);
  console.log("copy-static: installed manifest.firefox.json as manifest.json");
} else {
  rmSync(firefoxManifestPath, { force: true }); // not used in a Chrome build
}

// The shipped extension deliberately has no host_permissions — activeTab
// only (see docs/architecture.md's "trust badge" rationale). But
// `chrome.scripting.executeScript`/`captureVisibleTab` under activeTab
// require a real user gesture on the extension's toolbar action, which
// Playwright cannot simulate (there's no DOM element for the toolbar
// icon). E2E-only, gated on an explicit env var, we widen host access so
// the capture flow can be exercised by automation without a gesture. This
// must never run for a build that gets published.
if (process.env.OPENCAPTURE_E2E === "1") {
  const manifestPath = join(distDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = ["<all_urls>"];
  manifest.name = `${manifest.name} (E2E TEST BUILD)`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("copy-static: OPENCAPTURE_E2E=1 — added <all_urls> host_permissions for automated testing");
}
```

- [ ] **Step 5: Add the `build:firefox` npm script**

In `package.json`, add to `"scripts"` (keep every existing script unchanged):

```json
    "build:firefox": "npm run build:wasm && TARGET_BROWSER=firefox vite build && TARGET_BROWSER=firefox node scripts/copy-static.mjs",
```

Full `"scripts"` block after this change:

```json
  "scripts": {
    "build:wasm": "bash scripts/build-wasm.sh",
    "icons": "node scripts/generate-icons.mjs",
    "build": "npm run build:wasm && vite build && node scripts/copy-static.mjs",
    "build:firefox": "npm run build:wasm && TARGET_BROWSER=firefox vite build && TARGET_BROWSER=firefox node scripts/copy-static.mjs",
    "dev": "npm run build:wasm && vite build --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test"
  },
```

- [ ] **Step 6: Ignore the new output directory**

In the repo-root `.gitignore`, next to the existing `dist/` line, add:

```
dist-firefox/
```

- [ ] **Step 7: Verify the Chrome build is untouched**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture/apps/extension"
rm -rf dist
npm run build
find dist -type f | sort | xargs shasum -a 256 > /tmp/dist-after.sha256
diff /tmp/dist-before.sha256 /tmp/dist-after.sha256
```

Expected: no output from `diff` (files identical). If this fails, stop and find what changed before continuing — the Chrome build must not move.

- [ ] **Step 8: Verify the Firefox build**

```bash
npm run build:firefox
cat dist-firefox/manifest.json
ls dist-firefox/
```

Expected: `dist-firefox/manifest.json` is valid JSON containing `"background": {"scripts": ["background.js"], "type": "module"}` (no `service_worker` key, no `minimum_chrome_version` key), plus a `browser_specific_settings.gecko` block. `ls dist-firefox/` shows the same file set as `dist/` (background.js, content.js, popup.html, editor.html, icons/, assets/, chunks/) with `manifest.json` — no leftover `manifest.firefox.json` in either output directory.

- [ ] **Step 9: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/apps/extension/public/manifest.firefox.json \
        opencapture/apps/extension/vite.config.ts \
        opencapture/apps/extension/scripts/copy-static.mjs \
        opencapture/apps/extension/package.json \
        .gitignore
git commit -m "opencapture: add Firefox build target (manifest + dist-firefox output)"
```

---

### Task 2: `src/platform/webext.ts` — the API alias

**Files:**
- Create: `apps/extension/src/platform/webext.ts`
- Create: `apps/extension/src/platform/webext.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const ext: typeof chrome` — the WebExtension API object to call at runtime (aliases Firefox's native `browser` global when present, else `chrome`). `export function captureRateLimit(): number` — the safe capture-pacing rate to use, reading Chrome's real quota constant when available and falling back to `2` otherwise (covers both a documented Firefox capture throttle and any older Chrome lacking the constant). Every later task that touches a `chrome.*` call site (Tasks 3, 4) imports one or both of these.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/extension/src/platform/webext.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("ext", () => {
  it("aliases the native browser global when present (Firefox)", async () => {
    const fakeBrowser = { tabs: {}, marker: "firefox-browser" } as unknown as typeof chrome;
    vi.stubGlobal("browser", fakeBrowser);
    vi.stubGlobal("chrome", { tabs: {}, marker: "chrome" } as unknown as typeof chrome);

    const { ext } = await import("./webext");

    expect(ext).toBe(fakeBrowser);
  });

  it("falls back to chrome when no browser global exists (Chrome)", async () => {
    vi.stubGlobal("browser", undefined);
    const fakeChrome = { tabs: {}, marker: "chrome" } as unknown as typeof chrome;
    vi.stubGlobal("chrome", fakeChrome);

    const { ext } = await import("./webext");

    expect(ext).toBe(fakeChrome);
  });
});

describe("captureRateLimit", () => {
  it("returns Chrome's real constant when the runtime exposes it", async () => {
    vi.stubGlobal("browser", undefined);
    vi.stubGlobal("chrome", {
      tabs: { MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND: 5 },
    } as unknown as typeof chrome);

    const { captureRateLimit } = await import("./webext");

    expect(captureRateLimit()).toBe(5);
  });

  it("falls back to 2 when the runtime exposes no rate-limit constant (Firefox, or older Chrome)", async () => {
    vi.stubGlobal("browser", undefined);
    vi.stubGlobal("chrome", { tabs: {} } as unknown as typeof chrome);

    const { captureRateLimit } = await import("./webext");

    expect(captureRateLimit()).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture/apps/extension"
npx vitest run src/platform/webext.test.ts
```

Expected: FAIL — `Cannot find module './webext'` (the file doesn't exist yet).

- [ ] **Step 3: Write `src/platform/webext.ts`**

```ts
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
  return tabsApi.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/platform/webext.test.ts
```

Expected: PASS, 4/4.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/apps/extension/src/platform/webext.ts \
        opencapture/apps/extension/src/platform/webext.test.ts
git commit -m "opencapture: add ext/captureRateLimit runtime API alias for Firefox"
```

---

### Task 3: Rewrite `chrome.*` call sites to `ext.*` (importable files)

**Files:**
- Modify: `apps/extension/src/background/orchestrator.ts:1,36,40,47,51,107`
- Modify: `apps/extension/src/background/index.ts:1-4,24,37,38,106`
- Modify: `apps/extension/src/popup/popup.ts:1-6,86,96,131`
- Modify: `apps/extension/src/editor/editor.ts:10-12,908,910,984`
- Modify: `apps/extension/src/chrome/capture.ts` (full file)
- Modify: `apps/extension/src/chrome/downloads.ts` (full file)
- Modify: `apps/extension/src/chrome/save-prefs.ts:1,25,31`

**Interfaces:**
- Consumes: `ext`, `captureRateLimit` from `../platform/webext` (Task 2).
- Produces: no change to any other file's public interface — every function in these 7 files keeps its existing name and signature. This is a pure runtime-target swap.

- [ ] **Step 1: `src/background/orchestrator.ts`**

Add to the top imports:

```ts
import { ext } from "../platform/webext";
```

Change line 36 (inside `rememberLastCapture`):

```ts
  await ext.storage.session.set({ [LAST_CAPTURE_META_KEY]: meta });
```

Change line 40 (inside `getLastCaptureMeta`):

```ts
  const stored = await ext.storage.session.get(LAST_CAPTURE_META_KEY);
```

Change line 47 (`sendToContent`):

```ts
  return ext.tabs.sendMessage(tabId, request) as Promise<T>;
```

Change line 51 (inside `captureFullPage`) and the identical line 107 (inside `captureSelectedArea`):

```ts
  await ext.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
```

- [ ] **Step 2: `src/background/index.ts`**

Add to the top imports:

```ts
import { ext } from "../platform/webext";
```

Change line 24 (inside `getActiveTab`) — **note: line 23's `Promise<chrome.tabs.Tab>` return type stays unchanged**, it's a compile-time-only type reference from `@types/chrome`, not a runtime call, and is unaffected by which object `ext` points to:

```ts
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
```

Change lines 37-38 (inside `openEditorWithBytes`):

```ts
  await ext.storage.session.set({ editorDpr: dpr });
  const tab = await ext.tabs.create({ url: ext.runtime.getURL("editor.html") });
```

Change line 106:

```ts
ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
```

- [ ] **Step 3: `src/popup/popup.ts`**

Add to the top imports:

```ts
import { ext } from "../platform/webext";
```

Change line 86 (inside `persistLastCaptureUi`):

```ts
  await ext.storage.local.set({ [LAST_CAPTURE_UI_KEY]: ui });
```

Change line 96 (inside `restoreLastCaptureUi`):

```ts
  const stored = await ext.storage.local.get(LAST_CAPTURE_UI_KEY);
```

Change line 131 (inside `send`):

```ts
  return ext.runtime.sendMessage(request);
```

- [ ] **Step 4: `src/editor/editor.ts`**

Add to the top imports (after the existing three):

```ts
import { ext } from "../platform/webext";
```

Change lines 908 and 910 (inside the `closeEditor` click handler):

```ts
  const tab = await ext.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await ext.tabs.remove(tab.id);
```

Change line 984 (inside `loadImage`):

```ts
  const stored = await ext.storage.session.get("editorDpr");
```

- [ ] **Step 5: `src/chrome/capture.ts`**

Replace the full file:

```ts
// Wraps tabs.captureVisibleTab with quota pacing. See
// ../platform/webext.ts's captureRateLimit() for why the rate itself is
// read defensively rather than hardcoded.
import { captureRateLimit, ext } from "../platform/webext";

let lastCallAtMs = 0;

function quotaIntervalMs(): number {
  const perSecond = captureRateLimit();
  // A little slack above the raw 1000/perSecond so we don't ride the edge
  // of the quota and trip a rate-limit error under real-world jitter.
  return Math.ceil(1000 / perSecond) + 50;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Captures the currently visible viewport of `windowId` as a PNG, waiting
 * as needed to respect the capture-rate quota.
 */
export async function captureVisibleTabPaced(windowId: number): Promise<Uint8Array> {
  const elapsed = Date.now() - lastCallAtMs;
  const minInterval = quotaIntervalMs();
  if (elapsed < minInterval) {
    await sleep(minInterval - elapsed);
  }

  const dataUrl = await ext.tabs.captureVisibleTab(windowId, { format: "png" });
  lastCallAtMs = Date.now();

  return dataUrlToBytes(dataUrl);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

- [ ] **Step 6: `src/chrome/downloads.ts`**

Replace the full file:

```ts
// downloads.download needs a URL, and service workers/event pages can't
// reliably create object URLs from Blobs (no guaranteed `document`), so we
// hand it a data: URL instead — fine at our sizes (single-digit MB
// PNG/PDF exports).
import { ext } from "../platform/webext";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string): Promise<void> {
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  await ext.downloads.download({ url: dataUrl, filename, saveAs: false });
}
```

- [ ] **Step 7: `src/chrome/save-prefs.ts`**

Add an import line directly after the existing top-of-file comment block (lines 1-14) and before `export interface SavePrefs` — matching the pattern used in `chrome/capture.ts` and `chrome/downloads.ts` above (file-purpose comment first, then imports):

```ts
import { ext } from "../platform/webext";

export interface SavePrefs {
```

Change line 25 (inside `getSavePrefs`):

```ts
  const stored = await ext.storage.local.get(STORAGE_KEY);
```

Change line 31 (inside `setSavePrefs`):

```ts
  await ext.storage.local.set({ [STORAGE_KEY]: prefs });
```

- [ ] **Step 8: Typecheck**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture/apps/extension"
npm run typecheck
```

Expected: no errors.

- [ ] **Step 9: Rebuild the Chrome bundle and re-run the full e2e suite (regression check)**

```bash
npx playwright install --with-deps chromium   # only if not already installed
OPENCAPTURE_E2E=1 npm run build
npx playwright test
```

Expected: 22/22 passing — this proves `ext` resolves to `chrome` at runtime in real Chrome and every rewritten call site behaves exactly as it did before.

- [ ] **Step 10: Rebuild production Chrome bundle and confirm no test-only code leaked**

```bash
npm run build
grep -r "__test\|all_urls\|E2E-TEST-BUILD" dist/manifest.json dist/background.js || echo "clean"
```

Expected: `clean`.

- [ ] **Step 11: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/apps/extension/src/background/orchestrator.ts \
        opencapture/apps/extension/src/background/index.ts \
        opencapture/apps/extension/src/popup/popup.ts \
        opencapture/apps/extension/src/editor/editor.ts \
        opencapture/apps/extension/src/chrome/capture.ts \
        opencapture/apps/extension/src/chrome/downloads.ts \
        opencapture/apps/extension/src/chrome/save-prefs.ts
git commit -m "opencapture: route chrome.* calls through the ext alias (Firefox port)"
```

---

### Task 4: `src/content/index.ts` — inline alias (no-import constraint)

**Files:**
- Modify: `apps/extension/src/content/index.ts:23-25,291`

**Interfaces:**
- Consumes: nothing importable — this file cannot `import` anything (see Global Constraints). It re-derives the same alias `src/platform/webext.ts` exports, inline.
- Produces: no change to the file's message protocol or exported behavior (it has no exports — classic script).

- [ ] **Step 1: Add an inline alias next to the existing re-injection guard**

Change lines 23-25 from:

```ts
if (!(window as unknown as { __opencaptureContentLoaded?: boolean }).__opencaptureContentLoaded) {
  (window as unknown as { __opencaptureContentLoaded: boolean }).__opencaptureContentLoaded = true;

  const STYLE_ID = "__opencapture_freeze_style__";
```

to:

```ts
if (!(window as unknown as { __opencaptureContentLoaded?: boolean }).__opencaptureContentLoaded) {
  (window as unknown as { __opencaptureContentLoaded: boolean }).__opencaptureContentLoaded = true;

  // Mirrors src/platform/webext.ts's ext alias, duplicated inline rather
  // than imported: this file must compile to zero import/export syntax
  // (MV3 content scripts load as classic scripts, not modules) — see the
  // file-top comment and vite.config.ts.
  const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

  const STYLE_ID = "__opencapture_freeze_style__";
```

- [ ] **Step 2: Change the one runtime call site**

Change line 291 from:

```ts
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
```

to:

```ts
  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture/apps/extension"
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Rebuild and verify `content.js` still has zero import/export syntax**

```bash
npm run build
grep -nE "^\s*(import|export)\b" dist/content.js || echo "clean: no import/export in content.js"
```

Expected: `clean: no import/export in content.js`.

- [ ] **Step 5: Re-run the e2e suite (regression check — content script is exercised by every capture test)**

```bash
OPENCAPTURE_E2E=1 npm run build
npx playwright test
npm run build   # restore production build before finishing
```

Expected: 22/22 passing.

- [ ] **Step 6: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/apps/extension/src/content/index.ts
git commit -m "opencapture: inline the ext alias in content/index.ts (no-import constraint)"
```

---

### Task 5: Hide the custom folder picker where it can't work

**Files:**
- Modify: `apps/extension/src/popup/popup.ts:1-6,44-47`

**Interfaces:**
- Consumes: nothing new.
- Produces: no change to any exported function signature — `browseFolderBtn`'s visibility is now conditional at popup-open time.

- [ ] **Step 1: Gate the button on runtime feature detection**

In `src/popup/popup.ts`, after the existing `browseFolderBtn` lookup near the top (currently line 23: `const browseFolderBtn = $("browseFolder") as HTMLButtonElement;`), add:

```ts
const browseFolderBtn = $("browseFolder") as HTMLButtonElement;

// showDirectoryPicker() (File System Access API) is Chromium-only — Firefox
// has no implementation at all, and no equivalent API to fall back to.
// Hide the button entirely rather than showing something that can only
// error; Firefox users keep the standard Downloads-folder save, same
// fallback Chrome itself uses when this API/permission isn't available.
const supportsFolderPicker = "showDirectoryPicker" in window;
if (!supportsFolderPicker) {
  browseFolderBtn.style.display = "none";
}
```

(This inserts one new `const` and one `if` block directly below the existing `browseFolderBtn` declaration — the rest of the file, including the existing `browseFolderBtn.addEventListener(...)` further down, is unchanged.)

- [ ] **Step 2: Typecheck**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture/apps/extension"
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Rebuild both targets and grep for the guard**

```bash
npm run build
grep -c "showDirectoryPicker" dist/popup.js
npm run build:firefox
grep -c "showDirectoryPicker" dist-firefox/popup.js
```

Expected: both greps report a nonzero count (the same compiled `popup.js` logic ships to both targets — it's a runtime check, not a build-time branch — so the string is present in both, and its *behavior* differs only by which browser actually defines `window.showDirectoryPicker` when the popup runs).

- [ ] **Step 4: Re-run the Chrome e2e suite (regression check — the folder-picker flow is exercised there)**

```bash
OPENCAPTURE_E2E=1 npm run build
npx playwright test
npm run build   # restore production build before finishing
```

Expected: 22/22 passing (Chrome's headless Playwright environment doesn't implement `showDirectoryPicker` either in practice for automation purposes the existing tests already accommodate — confirm nothing regressed; if any test now fails because it assumed `browseFolderBtn` is always visible, that's real signal to fix the test to check `supportsFolderPicker` first, not a reason to weaken this task's guard).

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/apps/extension/src/popup/popup.ts
git commit -m "opencapture: hide the custom folder picker on browsers without File System Access"
```

---

### Task 6: Final verification pass and Firefox manual-test checklist

**Files:**
- Create: `opencapture/docs/FIREFOX_TESTING.md`
- Modify: `opencapture/PLAN.md` (append an M17 section)

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: nothing further downstream — this is the closing verification + documentation task.

- [ ] **Step 1: Full Rust test suite (unaffected by this work, confirm no incidental breakage)**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps/opencapture"
export CARGO_TARGET_DIR=/tmp/opencapture-target
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --check
```

Expected: all green, same counts as before this work (36 tests).

- [ ] **Step 2: Full TypeScript typecheck**

```bash
cd apps/extension
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Full Vitest unit suite**

```bash
npx vitest run
```

Expected: 4/4 passing (the `webext.test.ts` suite from Task 2 — the only unit tests in this package).

- [ ] **Step 4: Full Chrome e2e suite, one last time**

```bash
OPENCAPTURE_E2E=1 npm run build
npx playwright test
npm run build
grep -r "__test\|all_urls\|E2E-TEST-BUILD" dist/manifest.json dist/background.js || echo "clean"
```

Expected: 22/22 passing, then `clean`.

- [ ] **Step 5: Final Chrome-output diff against the pre-work baseline**

```bash
find dist -type f | sort | xargs shasum -a 256 > /tmp/dist-final.sha256
diff /tmp/dist-before.sha256 /tmp/dist-final.sha256
```

Expected: no output. If Task 1's baseline files (`/tmp/dist-before.sha256`) were lost between sessions, regenerate the baseline from `main` before this branch's first commit instead, then re-run this diff.

- [ ] **Step 6: Build and sanity-check the Firefox output**

```bash
npm run build:firefox
python3 -m json.tool dist-firefox/manifest.json > /dev/null && echo "manifest.json is valid JSON"
grep -q '"scripts": \["background.js"\]' dist-firefox/manifest.json && echo "background.scripts present"
grep -q "service_worker" dist-firefox/manifest.json && echo "FAIL: service_worker leaked into Firefox manifest" || echo "OK: no service_worker key"
grep -q "browser_specific_settings" dist-firefox/manifest.json && echo "gecko settings present"
ls dist-firefox/
```

Expected: all four `echo` checks print their success message (the third line must print `OK: no service_worker key`), and the file listing matches `dist/`'s (background.js, content.js, popup.html, editor.html, icons/, assets/, chunks/, manifest.json).

- [ ] **Step 7: Write `docs/FIREFOX_TESTING.md`**

```markdown
# Testing the Firefox build

OpenCapture's Firefox build is produced by `npm run build:firefox` (see
`apps/extension/`), which outputs to `dist-firefox/` instead of `dist/`.
It is not yet signed or published — load it as a temporary add-on for
testing.

## Install (temporary, until Firefox restarts)

1. `cd apps/extension && npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click **Load Temporary Add-on…**
4. Select `dist-firefox/manifest.json` directly (not the folder — Firefox
   wants the manifest file itself, unlike Chrome's "Load unpacked")
5. OpenCapture's icon appears in the toolbar

This is removed when Firefox restarts; repeat steps 2-4 each session. A
permanent install without a real Mozilla-signed release requires Firefox
Developer Edition, Nightly, or ESR with
`about:config` → `xpinstall.signatures.required` → `false`.

## What to check

Everything in the Chrome flow, since the same source and the same compiled
JS logic drive both builds:

- Capture full page / visible area / selected area
- Export as PDF, Copy to clipboard, Open in editor
- Editor: crop, arrow, rectangle, text, blur, undo, select tool
- Popup reopen after close — last capture should still be shown
- Filename preference (the text field under "Save to")

Firefox-specific things worth double-checking, since they can't be proven
from Chrome's e2e suite:

- **The "Browse…" custom-folder button must not appear at all** under
  "Save to" — Firefox has no File System Access API, so this is
  deliberately hidden (see Task 5 of the Firefox port plan). If it does
  appear, that's a real bug.
- **A capture actually completes without a console error.** Open the
  background page's console via `about:debugging#/runtime/this-firefox` →
  OpenCapture → **Inspect**, and the popup's own console via
  right-click the popup → **Inspect**, while running through the flows
  above.
- **`storage.session` works** — reopening the popup after a capture, or
  reopening the editor tab, should still show the last capture (this
  depends on Firefox 115+; note `browser_specific_settings.gecko.strict_min_version`
  in the manifest if testing on an older Firefox).

## Known, deliberate differences from Chrome

- No custom save-folder picker (see above) — Downloads-folder saving via
  the Filename field still works.
- No automated e2e coverage for this build — every check above is manual.
```

- [ ] **Step 8: Append an M17 section to `PLAN.md`**

Read `opencapture/PLAN.md`'s existing M14-M16 sections first to match their heading level and level of detail, then append a new section following the same format, covering: the original Firefox `background.service_worker is currently disabled` error and its root cause, the `ext`/`captureRateLimit` alias approach, the manifest split, the folder-picker gap and how it's handled, and a pointer to `docs/FIREFOX_TESTING.md` for manual verification steps. Use the actual verification results from Steps 1-6 above (test counts, grep outputs) rather than placeholder numbers.

- [ ] **Step 9: Commit**

```bash
cd "/Volumes/My Shared Files/sharing_folder/openapps"
git add opencapture/docs/FIREFOX_TESTING.md opencapture/PLAN.md
git commit -m "opencapture: Firefox port verification pass and manual testing guide"
```
