import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ASSET_ROOT,
  CAPTURE_ROOT,
  MANIFEST_PATH,
  OUTPUT_ROOT
} from "./config.mjs";
import {
  analyzeChapterCaptures,
  sortChapterCaptures
} from "./capture-order.mjs";

const chapterNumber = Number.parseInt(
  process.env.MHE_CHAPTER || "1",
  10
);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const renderMode = (
  process.env.MHE_RENDER_MODE || "normal"
).toLowerCase();

if (!["normal", "safe", "plain"].includes(renderMode)) {
  throw new Error(
    "MHE_RENDER_MODE must be normal, safe, or plain."
  );
}

const strictReaderSequence =
  /^(?:1|true|yes)$/i.test(
    process.env.MHE_STRICT_READER_SEQUENCE || ""
  );

const pad2 = (value) => String(value).padStart(2, "0");
const chapterLabel = `chapter${pad2(chapterNumber)}`;
const assetRoot = path.join(ASSET_ROOT, chapterLabel);
const inventoryPath = path.join(assetRoot, "inventory.json");
const outputRoot = path.join(OUTPUT_ROOT, chapterLabel);
const htmlPath = path.join(outputRoot, `${chapterLabel}.html`);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16))
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return String(value || "");
  }
}

function resolveUrl(raw, baseHref) {
  const value = String(raw || "").trim();

  if (!value || value.startsWith("#")) return null;
  if (/^(?:data|blob|javascript|mailto|tel):/i.test(value)) return null;

  try {
    const url = new URL(value, baseHref);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function extractBody(html) {
  const match = html.match(
    /<body\b([^>]*)>([\s\S]*?)<\/body>/i
  );

  if (!match) {
    throw new Error(
      "Captured XHTML did not contain a <body> element."
    );
  }

  const attrs = match[1] || "";
  const inner = match[2] || "";
  const classMatch = attrs.match(
    /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i
  );

  return {
    classes: (
      classMatch?.[1] ||
      classMatch?.[2] ||
      ""
    )
      .split(/\s+/)
      .filter(Boolean),
    inner
  };
}

function extractInlineStyles(html) {
  return [
    ...html.matchAll(
      /<style\b[^>]*>([\s\S]*?)<\/style>/gi
    )
  ]
    .map((match) => match[1] || "")
    .filter(Boolean);
}

function removeActiveContent(html) {
  return html
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
      ""
    );
}

function rewriteCssUrls(css, baseHref, localUrlFor) {
  return css.replace(
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi,
    (whole, a, b, c) => {
      const raw = a ?? b ?? c ?? "";

      if (
        !raw ||
        raw.startsWith("#") ||
        /^data:/i.test(raw)
      ) {
        return whole;
      }

      const absolute = resolveUrl(raw, baseHref);
      if (!absolute) return whole;

      const local = localUrlFor(absolute);
      return local
        ? `url("${local}")`
        : 'url("data:,")';
    }
  );
}

function rewriteSrcset(value, baseHref, localUrlFor) {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return trimmed;

      const pieces = trimmed.split(/\s+/);
      const raw = pieces.shift();
      const absolute = resolveUrl(raw, baseHref);
      const local = absolute
        ? localUrlFor(absolute)
        : null;

      return [local || "data:,", ...pieces].join(" ");
    })
    .join(", ");
}

function rewriteHtmlAssets(
  html,
  baseHref,
  localUrlFor,
  mode
) {
  let rewritten = html;

  rewritten = rewritten.replace(
    /\b(src|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (whole, name, doubleValue, singleValue) => {
      const raw = doubleValue ?? singleValue ?? "";
      const absolute = resolveUrl(raw, baseHref);

      if (!absolute) return whole;

      const local = localUrlFor(absolute);

      if (local) {
        return `${name}="${local}"`;
      }

      return `${name}="data:," data-recovery-missing="${escapeHtml(
        absolute
      )}"`;
    }
  );

  rewritten = rewritten.replace(
    /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (whole, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? "";
      return `srcset="${rewriteSrcset(
        value,
        baseHref,
        localUrlFor
      )}"`;
    }
  );

  if (mode === "normal") {
    rewritten = rewritten.replace(
      /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (whole, doubleValue, singleValue) => {
        const value =
          doubleValue ?? singleValue ?? "";
        const css = rewriteCssUrls(
          value,
          baseHref,
          localUrlFor
        ).replaceAll('"', "&quot;");
        return `style="${css}"`;
      }
    );
  } else {
    rewritten = rewritten
      .replace(
        /\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi,
        ""
      )
      .replace(
        /\sclass\s*=\s*(?:"[^"]*"|'[^']*')/gi,
        ""
      );
  }

  return rewritten;
}

function plainTextFromHtml(html) {
  let working = removeActiveContent(html);

  working = working.replace(
    /<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi,
    (_, a, b) => `\n[Image: ${a ?? b ?? ""}]\n`
  );

  working = working
    .replace(
      /<(?:br|hr)\b[^>]*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/(?:p|div|section|article|aside|figure|figcaption|blockquote|li|tr|h[1-6])>/gi,
      "\n"
    )
    .replace(
      /<\/(?:td|th)>/gi,
      "\t"
    )
    .replace(
      /<[^>]+>/g,
      " "
    );

  const decoded = decodeHtmlEntities(working)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decoded;
}

function plainTextToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const cleaned = block
        .split("\n")
        .map((line) => escapeHtml(line.trim()))
        .filter(Boolean)
        .join("<br>");
      return cleaned ? `<p>${cleaned}</p>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function captureLabel(entry) {
  if (Number.isInteger(entry.readerNumber)) {
    return `reader_${pad2(entry.readerNumber)}`;
  }

  const after = Number.isInteger(entry.afterReaderNumber)
    ? pad2(entry.afterReaderNumber)
    : "unknown";

  const ordinal = Number.isInteger(entry.auxOrderWithinGap)
    ? pad2(entry.auxOrderWithinGap)
    : "01";

  return `aux_after_${after}_${ordinal}`;
}

const safeCss = `
body {
  max-width: 8.2in;
  margin: 0 auto;
  padding: 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  line-height: 1.48;
  color: #111;
  background: white;
}
h1, h2, h3, h4, h5, h6 {
  page-break-after: avoid;
  break-after: avoid;
}
p, li {
  orphans: 3;
  widows: 3;
}
img, svg, video {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.15in auto;
}
figure {
  margin: 0.2in 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.15in 0;
}
td, th {
  border: 1px solid #999;
  padding: 0.06in;
  vertical-align: top;
}
blockquote {
  margin: 0.15in 0.25in;
}
[data-recovery-missing] {
  outline: 1px dashed #999;
}
`;

const plainCss = `
body {
  max-width: 7.4in;
  margin: 0 auto;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12pt;
  line-height: 1.55;
  color: #111;
  background: white;
}
p {
  margin: 0 0 0.14in;
}
.recovery-fragment {
  margin-bottom: 0.12in;
}
`;

try {
  const manifest = JSON.parse(
    await fs.readFile(MANIFEST_PATH, "utf8")
  );

  let inventory = { assets: [] };

  try {
    inventory = JSON.parse(
      await fs.readFile(inventoryPath, "utf8")
    );
  } catch (error) {
    if (renderMode === "normal" && error.code === "ENOENT") {
      throw error;
    }
  }

  const analysis = analyzeChapterCaptures(
    manifest.captures || [],
    chapterNumber
  );

  const captures = sortChapterCaptures(
    analysis.captures
  );

  if (!captures.length) {
    throw new Error(
      `No captured XHTML fragments found for Chapter ${chapterNumber}.`
    );
  }

  if (analysis.knownLinkedMissing.length) {
    throw new Error(
      `Chapter ${chapterNumber} explicitly references uncaptured reader fragments: ` +
      `${analysis.knownLinkedMissing.join(", ")}. Re-record this chapter before assembling.`
    );
  }

  if (analysis.numericGaps.length) {
    const message =
      `Chapter ${chapterNumber} has non-contiguous reader file IDs: ` +
      `${analysis.numericGaps.join(", ")}.`;

    if (strictReaderSequence) {
      throw new Error(
        `${message} MHE_STRICT_READER_SEQUENCE is enabled.`
      );
    }

    console.log(`\n[warning] ${message}`);
    console.log(
      "Reader IDs are file identifiers and are not assumed to be continuous."
    );
  }

  const localMap = new Map();

  for (const entry of inventory.assets || []) {
    const abs = path.join(assetRoot, entry.localFile);

    if (await fileExists(abs)) {
      localMap.set(
        normalizeUrl(entry.url),
        pathToFileURL(abs).href
      );
    }
  }

  const localUrlFor = (url) =>
    localMap.get(normalizeUrl(url)) || null;

  const publisherCss = [];

  if (renderMode === "normal") {
    for (const entry of inventory.assets || []) {
      if (!(entry.kinds || []).includes("stylesheet")) {
        continue;
      }

      const abs = path.join(assetRoot, entry.localFile);
      if (!(await fileExists(abs))) continue;

      const css = await fs.readFile(abs, "utf8");
      publisherCss.push(
        `/* ${entry.url} */\n${rewriteCssUrls(
          css,
          entry.url,
          localUrlFor
        )}`
      );
    }
  }

  const bodyClasses = new Set();
  const inlineStyles = [];
  const fragments = [];

  for (const entry of captures) {
    const capturePath = path.join(
      CAPTURE_ROOT,
      entry.savedAs
    );

    const xhtml = await fs.readFile(
      capturePath,
      "utf8"
    );

    if (renderMode === "plain") {
      const text = plainTextFromHtml(xhtml);

      fragments.push(
        `<!-- ${chapterLabel} ${captureLabel(entry)} -->\n` +
        `<section class="recovery-fragment">\n` +
        `${plainTextToHtml(text)}\n` +
        `</section>`
      );

      continue;
    }

    const body = extractBody(xhtml);

    if (renderMode === "normal") {
      for (const className of body.classes) {
        bodyClasses.add(className);
      }

      for (const css of extractInlineStyles(xhtml)) {
        inlineStyles.push(
          rewriteCssUrls(
            css,
            entry.baseHref,
            localUrlFor
          )
        );
      }
    }

    const cleaned = removeActiveContent(body.inner);
    const rewritten = rewriteHtmlAssets(
      cleaned,
      entry.baseHref,
      localUrlFor,
      renderMode
    );

    fragments.push(
      `<!-- ${chapterLabel} ${captureLabel(entry)} -->\n${rewritten}`
    );
  }

  const title =
    captures.find((entry) => entry.title)?.title ||
    `Chapter ${chapterNumber}`;

  const reconstructionCss = `
html, body {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
img, svg, video, canvas {
  max-width: 100% !important;
}
[hidden] {
  display: none !important;
}
@page {
  size: Letter;
  margin: 0.45in;
}
`;

  const modeCss =
    renderMode === "normal"
      ? ""
      : renderMode === "safe"
        ? safeCss
        : plainCss;

  const output = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="recovery-render-mode" content="${renderMode}">
<title>${escapeHtml(title)}</title>
<style>
${publisherCss.join("\n\n")}
${renderMode === "normal" ? inlineStyles.join("\n\n") : ""}
${reconstructionCss}
${modeCss}
</style>
</head>
<body class="${renderMode === "normal" ? [...bodyClasses].join(" ") : ""}">
${fragments.join("\n\n")}
</body>
</html>
`;

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(htmlPath, output, "utf8");

  console.log("\nChapter reconstruction assembled\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Render mode: ${renderMode}`);
  console.log(`Reader fragments: ${analysis.readerNumbers.length}`);
  console.log(`Auxiliary fragments: ${analysis.auxiliaryCount}`);
  console.log(`Total XHTML fragments: ${captures.length}`);
  console.log(`Cached resources available: ${localMap.size}`);
  console.log(`Saved: ${htmlPath}\n`);
} catch (error) {
  console.error(`\nASSEMBLY FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
