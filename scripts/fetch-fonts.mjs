/**
 * Download Outfit, Fraunces, and Vazirmatn (OFL) into app/fonts
 * so `next build` does not call Google Fonts (blocked on the VPS).
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app/fonts");

const files = [
  ["outfit-latin-wght-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/outfit:vf@5.2.8/latin-wght-normal.woff2"],
  ["fraunces-latin-wght-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/fraunces:vf@5.2.8/latin-wght-normal.woff2"],
  ["vazirmatn-latin-wght-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/vazirmatn:vf@5.2.8/latin-wght-normal.woff2"],
  ["vazirmatn-arabic-wght-normal.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/vazirmatn:vf@5.2.8/arabic-wght-normal.woff2"],
];

await mkdir(dir, { recursive: true });

for (const [name, url] of files) {
  console.log("GET", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`${name} too small (${buf.length})`);
  await writeFile(path.join(dir, name), buf);
  console.log("  saved", name, `${(buf.length / 1024).toFixed(1)} KB`);
}
