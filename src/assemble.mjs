import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CAPTURE_ROOT, MANIFEST_PATH, PROJECT_ROOT } from "./config.mjs";
import {
  analyzeChapterCaptures,
  sortChapterCaptures
} from "./capture-order.mjs";

const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "1", 10);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const strictReaderSequence =
  /^(?:1|true|yes)$/i.test(process.env.MHE_STRICT_READER_SEQUENCE || "");

const pad2 = (value) => String(value).padStart(2, "0");
const chapterLabel = `chapter${pad2(chapterNumber)}`;
const assetRoot = path.join(PROJECT_ROOT, "assets", chapterLabel);
const inventoryPath = path.join(assetRoot, "inventory.json");
const outputRoot = path.join(PROJECT_ROOT, "output", chapterLabel);
const htmlPath = path.join(outputRoot, `${chapterLabel}.html`);

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
  const match = html.match(/<body\b([^>]*)>([\s\S]*?)<\/body>/i);
  if (!match) {
    throw new Error("Captured XHTML did not contain a <body> element.");
  }

  const attrs = match[1] || "";
  const inner = match[2] || "";
  const classMatch = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);

  return {
    classes: (classMatch?.[1] || classMatch?.[2] || "")
      .split(/\s+/)
      .filter(Boolean),
    inner
  };
}

function extractInlineStyles(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1] || "")
    .filter(Boolean);
}

function removeScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
}

function rewriteCssUrls(css, baseHref, localUrlFor) {
  return css.replace(
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi,
    (whole, a, b, c) => {
      const raw = a ?? b ?? c ?? "";
      if (!raw || raw.startsWith("#") || /^data:/i.test(raw)) return whole;

      const absolute = resolveUrl(raw, baseHref);
      if (!absolute) return whole;

      const local = localUrlFor(absolute);
      if (local) return `url("${local}")`;

      return 'url("data:,")';
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
      const local = absolute ? localUrlFor(absolute) : null;

      return [local || raw, ...pieces].join(" ");
    })
    .join(", ");
}

function rewriteHtmlAssets(html, baseHref, localUrlFor) {
  let rewritten = html;

  rewritten = rewritten.replace(
    /\b(src|poster|data|href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (whole, name, doubleValue, singleValue) => {
      const raw = doubleValue ?? singleValue ?? "";
      const absolute = resolveUrl(raw, baseHref);
      if (!absolute) return whole;

      const local = localUrlFor(absolute);
      if (!local) return whole;

      return `${name}="${local}"`;
    }
  );

  rewritten = rewritten.replace(
    /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (whole, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? "";
      return `srcset="${rewriteSrcset(value, baseHref, localUrlFor)}"`;
    }
  );

  rewritten = rewritten.replace(
    /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (whole, doubleValue, singleValue) => {
      const value = doubleValue ?? singleValue ?? "";
      const css = rewriteCssUrls(value, baseHref, localUrlFor)
        .replaceAll('"', "&quot;");
      return `style="${css}"`;
    }
  );

  return rewritten;
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

try {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));

  const analysis = analyzeChapterCaptures(
    manifest.captures || [],
    chapterNumber
  );

  const captures = sortChapterCaptures(analysis.captures);

  if (!captures.length) {
    throw new Error(`No captured XHTML fragments found for Chapter ${chapterNumber}.`);
  }

  if (analysis.knownLinkedMissing.length) {
    throw new Error(
      `Chapter ${chapterNumber} explicitly references uncaptured reader fragments: ` +
      `${analysis.knownLinkedMissing.join(", ")}. Re-run the scoped capture before assembling.`
    );
  }

  if (analysis.numericGaps.length) {
    const message =
      `Chapter ${chapterNumber} has non-contiguous reader file IDs: ` +
      `${analysis.numericGaps.join(", ")}. Reader IDs are not assumed to be continuous.`;

    if (strictReaderSequence) {
      throw new Error(
        `${message} MHE_STRICT_READER_SEQUENCE is enabled.`
      );
    }

    console.log(`\n[warning] ${message}`);
    console.log(
      "Assembly will continue because none of those IDs are explicitly referenced by the captured XHTML."
    );
  }

  if (analysis.auxiliaryCount) {
    console.log(
      `[info] Including ${analysis.auxiliaryCount} manually observed auxiliary XHTML fragment(s) in chapter order.`
    );
  }

  const localMap = new Map();

  for (const entry of inventory.assets || []) {
    const abs = path.join(assetRoot, entry.localFile);
    if (await fileExists(abs)) {
      localMap.set(normalizeUrl(entry.url), pathToFileURL(abs).href);
    }
  }

  const localUrlFor = (url) => localMap.get(normalizeUrl(url)) || null;

  const publisherCss = [];

  for (const entry of inventory.assets || []) {
    if (!(entry.kinds || []).includes("stylesheet")) continue;

    const abs = path.join(assetRoot, entry.localFile);
    if (!(await fileExists(abs))) {
      // A stylesheet that came only from generic CSS dependency expansion is
      // supplemental. Direct asset validation is responsible for blocking
      // genuinely required chapter stylesheets.
      continue;
    }

    const css = await fs.readFile(abs, "utf8");
    publisherCss.push(
      `/* ${entry.url} */\n${rewriteCssUrls(css, entry.url, localUrlFor)}`
    );
  }

  const bodyClasses = new Set();
  const inlineStyles = [];
  const fragments = [];

  for (const entry of captures) {
    const capturePath = path.join(CAPTURE_ROOT, entry.savedAs);
    const xhtml = await fs.readFile(capturePath, "utf8");

    const body = extractBody(xhtml);
    for (const className of body.classes) bodyClasses.add(className);

    for (const css of extractInlineStyles(xhtml)) {
      inlineStyles.push(
        rewriteCssUrls(css, entry.baseHref, localUrlFor)
      );
    }

    const cleaned = removeScripts(body.inner);
    const rewritten = rewriteHtmlAssets(cleaned, entry.baseHref, localUrlFor);

    fragments.push(
      `<!-- ${chapterLabel} ${captureLabel(entry)} -->\n${rewritten}`
    );
  }

  const title =
    captures.find((entry) => entry.title)?.title ||
    `Chapter ${chapterNumber}`;

  const reconstructionCss = `
/* terrible_mouse_recovery_target reconstruction overrides */
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

  const output = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</title>
<style>
${publisherCss.join("\n\n")}
${inlineStyles.join("\n\n")}
${reconstructionCss}
</style>
</head>
<body class="${[...bodyClasses].join(" ")}">
${fragments.join("\n\n")}
</body>
</html>
`;

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(htmlPath, output, "utf8");

  console.log("\nChapter reconstruction assembled\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Reader fragments: ${analysis.readerNumbers.length}`);
  console.log(`Auxiliary fragments: ${analysis.auxiliaryCount}`);
  console.log(`Total XHTML fragments: ${captures.length}`);
  console.log(`Cached resources available: ${localMap.size}`);
  console.log(`Saved: ${htmlPath}\n`);
} catch (error) {
  console.error(`\nASSEMBLY FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
