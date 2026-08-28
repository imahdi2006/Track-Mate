/**
 * Rasterizes PageMate icons to PNG without native addons.
 * Two overlapping ellipses (indigo + amber) on navy, matching the vector logo.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");

const NAVY = [15, 23, 42, 255];
const INDIGO = [99, 102, 241, 255];
const AMBER = [245, 158, 11, 255];
const CREAM = [245, 240, 232, 255];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcSrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcSrc));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, pixels /* RGBA */) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

function paintIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const pad = maskable ? size * 0.18 : size * 0.08;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const max = size / 2 - 1;
      const inRound = dx * dx + dy * dy <= max * max || maskable;
      const bg = inRound ? NAVY : [0, 0, 0, 0];
      pixels[i] = bg[0];
      pixels[i + 1] = bg[1];
      pixels[i + 2] = bg[2];
      pixels[i + 3] = bg[3];
    }
  }

  const left = {
    cx: cx - inner * 0.12,
    cy: cy + inner * 0.04,
    rx: inner * 0.32,
    ry: inner * 0.28,
  };
  const right = {
    cx: cx + inner * 0.12,
    cy: cy - inner * 0.04,
    rx: inner * 0.32,
    ry: inner * 0.28,
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const L = inEllipse(x, y, left.cx, left.cy, left.rx, left.ry);
      const R = inEllipse(x, y, right.cx, right.cy, right.rx, right.ry);
      if (L && R) {
        const c = mix(INDIGO, AMBER, 0.5);
        pixels[i] = c[0];
        pixels[i + 1] = c[1];
        pixels[i + 2] = c[2];
        pixels[i + 3] = 255;
      } else if (L) {
        pixels[i] = INDIGO[0];
        pixels[i + 1] = INDIGO[1];
        pixels[i + 2] = INDIGO[2];
        pixels[i + 3] = 255;
      } else if (R) {
        pixels[i] = AMBER[0];
        pixels[i + 1] = AMBER[1];
        pixels[i + 2] = AMBER[2];
        pixels[i + 3] = 255;
      }
    }
  }

  const r = Math.max(2, Math.round(size * 0.035));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) {
        const i = (y * size + x) * 4;
        pixels[i] = CREAM[0];
        pixels[i + 1] = CREAM[1];
        pixels[i + 2] = CREAM[2];
        pixels[i + 3] = 255;
      }
    }
  }

  return encodePng(size, size, pixels);
}

function paintBadge(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const on = (x - cx) ** 2 + (y - cy) ** 2 <= (size / 2 - 1) ** 2;
      const c = on ? INDIGO : [0, 0, 0, 0];
      pixels[i] = c[0];
      pixels[i + 1] = c[1];
      pixels[i + 2] = c[2];
      pixels[i + 3] = c[3];
    }
  }
  return encodePng(size, size, pixels);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "icon-192.png"), paintIcon(192));
writeFileSync(join(OUT, "icon-512.png"), paintIcon(512));
writeFileSync(join(OUT, "maskable-512.png"), paintIcon(512, { maskable: true }));
writeFileSync(join(OUT, "apple-touch-icon.png"), paintIcon(180));
writeFileSync(join(OUT, "badge-72.png"), paintBadge(72));

const hash = createHash("sha1").update(paintIcon(32)).digest("hex").slice(0, 8);
console.log(`PageMate icons written to public/icons (${hash})`);
