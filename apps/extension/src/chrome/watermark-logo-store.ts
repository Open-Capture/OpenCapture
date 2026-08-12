// Local-only persistence for the watermark tool's chosen logo image — pure
// convenience so someone doing repeated branded exports doesn't have to
// re-pick the same file every time. Never leaves the device.
//
// Stored as a data URL string in chrome.storage.local, not IndexedDB like
// blob-store.ts: that module exists specifically to dodge chrome.storage's
// small quotas for a *transient* per-capture handoff, but a logo is small
// (a few hundred KB at most for a raster mark) and needs to persist across
// sessions rather than being deleted after one read — chrome.storage.local
// already does that for free. A base64 string round-trips through it more
// predictably than a raw Blob/Uint8Array — same reasoning as
// chrome/capture.ts's dataUrlToBytes elsewhere in this codebase.
import { ext } from "../platform/webext";

const KEY = "watermarkLogoDataUrl";

export async function getWatermarkLogoDataUrl(): Promise<string | null> {
  const result = await ext.storage.local.get(KEY);
  return (result[KEY] as string | undefined) ?? null;
}

export async function setWatermarkLogoDataUrl(dataUrl: string): Promise<void> {
  await ext.storage.local.set({ [KEY]: dataUrl });
}

export async function clearWatermarkLogoDataUrl(): Promise<void> {
  await ext.storage.local.remove(KEY);
}
