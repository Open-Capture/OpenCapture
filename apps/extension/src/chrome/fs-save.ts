// Writes directly into a user-chosen directory (via a stored
// FileSystemDirectoryHandle) instead of going through chrome.downloads —
// this is what actually makes an arbitrary, persisted, outside-Downloads
// folder possible (chrome.downloads.download can only ever write relative
// to the browser's Downloads directory; see save-prefs.ts). Every caller
// must be prepared for this to fail and fall back to that relative-
// subfolder path instead — see the call sites for why.

/** Checks (without prompting) whether we still have write access to a
 * previously-granted directory. Permission grants can be revoked or can
 * expire between sessions, and re-requesting needs a user gesture we don't
 * have at capture time — so a `false` here means "fall back", not "error". */
export async function hasWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  // Only useful right after a real user gesture (e.g. the settings page's
  // own "Choose Folder" click) — harmless to attempt elsewhere, since
  // without a gesture the browser just re-returns the current (non-granted)
  // state rather than throwing.
  return (await handle.requestPermission(opts)) === "granted";
}

export async function saveToDirectory(handle: FileSystemDirectoryHandle, filename: string, bytes: Uint8Array): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes as BufferSource);
  await writable.close();
}
