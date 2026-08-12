// Called directly from the popup's own click handler — not routed through
// the service worker or an offscreen document. Both were tried first and
// both fail unconditionally in real Chrome, not just this project's
// headless test harness: `navigator.clipboard.write()` requires the
// calling *document* to have real focus, and offscreen documents are
// invisible and never become the focused document; `document.execCommand`
// likewise needs the calling document's own transient user activation,
// which never reaches an offscreen document either (activation doesn't
// transfer across documents via messaging). The popup, by contrast, is
// exactly the document that received the real click — it's the one place
// in this extension where both requirements are actually satisfiable.

export async function copyPngBytesToClipboard(bytes: Uint8Array): Promise<void> {
  const blob = new Blob([bytes as BlobPart], { type: "image/png" });
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    await copyImageViaExecCommand(blob);
  }
}

// The pre-async-Clipboard-API workaround: select an <img> inside a hidden
// contenteditable and run the legacy synchronous copy command, which
// copies the actual selected image data to the system clipboard.
async function copyImageViaExecCommand(blob: Blob): Promise<void> {
  const container = document.createElement("div");
  container.contentEditable = "true";
  container.style.cssText = "position:fixed;top:-9999px;left:-9999px;";
  document.body.appendChild(container);

  const url = URL.createObjectURL(blob);
  try {
    const img = document.createElement("img");
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("failed to load image for clipboard copy"));
    });
    container.appendChild(img);

    const range = document.createRange();
    range.selectNode(img);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const ok = document.execCommand("copy");
    selection?.removeAllRanges();
    if (!ok) throw new Error("document.execCommand('copy') returned false");
  } finally {
    container.remove();
    URL.revokeObjectURL(url);
  }
}
