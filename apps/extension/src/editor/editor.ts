// Annotation editor: opened in its own tab after a capture (see
// background/index.ts's "openEditor" handler). Pure TypeScript/canvas for
// the annotation tools — interactive UI, not correctness-critical
// geometry, so per the project's Rust/TS split they don't route through
// shot-core. (Contrast with capture/crop/stitch, which are Rust precisely
// because those results get asserted on in tests — see PLAN.md.) PDF
// export is the one thing here that *does* route through shot-core's wasm
// build, since PDF page geometry is exactly the kind of pixel-correctness
// code the project keeps in Rust — see wasm-loader below.
import { EDITOR_IMAGE_PORT_NAME } from "../chrome/blob-store";
import { saveOutput } from "../chrome/save";
import { clearWatermarkLogoDataUrl, getWatermarkLogoDataUrl, setWatermarkLogoDataUrl } from "../chrome/watermark-logo-store";
import init, * as ShotCore from "../wasm-gen/shot_core.js";
import { ext } from "../platform/webext";

type Tool = "select" | "crop" | "arrow" | "rect" | "text" | "blur" | "watermark" | null;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
// willReadFrequently: this canvas only does getImageData() readback at
// actual commit points now (see previewCanvas below for why it's no
// longer doing so on every mousemove) — still a cheap, correct hint for
// those occasional reads.
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
// Live drag previews (arrow/rect/blur outline, crop marquee+handles) draw
// here instead of on `canvas` — see editor.html's comment on
// #previewCanvas. This canvas is GPU-backed (no willReadFrequently; we
// never read pixels back from it) and only ever cleared/drawn with cheap
// shape primitives, so its cost is independent of the main capture's
// resolution — unlike the getImageData/putImageData round-trip the old
// "restore snapshot, redraw" approach did on `canvas` itself every single
// mousemove, which is what made dragging (blur especially, since users
// drag it slowly and deliberately) very laggy on a large capture.
const previewCanvas = document.getElementById("previewCanvas") as HTMLCanvasElement;
const previewCtx = previewCanvas.getContext("2d")!;
const canvasWrap = document.getElementById("canvasWrap") as HTMLDivElement;
const statusEl = document.getElementById("status")!;
const toolButtons = document.querySelectorAll<HTMLButtonElement>("#toolbar button[data-tool]");
const cropApplyBtn = document.getElementById("cropApply") as HTMLButtonElement;
const cropCancelBtn = document.getElementById("cropCancel") as HTMLButtonElement;

let currentTool: Tool = null;
let currentDpr = 1;

// Two kinds, because "before" state costs very different amounts to
// capture depending on what changed. Crop resizes canvas.width/height, so
// undoing it needs the whole prior canvas back — a plain ImageData (which
// putImageData will silently clip instead of resizing the canvas back to)
// isn't enough on its own, hence "full" carrying its own dimensions.
// Arrow/rect/blur/text never resize the canvas and only ever touch a
// small region of it — capturing the whole canvas for those (as this used
// to do unconditionally) meant every commit after the first paid a
// multi-megapixel getImageData/putImageData cost on a full-page capture,
// regardless of how small the shape actually was. "region" captures just
// the bounding box commitPendingShape() is about to touch — see
// shapeBoundingBox() below.
type Snapshot = { kind: "full"; width: number; height: number; data: ImageData } | { kind: "region"; x: number; y: number; data: ImageData };

const undoStack: Snapshot[] = [];
const MAX_HISTORY = 20;

/** Keeps previewCanvas's on-screen position/size matching `canvas`'s own
 * (post max-width:100% scaling, post margin:auto centering) rendered box.
 * Must run after anything that changes canvas.width/height (load, crop,
 * undo) or could change its rendered size (window resize). offsetLeft/
 * offsetTop/clientWidth/clientHeight read canvas's own already-computed
 * layout — simpler and more robust than re-deriving the same max-width/
 * centering math by hand.
 *
 * previewCanvas's *backing buffer* is deliberately sized to its own
 * rendered CSS box (× devicePixelRatio), not to `canvas`'s full native
 * resolution — a full-page capture's buffer can be tens of millions of
 * pixels, and clearing + compositing a buffer that large on every single
 * mousemove was still expensive even with nothing but cheap shape draws on
 * it (the earlier fix here removed the getImageData/putImageData stall,
 * not this one — the GPU still has to push every pixel of whatever's
 * actually in the buffer each frame, regardless of how cheap the draw
 * calls that filled it were). A canvas 2D scale transform maps every draw
 * call below back onto this smaller buffer, so every call site still
 * thinks and works purely in `canvas`'s own buffer-space coordinates. */
function syncPreviewCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  previewCanvas.width = width;
  previewCanvas.height = height;
  previewCanvas.style.left = `${canvas.offsetLeft}px`;
  previewCanvas.style.top = `${canvas.offsetTop}px`;
  previewCanvas.style.width = `${canvas.clientWidth}px`;
  previewCanvas.style.height = `${canvas.clientHeight}px`;
  // Every draw call targeting previewCtx passes coordinates in `canvas`'s
  // buffer space (canvas.width/height) — this scale maps that space onto
  // previewCanvas's much smaller actual buffer. Resizing a canvas resets
  // its transform, so this has to be reapplied every time width/height
  // change above, not just once at startup.
  previewCtx.setTransform(width / canvas.width, 0, 0, height / canvas.height, 0, 0);
}

// Clears in `canvas`'s buffer-space coordinates (not previewCanvas's own,
// much smaller, physical pixel dimensions) — clearRect is subject to the
// same scale transform as every other draw call, so this is the size that
// actually covers the whole (transformed) buffer.
function clearPreview(): void {
  previewCtx.clearRect(0, 0, canvas.width, canvas.height);
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

function undo(): void {
  // A pending (not-yet-applied) crop marquee or shape (arrow/rect/blur/
  // text) lives on previewCanvas, outside the undo stack entirely —
  // discard it first rather than treating Undo as "pop the real stack",
  // so it doesn't survive past whatever undo() restores underneath it.
  if (pendingCrop) {
    cancelPendingCrop();
    return;
  }
  if (pendingShape) {
    cancelPendingShape();
    return;
  }
  const prev = undoStack.pop();
  if (!prev) return;
  if (prev.kind === "full") {
    canvas.width = prev.width;
    canvas.height = prev.height;
    ctx.putImageData(prev.data, 0, 0);
    syncPreviewCanvas(); // canvas dimensions may have just changed (undoing a crop)
  } else {
    ctx.putImageData(prev.data, prev.x, prev.y);
  }
}

function selectTool(tool: Tool): void {
  if (pendingCrop && tool !== "crop") cancelPendingCrop();
  // Unlike the crop marquee (discarded on tool switch), a drawn shape is
  // actual content the user made — switching away bakes it in instead of
  // losing it. Switching *to* Select is the one exception, since that's
  // specifically "let me keep adjusting what's already there."
  if (pendingShape && tool !== "select") commitPendingShape();
  currentTool = tool;
  toolButtons.forEach((b) => b.classList.toggle("active", b.dataset["tool"] === tool));
  canvas.style.cursor = tool === "text" ? "text" : tool === "select" ? "default" : "crosshair";
}

// --- drag-based tools (arrow, rect, blur) ---------------------------------

let dragStart: { x: number; y: number } | null = null;

// The canvas displays scaled to fit the window (see editor.html's
// `max-width:100%; height:auto`) rather than always at its native pixel
// size — a retina/high-DPR capture would otherwise render at up to 2-3x
// the size it actually appeared on the page, overflowing the window. Every
// mouse position arrives in CSS/client pixels, so it has to be converted
// into canvas-buffer pixels (what canvas.width/height and every draw call
// here actually operate in) via this ratio before use.
function displayScale(): number {
  const rect = canvas.getBoundingClientRect();
  return rect.width > 0 ? canvas.width / rect.width : 1;
}

function canvasPoint(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scale = displayScale();
  return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
}

// All four drawing helpers below take an explicit target context — either
// `ctx` (the real canvas, for a final commit) or `previewCtx` (the
// overlay, for a live drag preview) — rather than assuming `ctx`, so the
// exact same drawing code produces both.

function drawArrow(target: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  target.strokeStyle = "#ff3b30";
  target.fillStyle = "#ff3b30";
  target.lineWidth = 3;
  target.beginPath();
  target.moveTo(x0, y0);
  target.lineTo(x1, y1);
  target.stroke();

  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = 14;
  target.beginPath();
  target.moveTo(x1, y1);
  target.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
  target.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
  target.closePath();
  target.fill();
}

function drawRect(target: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  target.strokeStyle = "#ff3b30";
  target.lineWidth = 3;
  target.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
}

function drawCropPreview(target: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  target.save();
  target.strokeStyle = "#4f7cff";
  target.lineWidth = 2;
  target.setLineDash([6, 4]);
  target.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  target.restore();
}

/** Clamps a drag's two endpoints to a rect within the canvas — shared by
 * the crop and blur tools. Returns null if the drag was too small to be
 * an intentional selection (an accidental click, not a real drag). */
function dragRect(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; width: number; height: number } | null {
  const x = Math.max(0, Math.round(Math.min(x0, x1)));
  const y = Math.max(0, Math.round(Math.min(y0, y1)));
  const width = Math.min(canvas.width - x, Math.round(Math.abs(x1 - x0)));
  const height = Math.min(canvas.height - y, Math.round(Math.abs(y1 - y0)));
  if (width < 2 || height < 2) return null;
  return { x, y, width, height };
}

/** Commits a crop: shrinks the canvas itself to the given rect, discarding
 * everything outside it. */
function applyCrop(rect: { x: number; y: number; width: number; height: number }): void {
  const cropped = ctx.getImageData(rect.x, rect.y, rect.width, rect.height);
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.putImageData(cropped, 0, 0);
  syncPreviewCanvas();
  setStatus(`${rect.width}×${rect.height}`);
}

// --- crop tool: adjustable selection with auto-scroll ----------------------
//
// Unlike arrow/rect/blur (single drag, committed immediately on release),
// crop is two-phase: an initial drag defines a marquee, then the user can
// resize it via corner/edge handles or reposition it by dragging inside it
// — nothing is applied to the actual canvas until they click "Apply Crop"
// (or press Enter), or discard it via "Cancel Crop" (or Escape). The page
// screenshots this operates on are routinely taller than the editor
// window, so #canvasWrap (a scrollable container — see editor.html) also
// auto-scrolls while the cursor sits near its edge during any of the three
// drag sub-modes, the same way desktop image editors handle a selection
// larger than the visible canvas.

type Rect = { x: number; y: number; width: number; height: number };
type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type CropDragMode = "draw" | "move" | "resize" | null;

const HANDLE_SIZE = 10; // target on-screen (CSS px) size, not canvas-buffer px
const AUTO_SCROLL_EDGE = 36; // px from #canvasWrap's edge that triggers scrolling
const AUTO_SCROLL_MAX_SPEED = 18; // px per animation frame at the very edge

/** HANDLE_SIZE converted to canvas-buffer pixels, so the resize handles
 * stay a consistent visual size on screen regardless of how much the
 * canvas is currently scaled down to fit the window. */
function handleSizeBuffer(): number {
  return HANDLE_SIZE * displayScale();
}

let pendingCrop: Rect | null = null;
let cropDragMode: CropDragMode = null;
let cropResizeHandle: CropHandle | null = null;
let cropDragOrigRect: Rect | null = null;
let cropDragAnchor: { x: number; y: number } | null = null;
let lastClientPos: { x: number; y: number } | null = null;
let autoScrollRafId: number | null = null;

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pointFromClient(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scale = displayScale();
  return {
    x: clampNum((clientX - rect.left) * scale, 0, canvas.width),
    y: clampNum((clientY - rect.top) * scale, 0, canvas.height),
  };
}

function handlePositions(r: Rect): Record<CropHandle, { x: number; y: number }> {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return {
    nw: { x: r.x, y: r.y },
    n: { x: cx, y: r.y },
    ne: { x: r.x + r.width, y: r.y },
    e: { x: r.x + r.width, y: cy },
    se: { x: r.x + r.width, y: r.y + r.height },
    s: { x: cx, y: r.y + r.height },
    sw: { x: r.x, y: r.y + r.height },
    w: { x: r.x, y: cy },
  };
}

function hitTestHandle(r: Rect, p: { x: number; y: number }): CropHandle | null {
  const size = handleSizeBuffer();
  for (const [name, pos] of Object.entries(handlePositions(r)) as [CropHandle, { x: number; y: number }][]) {
    if (Math.abs(p.x - pos.x) <= size && Math.abs(p.y - pos.y) <= size) return name;
  }
  return null;
}

function pointInRect(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

function resizeRect(orig: Rect, handle: CropHandle, p: { x: number; y: number }): Rect {
  let x0 = orig.x;
  let y0 = orig.y;
  let x1 = orig.x + orig.width;
  let y1 = orig.y + orig.height;
  if (handle.includes("w")) x0 = clampNum(p.x, 0, x1 - 1);
  if (handle.includes("e")) x1 = clampNum(p.x, x0 + 1, canvas.width);
  if (handle.includes("n")) y0 = clampNum(p.y, 0, y1 - 1);
  if (handle.includes("s")) y1 = clampNum(p.y, y0 + 1, canvas.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function moveRect(orig: Rect, anchor: { x: number; y: number }, p: { x: number; y: number }): Rect {
  return {
    x: clampNum(orig.x + (p.x - anchor.x), 0, canvas.width - orig.width),
    y: clampNum(orig.y + (p.y - anchor.y), 0, canvas.height - orig.height),
    width: orig.width,
    height: orig.height,
  };
}

function drawCropHandles(target: CanvasRenderingContext2D, r: Rect): void {
  target.save();
  target.fillStyle = "#4f7cff";
  target.strokeStyle = "#ffffff";
  target.lineWidth = 1;
  const size = handleSizeBuffer();
  for (const pos of Object.values(handlePositions(r))) {
    target.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
    target.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
  }
  target.restore();
}

// The marquee/handles draw on previewCanvas, never on the real canvas — it
// stays untouched (and thus doesn't need restoring) for the whole
// adjustable phase, so this just redraws the overlay from scratch.
function renderCropOverlay(r: Rect): void {
  clearPreview();
  drawCropPreview(previewCtx, r.x, r.y, r.x + r.width, r.y + r.height);
  drawCropHandles(previewCtx, r);
}

function updateCropActionButtons(): void {
  // "" (remove inline override) would fall back to the stylesheet's own
  // `#cropApply, #cropCancel { display: none; }` rule and stay hidden —
  // needs an explicit visible value to actually win the cascade.
  // inline-flex (not inline-block) matches .btn's own display value, so
  // its icon+label row stays centered instead of reflowing as a block.
  const display = pendingCrop !== null ? "inline-flex" : "none";
  cropApplyBtn.style.display = display;
  cropCancelBtn.style.display = display;
}

function cancelPendingCrop(): void {
  clearPreview();
  pendingCrop = null;
  updateCropActionButtons();
}

function commitPendingCrop(): void {
  if (!pendingCrop) return;
  clearPreview();
  // Taken now, at the actual commit — not per-frame during adjustment,
  // since the real canvas was never touched until this exact point.
  const preCropSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  undoStack.push({ kind: "full", width: canvas.width, height: canvas.height, data: preCropSnapshot });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  applyCrop(pendingCrop);
  pendingCrop = null;
  updateCropActionButtons();
}

function updateCropDrag(): void {
  if (!lastClientPos || !cropDragMode) return;
  const p = pointFromClient(lastClientPos.x, lastClientPos.y);
  if (cropDragMode === "draw" && dragStart) {
    clearPreview();
    drawCropPreview(previewCtx, dragStart.x, dragStart.y, p.x, p.y);
  } else if (cropDragMode === "resize" && cropDragOrigRect && cropResizeHandle) {
    pendingCrop = resizeRect(cropDragOrigRect, cropResizeHandle, p);
    renderCropOverlay(pendingCrop);
  } else if (cropDragMode === "move" && cropDragOrigRect && cropDragAnchor) {
    pendingCrop = moveRect(cropDragOrigRect, cropDragAnchor, p);
    renderCropOverlay(pendingCrop);
  }
}

// While any crop drag is active, scroll #canvasWrap toward the cursor once
// it's within AUTO_SCROLL_EDGE px of the wrapper's boundary — driven by a
// rAF loop rather than the mousemove event, since the cursor doesn't move
// (and so fires no mousemove) while the page scrolls underneath it.
function autoScrollStep(): void {
  if (!lastClientPos || !cropDragMode) {
    autoScrollRafId = null;
    return;
  }
  const wrapRect = canvasWrap.getBoundingClientRect();
  let vy = 0;
  let vx = 0;
  const distTop = lastClientPos.y - wrapRect.top;
  const distBottom = wrapRect.bottom - lastClientPos.y;
  if (distTop < AUTO_SCROLL_EDGE) vy = -AUTO_SCROLL_MAX_SPEED * (1 - clampNum(distTop, 0, AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
  else if (distBottom < AUTO_SCROLL_EDGE) vy = AUTO_SCROLL_MAX_SPEED * (1 - clampNum(distBottom, 0, AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
  const distLeft = lastClientPos.x - wrapRect.left;
  const distRight = wrapRect.right - lastClientPos.x;
  if (distLeft < AUTO_SCROLL_EDGE) vx = -AUTO_SCROLL_MAX_SPEED * (1 - clampNum(distLeft, 0, AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);
  else if (distRight < AUTO_SCROLL_EDGE) vx = AUTO_SCROLL_MAX_SPEED * (1 - clampNum(distRight, 0, AUTO_SCROLL_EDGE) / AUTO_SCROLL_EDGE);

  if (vy !== 0 || vx !== 0) {
    canvasWrap.scrollTop += vy;
    canvasWrap.scrollLeft += vx;
    updateCropDrag();
  }
  autoScrollRafId = requestAnimationFrame(autoScrollStep);
}

function startAutoScrollTracking(): void {
  if (autoScrollRafId === null) autoScrollRafId = requestAnimationFrame(autoScrollStep);
}

function stopAutoScrollTracking(): void {
  if (autoScrollRafId !== null) {
    cancelAnimationFrame(autoScrollRafId);
    autoScrollRafId = null;
  }
}

function handleCropMouseDown(p: { x: number; y: number }): void {
  if (pendingCrop) {
    const handle = hitTestHandle(pendingCrop, p);
    if (handle) {
      cropDragMode = "resize";
      cropResizeHandle = handle;
      cropDragOrigRect = pendingCrop;
      startAutoScrollTracking();
      return;
    }
    if (pointInRect(pendingCrop, p)) {
      cropDragMode = "move";
      cropDragAnchor = p;
      cropDragOrigRect = pendingCrop;
      startAutoScrollTracking();
      return;
    }
    // Clicked outside the existing marquee — discard it and start fresh,
    // same as most image editors' crop tools.
    cancelPendingCrop();
  }
  cropDragMode = "draw";
  dragStart = p;
  startAutoScrollTracking();
}

function handleCropMouseUp(p: { x: number; y: number }): void {
  stopAutoScrollTracking();
  const mode = cropDragMode;
  cropDragMode = null;

  if (mode === "draw") {
    const start = dragStart;
    dragStart = null;
    const rect = start ? dragRect(start.x, start.y, p.x, p.y) : null;
    if (!rect) {
      clearPreview();
      return; // too small to be an intentional selection — no marquee left behind
    }
    pendingCrop = rect;
    renderCropOverlay(pendingCrop);
    updateCropActionButtons();
  } else if (mode === "resize" || mode === "move") {
    // pendingCrop was already kept live by updateCropDrag(); just clear
    // the transient per-drag state, leaving the marquee up for further
    // adjustment or Apply/Cancel.
    cropDragOrigRect = null;
    cropResizeHandle = null;
    cropDragAnchor = null;
  }
}

/** Mosaic-style pixelation: each blockSize×blockSize block is replaced by
 * its own average color — an irreversible blur, not a cosmetic filter. */
function pixelateRegion(x: number, y: number, width: number, height: number): void {
  if (width < 1 || height < 1) return;
  const blockSize = Math.max(6, Math.round(Math.min(width, height) / 12));
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const bw = Math.min(blockSize, width - bx);
      const bh = Math.min(blockSize, height - by);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      const count = bw * bh;
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const off = ((by + dy) * width + (bx + dx)) * 4;
          r += data[off]!;
          g += data[off + 1]!;
          b += data[off + 2]!;
          a += data[off + 3]!;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);
      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const off = ((by + dy) * width + (bx + dx)) * 4;
          data[off] = r;
          data[off + 1] = g;
          data[off + 2] = b;
          data[off + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imageData, x, y);
}

// --- pending shape: arrow/rect/blur/text stay "live" (movable, resizable,
// via the Select tool or by re-grabbing the handles with the tool that
// drew them) instead of being baked into the canvas the instant they're
// drawn — that's what made it impossible to nudge or resize an arrow/
// rectangle/text box after the fact. Only one shape is ever pending at a
// time: starting a new one, or clicking away from it with the Select
// tool, bakes ("commits") whatever was pending into the real canvas
// first. Already-baked pixels (from earlier in the session, or before
// this feature existed) are not retroactively selectable — the same
// one-thing-at-a-time tradeoff the crop marquee above already makes, in
// exchange for a much simpler mental model than a full layer stack.

type PendingShape =
  | { kind: "arrow"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "rect"; rect: Rect }
  | { kind: "blur"; rect: Rect }
  | { kind: "text"; rect: Rect; value: string; fontSizeBuffer: number }
  | { kind: "watermark"; rect: Rect; text: string; logoBitmap: ImageBitmap | null; opacity: number };

type ArrowHandle = "start" | "end";
type ShapeDrawKind = "arrow" | "rect" | "blur";

let pendingShape: PendingShape | null = null;
let shapeDrawKind: ShapeDrawKind | null = null;
let shapeDragMode: "move" | "resize" | null = null;
let shapeResizeHandle: CropHandle | ArrowHandle | null = null;
let shapeDragOrig: PendingShape | null = null;
let shapeDragAnchor: { x: number; y: number } | null = null;

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? clampNum(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Where (if anywhere) a point hits the pending shape — a resize handle,
 * or its body (for a move). Shared by the Select tool and by arrow/rect/
 * blur's own tool re-adjusting the shape they just drew instead of
 * starting a new one on top of it. */
function hitTestShape(shape: PendingShape, p: { x: number; y: number }): { mode: "resize"; handle: CropHandle | ArrowHandle } | { mode: "move" } | null {
  const size = handleSizeBuffer();
  if (shape.kind === "arrow") {
    if (Math.hypot(p.x - shape.x0, p.y - shape.y0) <= size) return { mode: "resize", handle: "start" };
    if (Math.hypot(p.x - shape.x1, p.y - shape.y1) <= size) return { mode: "resize", handle: "end" };
    if (distanceToSegment(p, { x: shape.x0, y: shape.y0 }, { x: shape.x1, y: shape.y1 }) <= size) return { mode: "move" };
    return null;
  }
  const handle = hitTestHandle(shape.rect, p);
  if (handle) return { mode: "resize", handle };
  if (pointInRect(shape.rect, p)) return { mode: "move" };
  return null;
}

function drawPointHandle(target: CanvasRenderingContext2D, x: number, y: number): void {
  target.save();
  target.fillStyle = "#4f7cff";
  target.strokeStyle = "#ffffff";
  target.lineWidth = 1;
  const size = handleSizeBuffer();
  target.beginPath();
  target.arc(x, y, size / 2, 0, Math.PI * 2);
  target.fill();
  target.stroke();
  target.restore();
}

function drawTextShape(target: CanvasRenderingContext2D, shape: { rect: Rect; value: string; fontSizeBuffer: number }): void {
  target.fillStyle = "#ff3b30";
  target.font = `${shape.fontSizeBuffer}px system-ui, sans-serif`;
  target.textBaseline = "top";
  target.fillText(shape.value, shape.rect.x, shape.rect.y);
}

/** Logo (if any) fills the top of the box preserving its own aspect ratio;
 * text (if any) sits below it, or centered alone if there's no logo.
 * White fill with a black stroke rather than a single solid color, since a
 * watermark has to stay legible over whatever's underneath it — a capture
 * can be light or dark at that exact spot and there's no way to know which
 * in advance. */
function drawWatermark(target: CanvasRenderingContext2D, shape: Extract<PendingShape, { kind: "watermark" }>): void {
  const { rect, text, logoBitmap, opacity } = shape;
  target.save();
  target.globalAlpha = opacity;
  const logoAreaHeight = logoBitmap && text ? rect.height * 0.6 : rect.height;
  let textTop = rect.y;
  if (logoBitmap) {
    const scale = Math.min(rect.width / logoBitmap.width, logoAreaHeight / logoBitmap.height);
    const w = logoBitmap.width * scale;
    const h = logoBitmap.height * scale;
    target.drawImage(logoBitmap, rect.x + (rect.width - w) / 2, rect.y + (logoAreaHeight - h) / 2, w, h);
    textTop = rect.y + logoAreaHeight;
  }
  if (text) {
    const textAreaHeight = rect.y + rect.height - textTop;
    const fontSize = Math.max(10, Math.min(textAreaHeight * 0.7, (rect.width / Math.max(1, text.length)) * 1.7));
    target.font = `${fontSize}px system-ui, sans-serif`;
    target.textAlign = "center";
    target.textBaseline = "middle";
    target.lineWidth = Math.max(2, fontSize / 8);
    target.strokeStyle = "#000000";
    target.fillStyle = "#ffffff";
    const tx = rect.x + rect.width / 2;
    const ty = textTop + textAreaHeight / 2;
    target.strokeText(text, tx, ty);
    target.fillText(text, tx, ty);
  }
  target.restore();
}

// The pending shape (and its handles) draws on previewCanvas, never on
// the real canvas — nothing here is applied until commitPendingShape().
function renderPendingShape(): void {
  clearPreview();
  if (!pendingShape) return;
  if (pendingShape.kind === "arrow") {
    drawArrow(previewCtx, pendingShape.x0, pendingShape.y0, pendingShape.x1, pendingShape.y1);
    drawPointHandle(previewCtx, pendingShape.x0, pendingShape.y0);
    drawPointHandle(previewCtx, pendingShape.x1, pendingShape.y1);
  } else if (pendingShape.kind === "rect") {
    const r = pendingShape.rect;
    drawRect(previewCtx, r.x, r.y, r.x + r.width, r.y + r.height);
    drawCropHandles(previewCtx, r);
  } else if (pendingShape.kind === "blur") {
    // Dashed selection outline, not a solid red rect — visually this is a
    // pending *operation area* like the crop marquee, not a permanent
    // red-ink annotation like arrow/rect.
    const r = pendingShape.rect;
    drawCropPreview(previewCtx, r.x, r.y, r.x + r.width, r.y + r.height);
    drawCropHandles(previewCtx, r);
  } else if (pendingShape.kind === "watermark") {
    drawWatermark(previewCtx, pendingShape);
    drawCropHandles(previewCtx, pendingShape.rect);
  } else {
    drawTextShape(previewCtx, pendingShape);
    drawCropHandles(previewCtx, pendingShape.rect);
  }
}

function cancelPendingShape(): void {
  clearPreview();
  pendingShape = null;
}

/** Bounding box (canvas-buffer px, clamped to the canvas) of the pixels a
 * pending shape's commit is about to touch, padded well past its stroke
 * width/arrowhead reach/font-metric overshoot — see the Snapshot type's
 * comment for why commitPendingShape() needs this instead of just
 * snapshotting the whole canvas. Getting the padding wrong in the wrong
 * direction (too small) would leave undo unable to fully restore what was
 * there before, so it's generous rather than tight. */
function shapeBoundingBox(shape: PendingShape): Rect {
  const MARGIN = 20;
  const r =
    shape.kind === "arrow"
      ? {
          x: Math.min(shape.x0, shape.x1),
          y: Math.min(shape.y0, shape.y1),
          width: Math.abs(shape.x1 - shape.x0),
          height: Math.abs(shape.y1 - shape.y0),
        }
      : shape.rect;
  const x = clampNum(r.x - MARGIN, 0, canvas.width);
  const y = clampNum(r.y - MARGIN, 0, canvas.height);
  const right = clampNum(r.x + r.width + MARGIN, 0, canvas.width);
  const bottom = clampNum(r.y + r.height + MARGIN, 0, canvas.height);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

/** Bakes the pending shape into the real canvas — the only point any of
 * arrow/rect/blur/text actually touch `ctx`'s pixels, mirroring how crop
 * only touches the canvas at commitPendingCrop(). */
function commitPendingShape(): void {
  if (!pendingShape) return;
  clearPreview();
  const box = shapeBoundingBox(pendingShape);
  const preSnapshot = ctx.getImageData(box.x, box.y, box.width, box.height);
  undoStack.push({ kind: "region", x: box.x, y: box.y, data: preSnapshot });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();

  if (pendingShape.kind === "arrow") {
    drawArrow(ctx, pendingShape.x0, pendingShape.y0, pendingShape.x1, pendingShape.y1);
  } else if (pendingShape.kind === "rect") {
    const r = pendingShape.rect;
    drawRect(ctx, r.x, r.y, r.x + r.width, r.y + r.height);
  } else if (pendingShape.kind === "blur") {
    const r = pendingShape.rect;
    pixelateRegion(r.x, r.y, r.width, r.height);
  } else if (pendingShape.kind === "watermark") {
    drawWatermark(ctx, pendingShape);
  } else {
    drawTextShape(ctx, pendingShape);
  }
  pendingShape = null;
}

function startShapeAdjust(hit: { mode: "resize"; handle: CropHandle | ArrowHandle } | { mode: "move" }, p: { x: number; y: number }): void {
  if (!pendingShape) return;
  shapeDragOrig = pendingShape;
  if (hit.mode === "move") {
    shapeDragMode = "move";
    shapeDragAnchor = p;
  } else {
    shapeDragMode = "resize";
    shapeResizeHandle = hit.handle;
  }
}

function updateShapeDrag(p: { x: number; y: number }): void {
  if (!pendingShape || !shapeDragOrig || !shapeDragMode) return;
  if (pendingShape.kind === "arrow" && shapeDragOrig.kind === "arrow") {
    const orig = shapeDragOrig;
    if (shapeDragMode === "move" && shapeDragAnchor) {
      const dx = p.x - shapeDragAnchor.x;
      const dy = p.y - shapeDragAnchor.y;
      pendingShape = { kind: "arrow", x0: orig.x0 + dx, y0: orig.y0 + dy, x1: orig.x1 + dx, y1: orig.y1 + dy };
    } else if (shapeDragMode === "resize" && shapeResizeHandle === "start") {
      pendingShape = { kind: "arrow", x0: p.x, y0: p.y, x1: orig.x1, y1: orig.y1 };
    } else if (shapeDragMode === "resize" && shapeResizeHandle === "end") {
      pendingShape = { kind: "arrow", x0: orig.x0, y0: orig.y0, x1: p.x, y1: p.y };
    }
  } else if (pendingShape.kind !== "arrow" && shapeDragOrig.kind !== "arrow") {
    const origRect = shapeDragOrig.rect;
    let newRect: Rect | null = null;
    if (shapeDragMode === "move" && shapeDragAnchor) {
      newRect = moveRect(origRect, shapeDragAnchor, p);
    } else if (shapeDragMode === "resize" && shapeResizeHandle && shapeResizeHandle !== "start" && shapeResizeHandle !== "end") {
      newRect = resizeRect(origRect, shapeResizeHandle, p);
    }
    if (!newRect) return;
    if (pendingShape.kind === "rect") pendingShape = { kind: "rect", rect: newRect };
    else if (pendingShape.kind === "blur") pendingShape = { kind: "blur", rect: newRect };
    else if (pendingShape.kind === "watermark") pendingShape = { ...pendingShape, rect: newRect };
    else if (pendingShape.kind === "text" && shapeDragOrig.kind === "text") {
      // Resizing a text box scales its font size with the box height —
      // there's no sensible "reflow" for a single line of canvas text, so
      // dragging a corner just scales it, the same way most simple
      // annotation tools handle resizing text.
      const scale = origRect.height > 0 ? newRect.height / origRect.height : 1;
      const fontSizeBuffer = Math.max(6, shapeDragOrig.fontSizeBuffer * scale);
      pendingShape = { kind: "text", rect: newRect, value: shapeDragOrig.value, fontSizeBuffer };
    }
  }
  renderPendingShape();
}

function endShapeDrag(): void {
  shapeDragMode = null;
  shapeResizeHandle = null;
  shapeDragOrig = null;
  shapeDragAnchor = null;
}

canvas.addEventListener("mousedown", (e) => {
  const p = canvasPoint(e);

  if (currentTool === "crop") {
    lastClientPos = { x: e.clientX, y: e.clientY };
    handleCropMouseDown(pointFromClient(e.clientX, e.clientY));
    return;
  }

  if (currentTool === "select") {
    if (pendingShape) {
      const hit = hitTestShape(pendingShape, p);
      if (hit) {
        startShapeAdjust(hit, p);
        return;
      }
      commitPendingShape(); // clicked elsewhere — done adjusting
    }
    return;
  }

  if (currentTool === "arrow" || currentTool === "rect" || currentTool === "blur") {
    if (pendingShape) {
      const hit = hitTestShape(pendingShape, p);
      if (hit) {
        startShapeAdjust(hit, p);
        return;
      }
      commitPendingShape(); // clicked elsewhere — bake the old one, start fresh
    }
    shapeDrawKind = currentTool;
    // No canvas snapshot here — the real canvas isn't touched until the
    // actual commit, only previewCanvas is drawn to during the drag
    // itself (see editor.html's #previewCanvas comment).
    dragStart = p;
    return;
  }

  if (currentTool === "text") {
    if (pendingShape) {
      if (pendingShape.kind === "text") {
        const hit = hitTestShape(pendingShape, p);
        if (hit) {
          startShapeAdjust(hit, p);
          return;
        }
      }
      commitPendingShape();
    }
    // `canvas` isn't itself focusable, so the browser's own default
    // mousedown handling blurs whatever's currently focused once this
    // event finishes — including the <input> startTextInput is about to
    // create and focus, synchronously undoing that focus() call before a
    // single frame renders. This is what actually made the text tool look
    // like it did nothing at all: the input existed for a moment, then
    // lost focus immediately and (per its own blur handler) removed
    // itself. preventDefault() here is what lets the focus stick.
    e.preventDefault();
    startTextInput(p, { x: e.clientX, y: e.clientY });
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (currentTool === "crop" && cropDragMode) {
    lastClientPos = { x: e.clientX, y: e.clientY };
    updateCropDrag();
    return;
  }
  const p = canvasPoint(e);
  if (shapeDragMode) {
    updateShapeDrag(p);
    return;
  }
  if (!dragStart || !shapeDrawKind) return;
  clearPreview();
  if (shapeDrawKind === "arrow") drawArrow(previewCtx, dragStart.x, dragStart.y, p.x, p.y);
  else if (shapeDrawKind === "rect") drawRect(previewCtx, dragStart.x, dragStart.y, p.x, p.y);
  else if (shapeDrawKind === "blur") drawCropPreview(previewCtx, dragStart.x, dragStart.y, p.x, p.y);
});

canvas.addEventListener("mouseup", (e) => {
  if (currentTool === "crop" && cropDragMode) {
    handleCropMouseUp(pointFromClient(e.clientX, e.clientY));
    return;
  }
  if (shapeDragMode) {
    endShapeDrag(); // pendingShape was already kept live by updateShapeDrag(); stays up for further adjustment
    return;
  }
  if (!dragStart || !shapeDrawKind) return;
  const p = canvasPoint(e);
  const start = dragStart;
  const kind = shapeDrawKind;
  dragStart = null;
  shapeDrawKind = null;
  clearPreview();

  if (kind === "arrow") {
    if (Math.hypot(p.x - start.x, p.y - start.y) < 4) return; // accidental click, not a real drag
    pendingShape = { kind: "arrow", x0: start.x, y0: start.y, x1: p.x, y1: p.y };
  } else {
    const rect = dragRect(start.x, start.y, p.x, p.y);
    if (!rect) return;
    pendingShape = kind === "rect" ? { kind: "rect", rect } : { kind: "blur", rect };
  }
  renderPendingShape();
});

// Double-click an existing pending text shape to re-edit its value —
// single-click (handled above, via hitTestShape) only moves/resizes it,
// since a plain click is also how a *new* text box gets placed.
canvas.addEventListener("dblclick", (e) => {
  if (!pendingShape || pendingShape.kind !== "text") return;
  const p = canvasPoint(e);
  if (!pointInRect(pendingShape.rect, p)) return;
  const existing = pendingShape;
  pendingShape = null;
  clearPreview();
  startTextInput({ x: existing.rect.x, y: existing.rect.y }, { x: e.clientX, y: e.clientY }, existing);
});

// --- text tool -------------------------------------------------------------

/** `bufferPos` is where the text will actually be drawn (canvas-buffer
 * space, what `pendingShape`/`ctx.fillText` operate in); `clientPos` is
 * only for placing the floating <input> the user types into, in real CSS
 * pixels. These are NOT the same number once the canvas is displayed at
 * anything other than 1:1 scale (i.e. almost always — see
 * displayScale()) — conflating them is what previously placed the input
 * far outside the visible page for any capture wider than the editor
 * window, silently: it wasn't that the text tool did nothing, it created
 * the input off-screen every time. `existing` re-opens the input
 * pre-filled, for double-click-to-edit on an already-placed text shape. */
function startTextInput(
  bufferPos: { x: number; y: number },
  clientPos: { x: number; y: number },
  existing?: Extract<PendingShape, { kind: "text" }>,
): void {
  const rect = canvas.getBoundingClientRect();
  const scale = displayScale();
  const cssLeft = clientPos.x - rect.left + canvas.offsetLeft;
  const cssTop = clientPos.y - rect.top + canvas.offsetTop;
  // Buffer-space font size (what actually gets drawn on `ctx`) — divided
  // by `scale` below just for the floating input's own on-screen CSS size,
  // so it looks the same size while typing as it will once baked in and
  // displayed at the canvas's current (possibly scaled-down) size.
  const fontSizeBuffer = existing?.fontSizeBuffer ?? 20 * scale;

  const input = document.createElement("input");
  input.type = "text";
  input.value = existing?.value ?? "";
  input.style.cssText = `position:absolute;left:${cssLeft}px;top:${cssTop}px;
    font:${fontSizeBuffer / scale}px system-ui, sans-serif;color:#ff3b30;background:transparent;border:1px dashed #ff3b30;z-index:1000;`;
  canvas.parentElement!.appendChild(input);
  input.focus();
  if (existing) input.select();

  let settled = false;
  function commit(): void {
    if (settled) return;
    settled = true;
    input.remove();
    if (!input.value.trim()) return;
    ctx.font = `${fontSizeBuffer}px system-ui, sans-serif`;
    const width = Math.max(1, ctx.measureText(input.value).width);
    const height = fontSizeBuffer * 1.2;
    pendingShape = { kind: "text", rect: { x: bufferPos.x, y: bufferPos.y, width, height }, value: input.value, fontSizeBuffer };
    renderPendingShape();
  }
  function cancel(): void {
    if (settled) return;
    settled = true;
    input.remove();
  }
  input.addEventListener("keydown", (e) => {
    // Without this, the same keypress that commits the *typed text* into
    // a pending shape (via commit(), below) also bubbles up to the
    // window-level keydown handler that commits/cancels the *pending
    // shape* — instantly re-baking the text this exact keystroke just
    // created, before the user ever gets a chance to move or resize it.
    e.stopPropagation();
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
}

// --- watermark panel ---------------------------------------------------
//
// Unlike the other tools, watermark has no drawing gesture of its own —
// there's nothing to click-and-drag on the canvas to define it, just
// configuration (text and/or a logo, how see-through it is). So the
// toolbar button opens this panel directly instead of switching into a
// persistent "watermark mode", and confirming it places the result at a
// default corner position, already adjustable via the Select tool exactly
// like any other pending shape — see the click wiring at the bottom of
// this section.

const watermarkPanel = document.getElementById("watermarkPanel")!;
const watermarkTextEl = document.getElementById("watermarkText") as HTMLInputElement;
const watermarkOpacityEl = document.getElementById("watermarkOpacity") as HTMLInputElement;
const watermarkLogoFileEl = document.getElementById("watermarkLogoFile") as HTMLInputElement;
const watermarkLogoPreviewEl = document.getElementById("watermarkLogoPreview") as HTMLImageElement;
const watermarkLogoNameEl = document.getElementById("watermarkLogoName")!;
const watermarkChooseLogoBtn = document.getElementById("watermarkChooseLogo") as HTMLButtonElement;
const watermarkRemoveLogoBtn = document.getElementById("watermarkRemoveLogo") as HTMLButtonElement;
const watermarkAddBtn = document.getElementById("watermarkAdd") as HTMLButtonElement;
const watermarkCancelBtn = document.getElementById("watermarkCancel") as HTMLButtonElement;

let watermarkLogoDataUrl: string | null = null;

function updateWatermarkAddEnabled(): void {
  watermarkAddBtn.disabled = !watermarkTextEl.value.trim() && !watermarkLogoDataUrl;
}

function showWatermarkLogoPreview(dataUrl: string | null, name: string): void {
  watermarkLogoDataUrl = dataUrl;
  watermarkLogoPreviewEl.hidden = !dataUrl;
  watermarkLogoPreviewEl.src = dataUrl ?? "";
  watermarkLogoNameEl.textContent = dataUrl ? name : "No logo chosen";
  watermarkRemoveLogoBtn.hidden = !dataUrl;
  updateWatermarkAddEnabled();
}

async function openWatermarkPanel(): Promise<void> {
  watermarkTextEl.value = "";
  watermarkOpacityEl.value = "60";
  watermarkLogoFileEl.value = "";
  // Preload whatever logo was saved from a previous session, so repeated
  // branded exports don't need re-picking the file every time — see
  // chrome/watermark-logo-store.ts.
  const saved = await getWatermarkLogoDataUrl();
  showWatermarkLogoPreview(saved, saved ? "Saved logo" : "");
  watermarkPanel.hidden = false;
  watermarkTextEl.focus();
}

function closeWatermarkPanel(): void {
  watermarkPanel.hidden = true;
}

watermarkTextEl.addEventListener("input", updateWatermarkAddEnabled);

watermarkChooseLogoBtn.addEventListener("click", () => watermarkLogoFileEl.click());

watermarkLogoFileEl.addEventListener("change", async () => {
  const file = watermarkLogoFileEl.files?.[0];
  if (!file) return;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("failed to read logo file"));
    reader.readAsDataURL(file);
  });
  await setWatermarkLogoDataUrl(dataUrl);
  showWatermarkLogoPreview(dataUrl, file.name);
});

watermarkRemoveLogoBtn.addEventListener("click", async () => {
  await clearWatermarkLogoDataUrl();
  watermarkLogoFileEl.value = "";
  showWatermarkLogoPreview(null, "");
});

watermarkCancelBtn.addEventListener("click", closeWatermarkPanel);

/** Bottom-right corner, sized proportionally to the capture so it reads
 * consistently regardless of resolution. */
function defaultWatermarkRect(): Rect {
  const width = Math.max(80, Math.round(canvas.width * 0.22));
  const height = Math.max(40, Math.round(width * 0.5));
  const margin = Math.round(canvas.width * 0.02);
  return {
    x: clampNum(canvas.width - width - margin, 0, Math.max(0, canvas.width - width)),
    y: clampNum(canvas.height - height - margin, 0, Math.max(0, canvas.height - height)),
    width,
    height,
  };
}

watermarkAddBtn.addEventListener("click", async () => {
  const text = watermarkTextEl.value.trim();
  const opacity = Number(watermarkOpacityEl.value) / 100;
  const logoBitmap = watermarkLogoDataUrl ? await createImageBitmap(await (await fetch(watermarkLogoDataUrl)).blob()) : null;
  if (!text && !logoBitmap) return; // belt-and-suspenders; the button is disabled for this case already
  if (pendingShape) commitPendingShape(); // bake whatever was already pending first, same as switching tools
  pendingShape = { kind: "watermark", rect: defaultWatermarkRect(), text, logoBitmap, opacity };
  closeWatermarkPanel();
  selectTool("select");
  renderPendingShape();
});

// --- toolbar / load / save --------------------------------------------------

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset["tool"] === "watermark") {
      void openWatermarkPanel();
      return;
    }
    selectTool(btn.dataset["tool"] as Tool);
  });
});

document.getElementById("undo")!.addEventListener("click", undo);

document.getElementById("closeEditor")!.addEventListener("click", async () => {
  // window.close() alone can silently no-op for a tab this document didn't
  // itself open via window.open() — which is exactly how the editor tab
  // gets created (chrome.tabs.create() from the background service
  // worker) — so close it explicitly by tab id, falling back to
  // window.close() if getCurrent() ever comes back empty (e.g. this page
  // opened some other way).
  const tab = await ext.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await ext.tabs.remove(tab.id);
  } else {
    window.close();
  }
});

cropApplyBtn.addEventListener("click", commitPendingCrop);
cropCancelBtn.addEventListener("click", cancelPendingCrop);

window.addEventListener("keydown", (e) => {
  if (pendingCrop) {
    if (e.key === "Enter") commitPendingCrop();
    else if (e.key === "Escape") cancelPendingCrop();
    return;
  }
  if (pendingShape) {
    if (e.key === "Enter") commitPendingShape();
    else if (e.key === "Escape") cancelPendingShape();
    else if (e.key === "Delete" || e.key === "Backspace") cancelPendingShape();
  }
});

function canvasPngBytes(): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("canvas.toBlob returned null"));
        return;
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject);
    }, "image/png");
  });
}

document.getElementById("downloadPng")!.addEventListener("click", async () => {
  if (pendingShape) commitPendingShape(); // so the download matches what's on screen
  try {
    const result = await saveOutput(await canvasPngBytes(), "-annotated", "png", "image/png");
    setStatus(result.savedToCustomFolder ? `Saved to your chosen folder — ${canvas.width}×${canvas.height}` : `${canvas.width}×${canvas.height}`);
  } catch (err) {
    setStatus(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
  }
});

document.getElementById("downloadPdf")!.addEventListener("click", async () => {
  if (pendingShape) commitPendingShape(); // so the download matches what's on screen
  setStatus("Building PDF…");
  try {
    const pngBytes = await canvasPngBytes();
    const shotCore = await loadShotCore();
    const pdfBytes = shotCore.pngToPdf(pngBytes, currentDpr) as Uint8Array;
    const result = await saveOutput(pdfBytes, "-annotated", "pdf", "application/pdf");
    setStatus(result.savedToCustomFolder ? `Saved to your chosen folder — ${canvas.width}×${canvas.height}` : `${canvas.width}×${canvas.height}`);
  } catch (err) {
    setStatus(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
});

// Static import (see the top-of-file import) so Vite bundles the
// wasm-bindgen glue and rewrites its internal `new URL(..., import.meta.url)`
// into a proper hashed asset — same reasoning as
// background/wasm-loader.ts, though a normal extension page (unlike a
// service worker) could also use a dynamic import() here if ever needed.
let shotCorePromise: Promise<typeof ShotCore> | null = null;
function loadShotCore(): Promise<typeof ShotCore> {
  if (!shotCorePromise) shotCorePromise = init().then(() => ShotCore);
  return shotCorePromise;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Fetches the pending capture from the background context over a
// runtime.connect Port instead of reading blob-store's IndexedDB directly
// from this document — see EDITOR_IMAGE_PORT_NAME's comment in
// blob-store.ts for why (Firefox private-browsing storage partitioning).
// Resolves null if there was no pending image (background sends a bare
// `{done: true}` with no chunks first).
function requestEditorImageBytes(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const port = ext.runtime.connect({ name: EDITOR_IMAGE_PORT_NAME });
    const chunks: Uint8Array[] = [];
    port.onMessage.addListener((msg: { chunk?: string; done?: boolean }) => {
      if (msg.chunk) {
        chunks.push(base64ToBytes(msg.chunk));
        return;
      }
      if (!msg.done) return;
      port.disconnect();
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      const total = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(merged);
    });
  });
}

// No resolution cap here: the editor always loads a capture at its true
// native resolution. commitPendingShape() bakes every shape directly into
// this canvas's own pixels, so the browser has to rasterize/composite
// however large the canvas is on every single commit — measured as a real
// multi-hundred-ms main-thread stall on unusually large full-page
// captures (many megapixels at a high DPR), regardless of GPU vs CPU
// canvas rendering mode, since the canvas itself is just too big to push
// around quickly either way. A resolution cap traded that lag away for
// reduced output quality on those captures; kept off deliberately, so a
// large enough capture is genuinely slow to edit again. Fixing that
// without giving up resolution means re-rendering annotations onto the
// original at export time instead of baking them into a capped canvas —
// which needs every shape kept as data, not pixels — a much bigger change
// than this file makes today.
async function loadImage(): Promise<void> {
  const bytes = await requestEditorImageBytes();
  const stored = await ext.storage.session.get("editorDpr");
  const dpr: number | undefined = stored["editorDpr"];
  if (!bytes) {
    setStatus("No captured image found — capture a page first, then click Annotate.");
    return;
  }
  currentDpr = dpr ?? 1;
  const blob = new Blob([bytes as BlobPart], { type: "image/png" });
  const bitmap = await createImageBitmap(blob);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  syncPreviewCanvas();
  setStatus(`${bitmap.width}×${bitmap.height}`);
  selectTool("crop");
}

// The canvas's rendered size (and so previewCanvas's, which tracks it)
// depends on the window's available width via max-width:100% — resync on
// resize so preview drawings stay aligned with the real canvas.
window.addEventListener("resize", syncPreviewCanvas);

loadImage();
