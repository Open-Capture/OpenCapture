// Drives the actual native folder picker and persists the result. Callers
// must invoke this directly from a real user gesture (a click handler) —
// showDirectoryPicker() requires transient user activation.

import { setSavedDirectoryHandle } from "./dir-handle-store";
import { hasWritePermission } from "./fs-save";

export type PickDirectoryResult =
  | { ok: true; name: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

export async function pickDirectory(): Promise<PickDirectoryResult> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    if (!(await hasWritePermission(handle))) {
      return { ok: false, cancelled: false, error: "Permission to write to that folder was denied." };
    }
    await setSavedDirectoryHandle(handle);
    return { ok: true, name: handle.name };
  } catch (err) {
    // The picker rejects with an AbortError if the user closes the dialog
    // without choosing anything (or — in this project's headless e2e
    // environment, which has no real OS dialog to show at all — always).
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, error: err instanceof Error ? err.message : String(err) };
  }
}
