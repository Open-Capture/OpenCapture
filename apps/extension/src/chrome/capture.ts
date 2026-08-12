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
