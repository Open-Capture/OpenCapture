# OpenCapture Firefox port — design

## Goal

Ship a Firefox-loadable build of OpenCapture alongside the existing
Chrome build, from the same source tree, **without changing the Chrome
build's behavior or output in any way.**

## Non-goals

- Chrome Web Store / AMO (addons.mozilla.org) publishing automation — out
  of scope, same as Chrome's own publishing automation (see `PLAN.md`).
- Feature parity for the custom "save to folder" picker. Firefox has no
  equivalent to the File System Access API (`window.showDirectoryPicker`)
  that feature depends on. It is hidden on Firefox, not reimplemented.
- An automated Firefox e2e suite. Playwright's Firefox extension support
  is far less mature than its Chromium/CDP support (no service-worker
  control, etc.), so verification is manual for this port.

## Background: why the current build fails on Firefox

Loading the existing `dist/manifest.json` as a temporary add-on in Firefox
fails immediately with:

```
background.service_worker is currently disabled. Add background.scripts.
```

Firefox's stable channel does not support the MV3 `background.service_worker`
manifest key that Chrome uses. Investigation (full detail below) found this
is close to the *only* hard architectural blocker — the extension already
avoids the other classic porting trap (the Offscreen Documents API, which
Firefox doesn't implement at all — OpenCapture tried it early on for
clipboard writes, found it broken even in Chrome, and replaced it with a
different architecture well before this port).

### Investigation summary

- **No `chrome.offscreen` usage anywhere.** Not a blocker.
- **Every browser API call uses the `chrome.*` namespace**, all in promise
  style (`await chrome.tabs.query(...)`, etc.) — no `browser.*`, no
  polyfill. APIs used: `storage.session`, `storage.local`, `tabs.query`,
  `tabs.sendMessage`, `tabs.create`, `tabs.getCurrent`, `tabs.remove`,
  `tabs.captureVisibleTab` (+ `chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`,
  a Chrome-only rate-limit constant), `scripting.executeScript`,
  `runtime.onMessage`, `runtime.sendMessage`, `runtime.getURL`,
  `downloads.download`. All of these exist under Firefox's native,
  promise-based `browser.*` namespace.
- **`background.service_worker` + `type: module`** is Chrome's pure MV3
  form. Firefox wants `background.scripts` (an event page) — its
  traditional, well-supported MV3 background model.
- **No `host_permissions`, no static `content_scripts`** — the extension
  is deliberately `activeTab`-only, content script injected on demand via
  `chrome.scripting.executeScript`. This shape is portable as-is.
- **`shot-core` (the wasm crate) has zero browser/DOM dependency** — no
  `web-sys`, pure computation (image/PDF encoding). Nothing to port there.
- **The custom folder picker** (`src/chrome/pick-directory.ts`,
  `dir-handle-store.ts`) uses `window.showDirectoryPicker` — a Chromium-only
  Web Platform API, not a `chrome.*` extension API. Firefox has no
  implementation. This is a genuine feature gap, not a naming difference.
- **CSP** (`'wasm-unsafe-eval'` in `content_security_policy.extension_pages`)
  uses the standard MV3 schema shape; expected to work on Firefox too
  (verified manually as part of the smoke test, not assumed).
- The background code's durable-storage architecture (`chrome.storage.session`
  + IndexedDB blob store, built in M15 specifically to survive Chrome's
  service-worker eviction) has no assumptions that break under Firefox's
  event-page model — if anything, event pages give the background context
  a real DOM, which is a superset of what the current code assumes.

## Design

### 1. Build architecture — Chrome path stays byte-identical

One source tree, one new npm script, no change to the existing one:

- `npm run build` — unchanged. Produces `dist/` exactly as it does today.
  Verified by diffing `dist/` before and after this work lands.
- `npm run build:firefox` — new. Sets `TARGET_BROWSER=firefox` for the
  same three-step pipeline (`build:wasm` → `vite build` → `copy-static.mjs`).
  `build:wasm` is untouched (the wasm core has no browser dependency).
  `vite.config.ts` reads `TARGET_BROWSER` to switch `outDir` to
  `dist-firefox/` and to set a `__TARGET_BROWSER__` define; when the env
  var is unset, behavior is identical to today.
- `dist-firefox/` added to `.gitignore` alongside the existing `dist/` entry.

### 2. Manifest — a full separate file, not a runtime patch

New `public/manifest.firefox.json`, a complete manifest (not a diff applied
to the Chrome one), so each file is independently readable and Chrome's
`public/manifest.json` is never touched by Firefox-specific logic:

- `"background": {"scripts": ["background.js"], "type": "module"}` in place
  of `service_worker`.
- `"browser_specific_settings": {"gecko": {"id": "opencapture@openapps.dev", "strict_min_version": "115.0"}}`.
  115.0 because `storage.session` (which the M15 durable-capture-state fix
  depends on) landed in Firefox 115.
- No `minimum_chrome_version` (meaningless outside Chrome).
- `permissions`, `action`, `icons`, `content_security_policy` identical to
  the Chrome manifest.

`scripts/copy-static.mjs` copies `manifest.firefox.json` → `dist-firefox/manifest.json`
when `TARGET_BROWSER=firefox`, and continues copying `manifest.json` →
`dist/manifest.json` otherwise — same E2E-mode patching logic as today,
untouched, and only ever applied to the Chrome path.

### 3. API compatibility layer — `src/platform/webext.ts`

A single new file exporting:

- `ext` — `chrome` on the Chrome build, `browser` on the Firefox build.
  This is a build-time constant alias, not a runtime shim: since every
  call site already uses promise style, and Firefox's native `browser.*`
  is promise-based, no translation logic is needed at all.
- `captureRateLimit()` — returns `chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND`
  on the Chrome build (unchanged constant), and a hardcoded conservative
  value on the Firefox build (no equivalent exposed constant there).

Typing: a small hand-written ambient declaration (`declare const browser: typeof chrome;`)
reusing the existing `@types/chrome` types. No new npm dependency —
deliberately avoiding `webextension-polyfill` per your steer to keep the
Chrome build's footprint untouched.

The ~9 files currently calling `chrome.*` directly (`background/orchestrator.ts`,
`background/index.ts`, `editor/editor.ts`, `popup/popup.ts`,
`chrome/save-prefs.ts`, `chrome/capture.ts`, `chrome/downloads.ts`,
`content/index.ts`) get a mechanical rewrite to call `ext.*` instead — a
pure find-and-replace plus import addition, no logic changes. No directory
renames (out of scope, purely mechanical safety).

### 4. Folder-picker gap — runtime feature detection, not a build flag

The "Browse…" custom-save-folder button is gated on
`"showDirectoryPicker" in window` at runtime, rather than on
`TARGET_BROWSER`. This hides it correctly on Firefox (and on any future/older
browser lacking the API) without coupling UI code to the build target, and
without any behavior change on Chrome. Firefox users fall back to the
existing `chrome.downloads.download`-based Downloads-folder save — the same
fallback path Chrome itself already uses when the picker/permission isn't
available.

### 5. Testing / verification plan

- `cargo test --workspace`, `cargo clippy`, `cargo fmt --check` — unaffected,
  re-run to confirm (wasm core has no browser dependency).
- `npm run typecheck` — extended to cover `src/platform/webext.ts` and the
  `ext.*` call-site rewrites.
- Existing 22/22 Chromium Playwright e2e suite — must stay green, run
  against the unchanged `dist/` build. This is the primary guard that the
  Chrome path wasn't disturbed.
- No parallel Firefox e2e suite (explicitly decided against — low
  reliability, uncertain payoff for the time cost).
- Manual verification: load `dist-firefox/manifest.json` as a temporary
  add-on via `about:debugging#/runtime/this-firefox` in real Firefox, and
  run through the same core-flow checklist used for the Chrome
  friend-testing guide (capture, PDF export, copy, annotate/undo, all
  editor tools, popup reopen retains last capture). I can't drive a real
  Firefox GUI from this environment, so this manual pass is done by you;
  I'll write a short checklist to make it quick.

## Risks / open items carried into implementation

- `strict_min_version: "115.0"` is a reasoned choice (storage.session
  availability), not empirically tested against older Firefox — acceptable
  since we're not targeting old-version compatibility here.
- CSP behavior (`'wasm-unsafe-eval'`) is expected to work per Firefox's CSP3
  support but is a "verify during manual smoke test" item, not a proven fact.
- `browser_specific_settings.gecko.id` value (`opencapture@openapps.dev`)
  is a placeholder — trivially changeable later, not load-bearing for
  functionality.
