// Persists the user's chosen save directory (a FileSystemDirectoryHandle,
// from the File System Access API) across sessions. chrome.storage can't
// hold it — its values must be JSON-serializable, and a handle isn't — but
// IndexedDB can, via the same structured-clone algorithm the File System
// Access API spec explicitly documents this pattern against.

const DB_NAME = "opencapture-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "saveDirectory";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("failed to open IndexedDB"));
  });
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("failed to read directory handle"));
    });
  } finally {
    db.close();
  }
}

export async function setSavedDirectoryHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (handle) store.put(handle, HANDLE_KEY);
      else store.delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("failed to store directory handle"));
    });
  } finally {
    db.close();
  }
}
