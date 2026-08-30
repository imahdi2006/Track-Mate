/**
 * Compile docs/ARCHITECTURE_AND_IMPLEMENTATION.md into a print-ready PDF.
 *
 *   npm run docs:pdf
 *
 * Output: docs/BookMate-architecture.pdf
 */
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "docs", "ARCHITECTURE_AND_IMPLEMENTATION.md");
const OUT = join(ROOT, "docs", "BookMate-architecture.pdf");

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function buildToc(html) {
  const headings = [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)];
  if (!headings.length) return "";
  const items = headings
    .map(([, level, id, inner]) => {
      const title = inner.replace(/<[^>]+>/g, "").trim();
      const pad = level === "3" ? "padding-left:1.25rem;" : "";
      return `<li style="${pad}"><a href="#${id}">${title}</a></li>`;
    })
    .join("");
  return `<nav class="toc"><h2>Contents</h2><ol>${items}</ol></nav>`;
}

async function main() {
  const md = readFileSync(SRC, "utf8");

  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  let body = String(marked.parse(md));
  body = body.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const id = slugify(inner);
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  body = body.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) =>
      `<pre class="mermaid">${code.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")}</pre>`,
  );

  const toc = buildToc(body);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>BookMate — Architecture & Implementation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css" />
  <style>
    :root {
      --navy: #0F172A;
      --indigo: #6366F1;
      --amber: #F59E0B;
      --cream: #FBF7F1;
      --ink: #1E293B;
      --muted: #64748B;
    }
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--cream);
      color: var(--ink);
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      font-size: 11.5pt;
      line-height: 1.55;
    }
    .cover {
      page-break-after: always;
      padding: 48px 8px 24px;
      border-bottom: 6px solid var(--indigo);
    }
    .cover .eyebrow {
      letter-spacing: 0.22em;
      text-transform: uppercase;
      font-size: 10pt;
      color: var(--indigo);
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .cover h1 {
      font-size: 34pt;
      line-height: 1.1;
      margin: 12px 0 8px;
      color: var(--navy);
    }
    .cover p { color: var(--muted); max-width: 42em; }
    .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; margin-right: 6px; vertical-align: middle; }
    h1, h2, h3, h4 {
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: var(--navy);
      page-break-after: avoid;
    }
    h2 { font-size: 16pt; margin-top: 1.8em; border-bottom: 2px solid var(--indigo); padding-bottom: 6px; }
    h3 { font-size: 13pt; margin-top: 1.3em; }
    a { color: var(--indigo); }
    p, li { orphans: 3; widows: 3; }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 10pt;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    th, td { border: 1px solid #D6D3CD; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #EEF2FF; color: var(--navy); }
    tr:nth-child(even) td { background: #F8F5EF; }
    code {
      font-family: "Cascadia Code", "Fira Code", ui-monospace, Consolas, monospace;
      font-size: 0.84em;
      background: #EEF2FF;
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }
    pre {
      background: #0F172A;
      color: #E2E8F0;
      padding: 12px 14px;
      border-radius: 10px;
      overflow: hidden;
      font-size: 8.5pt;
      line-height: 1.45;
      page-break-inside: avoid;
    }
    pre code { background: transparent; color: inherit; padding: 0; }
    pre.mermaid { background: white; color: var(--navy); border: 1px solid #E2E8F0; }
    blockquote {
      margin: 1em 0;
      padding: 8px 14px;
      border-left: 4px solid var(--amber);
      background: #FFFBEB;
      color: #78350F;
    }
    hr { border: 0; border-top: 1px solid #E2E8F0; margin: 2em 0; }
    .toc { page-break-after: always; }
    .toc ol { padding-left: 1.2em; }
    .toc a { color: var(--navy); text-decoration: none; }
    .toc li { margin: 0.25em 0; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10.5pt; }
    img, svg { max-width: 100%; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">BookMate · Engineering Manual</div>
    <h1>Architecture &amp; Implementation</h1>
    <p>Deep-dive companion to the BookMate progressive web app: data flow, Postgres, optimistic realtime, Web Push / VAPID, iOS constraints, service worker lifecycle, and PWA install/update UX.</p>
    <p>
      <span class="swatch" style="background:#0F172A"></span> Navy
      <span class="swatch" style="background:#6366F1"></span> Indigo
      <span class="swatch" style="background:#F59E0B"></span> Amber
      <span class="swatch" style="background:#F5F0E8;border:1px solid #D6D3CD"></span> Cream
    </p>
  </section>
  ${toc}
  <main>${body}</main>
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <script>
    try { document.querySelectorAll("pre code").forEach((el) => hljs.highlightElement(el)); } catch (e) {}
  </script>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    await mermaid.run({ querySelector: ".mermaid" });
    document.documentElement.dataset.mermaid = "ready";
  </script>
</body>
</html>`;

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    console.error("puppeteer is not installed. Run npm install and retry.");
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].find((p) => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0", timeout: 120_000 });
  await page
    .waitForFunction(
      () =>
        document.documentElement.dataset.mermaid === "ready" ||
        document.querySelectorAll(".mermaid svg").length > 0,
      { timeout: 20_000 },
    )
    .catch(() => {
      console.warn("Mermaid did not finish in time; writing PDF with source blocks.");
    });

  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px;color:#64748B;width:100%;padding:0 16mm;font-family:system-ui;">BookMate Architecture</div>`,
    footerTemplate: `<div style="font-size:8px;color:#64748B;width:100%;padding:0 16mm;font-family:system-ui;display:flex;justify-content:space-between;"><span>Confidential engineering notes</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
  });
  await browser.close();
  console.log("Wrote", pathToFileURL(OUT).href);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
