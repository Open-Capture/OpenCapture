// A rolling log of past captures, browsable from history.html. A separate
// IndexedDB database from blob-store.ts (not a second object store in the
// same one) — that store is a plain key→bytes map with no place for the
// timestamp/title/url/dimensions fields or the cursor-based eviction a
// history log needs, and there is no existing code depending on blob-store
// staying that simple that adding this would put at risk anyway.
//
// Read-only from any document context is unsafe for the same reason
// blob-store.ts's EDITOR_IMAGE_BLOB_KEY read is: Firefox partitions
// IndexedDB per private-browsing window even within one moz-extension://
// origin, so history.html or the popup opening this database directly
// could silently see an empty history inside a private window. Every
// function here is written assuming it only ever runs in the background
// context — see background/index.ts's history port/message handlers for
// the only sanctioned way another context reaches this.

const DB_NAME = "opencapture-history";
const DB_VERSION = 1;
const STORE_NAME = "captures";

// Name of the runtime.connect() Port history.html uses to stream the full
// log (metadata + image bytes) from the background context — same
// partitioning reason as EDITOR_IMAGE_PORT_NAME in blob-store.ts, and the
// same base64-chunking reasoning for the bytes of each entry.
export const HISTORY_LIST_PORT_NAME = "historyList";

// Oldest entries beyond this are dropped every time a new one is added.
// Full-resolution PNGs, so an unbounded log could grow large fast; capping
// by count (not age) means storage use has a firm ceiling regardless of
// how often someone captures.
const HISTORY_CAP = 50;

export interface HistoryEntryMeta {
  id: number;
  timestamp: number;
  title: string;
  url: string;
  width: number;
  height: number;
  dpr: number;
}

export interface HistoryEntry extends HistoryEntryMeta {
  bytes: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("failed to open history database"));
  });
}

/** Adds a new entry, then evicts the oldest ones past HISTORY_CAP. */
export async function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).add({ ...entry, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("failed to add history entry"));
    });
    await trimToCapacity(db);
  } finally {
    db.close();
  }
}

async function trimToCapacity(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const over = countReq.result - HISTORY_CAP;
      if (over <= 0) return; // tx completes with nothing further queued — fine
      // Auto-incremented keys, so the lowest id is also the oldest entry —
      // a cursor in default (ascending) order visits oldest-first.
      let deleted = 0;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || deleted >= over) return;
        cursor.delete();
        deleted++;
        cursor.continue();
      };
    };
    countReq.onerror = () => reject(countReq.error ?? new Error("failed to count history entries"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("failed to trim history"));
  });
}

/** Newest first — the order a history page wants to render in. */
export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const entries: HistoryEntry[] = [];
      const cursorReq = tx.objectStore(STORE_NAME).openCursor(null, "prev");
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        entries.push(cursor.value as HistoryEntry);
        cursor.continue();
      };
      tx.oncomplete = () => resolve(entries);
      tx.onerror = () => reject(tx.error ?? new Error("failed to list history"));
    });
  } finally {
    db.close();
  }
}

export async function getHistoryEntry(id: number): Promise<HistoryEntry | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as HistoryEntry | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error(`failed to read history entry ${id}`));
    });
  } finally {
    db.close();
  }
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error(`failed to delete history entry ${id}`));
    });
  } finally {
    db.close();
  }
}

export async function clearHistory(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("failed to clear history"));
    });
  } finally {
    db.close();
  }
}
