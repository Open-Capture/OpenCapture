// Session storage for the OpenApps account/credits integration.
//
// There is no `localStorage` in a service worker, and the worker is killed
// and restarted at Chrome's discretion, so the session cannot live in a
// module variable either. `chrome.storage` survives both, but it is async,
// which is why the SDK's `asyncBackedStore` exists: it keeps a synchronous
// in-memory copy for the client and writes through.
//
// `session` rather than `local`: it is memory-backed and cleared when the
// browser closes, so refresh tokens never touch disk — consistent with this
// extension's local-only posture elsewhere (no capture data ever leaves the
// device; the OpenApps session is the one thing that does talk to a server,
// and it is opt-in and disk-free). The cost is signing in again after a
// browser restart.
import { OpenApps, asyncBackedStore } from "@openapps/sdk";
import type { Session } from "@openapps/sdk";
import { ext } from "../platform/webext";

export const OPENAPPS_BASE_URL = "https://accounts.openapps.network";
// openapps-gateway holds the app key for paid features (see
// editor.ts's Supporter watermark unlock) — never reachable with just
// the user token this extension holds, only through this service.
export const OPENAPPS_GATEWAY_URL = "https://gateway.openapps.network";
const KEY = "openapps.session";

export const store = asyncBackedStore(
  {
    async load() {
      const result = await ext.storage.session.get(KEY);
      return (result[KEY] as Session | undefined) ?? null;
    },
    async save(session) {
      if (session) await ext.storage.session.set({ [KEY]: session });
      else await ext.storage.session.remove(KEY);
    },
  },
  (error) => console.warn("[openapps] session storage failed", error),
);

export const client = new OpenApps({
  baseUrl: OPENAPPS_BASE_URL,
  store,
});

/** Await before the first authenticated call in any extension context. */
export const ready = store.ready;
