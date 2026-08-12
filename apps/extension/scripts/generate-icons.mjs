// Generates the extension's toolbar/store icons as plain pixel math — no
// image libraries, no design tool. A rounded-square accent-blue background
// (#4f7cff, matching the popup/editor UI) with four white L-shaped corner
// brackets: standard "screenshot selection" iconography, unambiguous at
// 16px. Run via `npm run icons`; output is committed (icons don't need to
// regenerate on every build), not produced by the main build pipeline.
import zlib from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [79, 124, 255, 255];
const FG = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function drawIcon(size) {
  const data = new Uint8Array(size * size * 4);
  const cornerRadius = Math.round(size * 0.2);

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const off = (y * size + x) * 4;
    data[off] = color[0];
    data[off + 1] = color[1];
    data[off + 2] = color[2];
    data[off + 3] = color[3];
  }

  function insideRoundedRect(x, y) {
    const cx = x < cornerRadius ? cornerRadius : x >= size - cornerRadius ? size - 1 - cornerRadius : null;
    const cy = y < cornerRadius ? cornerRadius : y >= size - cornerRadius ? size - 1 - cornerRadius : null;
    if (cx === null || cy === null) return true; // not in a corner box at all -> inside
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= cornerRadius * cornerRadius;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, insideRoundedRect(x, y) ? BG : TRANSPARENT);
    }
  }

  // Four L-shaped viewfinder brackets, one per corner.
  const margin = Math.max(1, Math.round(size * 0.17));
  const armLen = Math.max(2, Math.round(size * 0.28));
  const thickness = Math.max(1, Math.round(size * 0.1));

  function hLine(x0, y0, len, t) {
    for (let dy = 0; dy < t; dy++) for (let dx = 0; dx < len; dx++) setPixel(x0 + dx, y0 + dy, FG);
  }
  function vLine(x0, y0, len, t) {
    for (let dy = 0; dy < len; dy++) for (let dx = 0; dx < t; dx++) setPixel(x0 + dx, y0 + dy, FG);
  }

  // top-left
  hLine(margin, margin, armLen, thickness);
  vLine(margin, margin, armLen, thickness);
  // top-right
  hLine(size - margin - armLen, margin, armLen, thickness);
  vLine(size - margin - thickness, margin, armLen, thickness);
  // bottom-left
  hLine(margin, size - margin - thickness, armLen, thickness);
  vLine(margin, size - margin - armLen, armLen, thickness);
  // bottom-right
  hLine(size - margin - armLen, size - margin - thickness, armLen, thickness);
  vLine(size - margin - thickness, size - margin - armLen, armLen, thickness);

  return data;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // one filter-type-0 byte per scanline, prepended to each row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

for (const size of [16, 48, 128]) {
  const rgba = drawIcon(size);
  const png = encodePng(size, size, rgba);
  const path = join(outDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}
