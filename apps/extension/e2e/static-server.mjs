// Minimal static file server for ../../test-pages/, used by Playwright's
// `webServer` config (see playwright.config.ts). Deliberately dependency-free
// (Node's http module only) — this is test infrastructure, not shipped code.
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const testPagesDir = join(here, "..", "..", "..", "test-pages");
const port = Number(process.env.PORT || 8934);

const mimeTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(testPagesDir, safePath);

  if (!filePath.startsWith(testPagesDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }

  res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`test-pages server listening on http://localhost:${port}`);
});
