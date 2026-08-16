/**
 * Bundle the elements into self-contained ES modules.
 *
 * The package's normal output keeps bare specifiers (`lit`, `@openapps/sdk`)
 * so bundlers can dedupe and tree-shake. A browser cannot resolve those, so
 * "drop in a script tag" — the thing these elements are for — needs a build
 * with the dependencies inlined.
 *
 * **One entry point per element, plus `openapps-ui` for all of them.** The
 * combined entry used to be the only option, so a page that wanted a balance
 * badge downloaded the sign-in flow, the buy flow, the account panel and the
 * referral panel with it. Splitting is what the old budget comment said a
 * sixth element had to be paid for with, and `<openapps-history>` is that
 * sixth element:
 *
 *     <script type="module" src="…/openapps-credits.js"></script>   ← just this
 *     <script type="module" src="…/openapps-ui.js"></script>        ← all of them
 *
 * Two esbuild passes rather than one, deliberately. Putting all seven entry
 * points in a single pass makes esbuild factor shared code into chunks that
 * every entry has to reach, which costs the combined bundle ~6 KB for a
 * sharing nobody uses: no page loads `openapps-ui.js` *and* a single-element
 * file. Built separately, each shape is optimal for the page that asks for
 * it, at the cost of chunks not being shared between the two — which is only
 * a cost if a page mixes them, and none does.
 */
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, rmSync } from "node:fs";
import { basename } from "node:path";

const outdir = "dist/bundle";
rmSync(outdir, { recursive: true, force: true });

/** Registers every element. The no-bundler convenience path. */
const COMBINED = { "openapps-ui": "src/index.ts" };

/** One element each, for a page that wants one element. */
const PER_ELEMENT = {
  "openapps-login": "src/openapps-login.ts",
  "openapps-credits": "src/openapps-credits.ts",
  "openapps-history": "src/openapps-history.ts",
  "openapps-buy": "src/openapps-buy.ts",
  "openapps-account": "src/openapps-account.ts",
  "openapps-referral": "src/openapps-referral.ts",
};

const common = {
  outdir,
  bundle: true,
  // Keeps the Nostr secret-key fallback out of every page: it pulls in a
  // crypto library several times the size of everything else here, behind a
  // dynamic import, so it is fetched only when a user chooses to paste a key.
  splitting: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  sourcemap: true,
  metafile: true,
  // Lit checks this to drop its dev-mode warnings and validation.
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
};

const combined = await build({ ...common, entryPoints: COMBINED });
const perElement = await build({ ...common, entryPoints: PER_ELEMENT });

const outputs = { ...combined.metafile.outputs, ...perElement.metafile.outputs };
const gzipped = new Map();
for (const file of Object.keys(outputs)) {
  if (!file.endsWith(".js")) continue;
  gzipped.set(file, gzipSync(readFileSync(file), { level: 9 }).byteLength);
}

/**
 * What a browser actually downloads to use one entry: the entry plus every
 * chunk it reaches through *static* imports.
 *
 * The previous version of this script summed only files whose name began
 * with the entry's, and filed everything else under "loaded on demand" —
 * which counted statically-imported chunks as free. Read from esbuild's
 * metafile instead, which is the only thing that can tell a static import
 * from a dynamic one. That correction is most of why the budget below is a
 * larger number than the one it replaces; the bundle did not jump.
 */
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const imported of outputs[file]?.imports ?? []) {
    if (imported.kind !== "import-statement") continue;
    if (!outputs[imported.path]) continue;
    closure(imported.path, seen);
  }
  return seen;
}

function loadSize(entryName) {
  let total = 0;
  for (const part of closure(`${outdir}/${entryName}.js`)) {
    total += gzipped.get(part) ?? 0;
  }
  return total;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const sizes = new Map();

console.log("what a page downloads, gzipped:");
for (const name of [...Object.keys(COMBINED), ...Object.keys(PER_ELEMENT)]) {
  const size = loadSize(name);
  sizes.set(name, size);
  console.log(`  ${name.padEnd(20)} ${kb(size).padStart(9)}`);
}
const onDemand = [...gzipped.entries()]
  .filter(([file]) => /nip46|secp256k1/.test(basename(file)))
  .reduce((sum, [, size]) => sum + size, 0);
if (onDemand) console.log(`  (plus ${kb(onDemand)} fetched only if a key is pasted)`);

/**
 * Two budgets, for two different costs.
 *
 * `openapps-credits` is the cheapest useful element, so its number is really
 * a floor on the shared runtime — lit plus the SDK plus the base styles. It
 * should barely move as elements are added, and it moving means something
 * common grew.
 *
 * `openapps-ui` grows with every element, because it is every element. Its
 * budget exists so that growth is a decision rather than a drift. Adding an
 * element is now paid for by its own entry point, so the honest response to
 * hitting this ceiling is to check whether the newcomer is dragging in
 * something that should be a dynamic import — not to move the number.
 */
const BUDGETS = {
  "openapps-credits": 15 * 1024,
  "openapps-ui": 27 * 1024,
};

let failed = false;
for (const [name, budget] of Object.entries(BUDGETS)) {
  const size = sizes.get(name) ?? 0;
  if (size > budget) {
    console.error(`FAIL: ${name} loads ${size} B gzipped, over the ${budget} B budget`);
    failed = true;
  }
}
if (failed) process.exit(1);
