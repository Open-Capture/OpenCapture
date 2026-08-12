// Loads the wasm-bindgen glue via a *static* import, statically bundled by
// Vite into background.js (with shot_core_bg.wasm emitted as a hashed
// asset Vite rewrites `init()`'s internal `new URL(..., import.meta.url)`
// call to fetch).
//
// This has to be a static import, not the more obviously-composable
// dynamic `import(url)`: MV3 service workers throw
// "import() is disallowed on ServiceWorkerGlobalScope by the HTML
// specification" for *any* dynamic import call, regardless of the
// `"type": "module"` manifest declaration — that only enables *static*
// import/export syntax. See https://github.com/w3c/ServiceWorker/issues/1356.
import init, * as ShotCore from "../wasm-gen/shot_core.js";

let modulePromise: Promise<typeof ShotCore> | null = null;

export function loadShotCore(): Promise<typeof ShotCore> {
  if (!modulePromise) {
    modulePromise = init().then(() => ShotCore);
  }
  return modulePromise;
}
