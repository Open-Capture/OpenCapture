// Content script: injected on demand per capture (see
// background/orchestrator.ts — there is no static `content_scripts` entry
// in manifest.json, deliberately, so the extension never has standing
// access to pages the user hasn't asked it to capture). Runs as a classic
// script, not an ES module, so this file must import nothing — see
// docs/architecture.md.
//
// Message protocol (background -> content, request/response):
//   {action:"prep"}                    -> {metrics, pinnedElementsHandled, lazyImagesForced, warnings}
//   {action:"scrollTo", targetCss}     -> {actualScrollCss}
//   {action:"restore"}                 -> {ok:true}
//   {action:"selectArea"}              -> {rect: {x,y,width,height} | null, dpr}  (null = user cancelled)
//
// chrome.scripting.executeScript's isolated world persists across repeated
// injections into the same tab/frame — it's only torn down on navigation —
// so a second capture on a page the user never reloaded re-runs this exact
// file's top-level `const`/`let` declarations into a scope that already
// has them, throwing "Uncaught SyntaxError: Identifier '...' has already
// been declared" and silently breaking that capture. Guard the whole body
// so re-injection is a no-op: the message listener registered by the first
// injection is still alive in that persisted world and keeps handling
// subsequent captures fine without needing to run any of this again.
if (!(window as unknown as { __opencaptureContentLoaded?: boolean }).__opencaptureContentLoaded) {
  (window as unknown as { __opencaptureContentLoaded: boolean }).__opencaptureContentLoaded = true;

  // Mirrors src/platform/webext.ts's ext alias, duplicated inline rather
  // than imported: this file must compile to zero import/export syntax
  // (MV3 content scripts load as classic scripts, not modules) — see the
  // file-top comment and vite.config.ts.
  const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

  const STYLE_ID = "__opencapture_freeze_style__";
  const PINNED_ATTR = "data-opencapture-pinned";

  type PinnedKind = "top" | "bottom";

  let pinnedElements: Array<{ el: HTMLElement; kind: PinnedKind; originalVisibility: string }> = [];
  let totalHeightCss = 0;

  function forceEagerLoading(): number {
    let count = 0;
    document.querySelectorAll("img[loading='lazy'], iframe[loading='lazy']").forEach((el) => {
      (el as HTMLImageElement | HTMLIFrameElement).loading = "eager";
      count++;
    });
    document.querySelectorAll<HTMLImageElement>("img[data-src]:not([src])").forEach((img) => {
      const src = img.getAttribute("data-src");
      if (src) {
        img.src = src;
        count++;
      }
    });
    document.querySelectorAll<HTMLImageElement>("img[data-srcset]:not([srcset])").forEach((img) => {
      const srcset = img.getAttribute("data-srcset");
      if (srcset) img.srcset = srcset;
    });
    return count;
  }

  async function primingScrollPass(): Promise<void> {
    const doc = document.scrollingElement ?? document.documentElement;
    const step = window.innerHeight;
    const original = doc.scrollTop;

    for (let y = doc.scrollHeight; y >= 0; y -= step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await sleep(60);
    }
    window.scrollTo({ top: original, behavior: "instant" });
    await sleep(60);
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForImagesAndQuiet(): Promise<void> {
    const deadline = Date.now() + 8000;

    const pendingImages = Array.from(document.images).filter((img) => !img.complete);
    await Promise.race([
      Promise.allSettled(pendingImages.map((img) => img.decode().catch(() => undefined))),
      sleep(Math.max(0, deadline - Date.now())),
    ]);

    let lastMutationAt = Date.now();
    const observer = new MutationObserver(() => {
      lastMutationAt = Date.now();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    while (Date.now() < deadline) {
      if (Date.now() - lastMutationAt > 300) break;
      await sleep(50);
    }
    observer.disconnect();
  }

  function classifyPinnedElements(): void {
    pinnedElements = [];
    const candidates = new Set<Element>();

    const samplePoints: Array<[number, number]> = [
      [window.innerWidth / 2, 5],
      [window.innerWidth / 2, window.innerHeight - 5],
      [10, 5],
      [window.innerWidth - 10, window.innerHeight - 5],
    ];
    for (const [x, y] of samplePoints) {
      for (const el of document.elementsFromPoint(x, y)) {
        candidates.add(el);
      }
    }

    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;

      const rect = el.getBoundingClientRect();
      const kind: PinnedKind = rect.top < window.innerHeight / 2 ? "top" : "bottom";
      pinnedElements.push({ el, kind, originalVisibility: el.style.visibility });
      el.setAttribute(PINNED_ATTR, kind);
    }
  }

  function injectFreezeStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html { scroll-behavior: auto !important; }
      *, *::before, *::after { animation-play-state: paused !important; transition: none !important; }
      html::-webkit-scrollbar { display: none; }
    `;
    document.documentElement.appendChild(style);
    document.querySelectorAll("video").forEach((v) => v.pause());
  }

  function removeFreezeStyle(): void {
    document.getElementById(STYLE_ID)?.remove();
  }

  function applyPinnedVisibility(isFirstSlice: boolean, isLastSlice: boolean): void {
    for (const p of pinnedElements) {
      const shouldShow = (p.kind === "top" && isFirstSlice) || (p.kind === "bottom" && isLastSlice);
      p.el.style.visibility = shouldShow ? p.originalVisibility : "hidden";
    }
  }

  function restorePinnedElements(): void {
    for (const p of pinnedElements) {
      p.el.style.visibility = p.originalVisibility;
      p.el.removeAttribute(PINNED_ATTR);
    }
    pinnedElements = [];
  }

  async function handlePrep() {
    const lazyImagesForced = forceEagerLoading();
    await primingScrollPass();
    await waitForImagesAndQuiet();
    classifyPinnedElements();
    injectFreezeStyle();

    const doc = document.scrollingElement ?? document.documentElement;
    totalHeightCss = doc.scrollHeight;
    const metrics = {
      viewportWidthCss: window.innerWidth,
      viewportHeightCss: window.innerHeight,
      totalHeightCss,
      dpr: window.devicePixelRatio || 1,
    };

    applyPinnedVisibility(true, totalHeightCss <= window.innerHeight);

    return {
      metrics,
      pinnedElementsHandled: pinnedElements.length,
      lazyImagesForced,
      warnings: [] as string[],
    };
  }

  async function handleScrollTo(targetCss: number) {
    window.scrollTo({ top: targetCss, behavior: "instant" });
    await sleep(2 * 16 + 150);

    const doc = document.scrollingElement ?? document.documentElement;
    const actualScrollCss = doc.scrollTop;

    const isFirstSlice = targetCss <= 0;
    const isLastSlice = actualScrollCss + window.innerHeight >= totalHeightCss - 1;
    applyPinnedVisibility(isFirstSlice, isLastSlice);
    // Re-settle after visibility toggles so the capture doesn't race a
    // layout/paint that's still catching up.
    await sleep(2 * 16);

    return { actualScrollCss };
  }

  function handleRestore() {
    restorePinnedElements();
    removeFreezeStyle();
    return { ok: true as const };
  }

  interface SelectedRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  // Selected-area capture is deliberately viewport-only (no scrolling
  // involved) — the user drags a rect over what's currently on screen, we
  // capture the visible tab once, and crop. A scrollable-page selection tool
  // is a distinct, more complex feature (has to reconcile the selection with
  // the scroll/stitch pipeline) and isn't in this MVP's scope.
  function handleSelectArea(): Promise<{ rect: SelectedRect | null; dpr: number }> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.15);";
      const selBox = document.createElement("div");
      selBox.style.cssText =
        "position:fixed;border:2px solid #4f7cff;background:rgba(79,124,255,0.15);display:none;z-index:2147483647;pointer-events:none;";
      const hint = document.createElement("div");
      hint.textContent = "Drag to select an area — Esc to cancel";
      hint.style.cssText =
        "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#222;color:#fff;" +
        "padding:6px 12px;border-radius:6px;font:13px system-ui, sans-serif;z-index:2147483647;pointer-events:none;";
      document.documentElement.append(overlay, selBox, hint);

      let startX = 0;
      let startY = 0;
      let dragging = false;
      let settled = false;

      function cleanup(): void {
        document.removeEventListener("keydown", onKeyDown, true);
        overlay.remove();
        selBox.remove();
        hint.remove();
      }

      function finish(rect: SelectedRect | null): void {
        if (settled) return;
        settled = true;
        cleanup();
        // One repaint cycle so the overlay is actually gone from the frame
        // captureVisibleTab reads a moment later.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ rect, dpr: window.devicePixelRatio || 1 })));
      }

      function onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") finish(null);
      }
      document.addEventListener("keydown", onKeyDown, true);

      overlay.addEventListener("mousedown", (e) => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        selBox.style.display = "block";
        selBox.style.left = `${startX}px`;
        selBox.style.top = `${startY}px`;
        selBox.style.width = "0px";
        selBox.style.height = "0px";
      });
      overlay.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        selBox.style.left = `${x}px`;
        selBox.style.top = `${y}px`;
        selBox.style.width = `${Math.abs(e.clientX - startX)}px`;
        selBox.style.height = `${Math.abs(e.clientY - startY)}px`;
      });
      overlay.addEventListener("mouseup", (e) => {
        if (!dragging) return;
        dragging = false;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const width = Math.abs(e.clientX - startX);
        const height = Math.abs(e.clientY - startY);
        if (width < 3 || height < 3) {
          finish(null);
          return;
        }
        finish({ x, y, width, height });
      });
    });
  }

  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const request = message as { action?: string; targetCss?: number };

    if (request.action === "prep") {
      handlePrep().then(sendResponse);
      return true;
    }
    if (request.action === "scrollTo" && typeof request.targetCss === "number") {
      handleScrollTo(request.targetCss).then(sendResponse);
      return true;
    }
    if (request.action === "restore") {
      sendResponse(handleRestore());
      return false;
    }
    if (request.action === "selectArea") {
      handleSelectArea().then(sendResponse);
      return true;
    }
    return false;
  });
} // end re-injection guard
