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
  throw new Error(
    "MHE_CHAPTER must be a positive integer."
  );
}

const renderMode =
  (
    process.env.MHE_RENDER_MODE ||
    "normal"
  ).toLowerCase();

const supportedModes = [
  "normal",
  "safe",
  "plain",
  "partial-safe",
  "partial-plain"
];

if (!supportedModes.includes(renderMode)) {
  throw new Error(
    "MHE_RENDER_MODE must be normal, safe, plain, partial-safe, or partial-plain."
  );
}

const strictReaderSequence =
  /^(?:1|true|yes)$/i.test(
    process.env.MHE_STRICT_READER_SEQUENCE ||
      ""
  );

const partialFallbackFiles =
  new Set(
    String(
      process.env
        .MHE_PARTIAL_FALLBACK_FILES ||
        ""
    )
      .split(";")
      .map(
        (value) =>
          value.trim()
      )
      .filter(Boolean)
  );

const pad2 =
  (value) =>
    String(value).padStart(2, "0");

const chapterLabel =
  `chapter${pad2(chapterNumber)}`;

const variantInfo = {
  normal: {
    fileSuffix: "",
    titleSuffix: ""
  },
  safe: {
    fileSuffix:
      "_safe-formatting",
    titleSuffix:
      " — Safe Formatting"
  },
  plain: {
    fileSuffix:
      "_bare-bones",
    titleSuffix:
      " — Bare Bones"
  },
  "partial-safe": {
    fileSuffix:
      "_partial-safe",
    titleSuffix:
      " — Partial Safe"
  },
  "partial-plain": {
    fileSuffix:
      "_partial-bare-bones",
    titleSuffix:
      " — Partial Bare Bones"
  }
}[renderMode];

const outputBaseName =
  `${chapterLabel}${variantInfo.fileSuffix}`;

const assetRoot =
  path.join(
    ASSET_ROOT,
    chapterLabel
  );

const inventoryPath =
  path.join(
    assetRoot,
    "inventory.json"
  );

const outputRoot =
  path.join(
    OUTPUT_ROOT,
    chapterLabel
  );

const htmlPath =
  path.join(
    outputRoot,
    `${outputBaseName}.html`
  );

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(
      /&#(\d+);/g,
      (_, n) =>
        String.fromCodePoint(
          Number.parseInt(n, 10)
        )
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, n) =>
        String.fromCodePoint(
          Number.parseInt(n, 16)
        )
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
    const url =
      new URL(value);

    url.hash = "";
    return url.href;
  } catch {
    return String(value || "");
  }
}

function resolveUrl(raw, baseHref) {
  const value =
    String(raw || "").trim();

  if (
    !value ||
    value.startsWith("#")
  ) {
    return null;
  }

  if (
    /^(?:data|blob|javascript|mailto|tel):/i.test(
      value
    )
  ) {
    return null;
  }

  try {
    const url =
      new URL(
        value,
        baseHref
      );

    if (
      !["http:", "https:"].includes(
        url.protocol
      )
    ) {
      return null;
    }

    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function extractBody(html) {
  const match =
    html.match(
      /<body\b([^>]*)>([\s\S]*?)<\/body>/i
    );

  if (!match) {
    throw new Error(
      "Captured XHTML did not contain a <body> element."
    );
  }

  const attrs =
    match[1] || "";

  const inner =
    match[2] || "";

  const classMatch =
    attrs.match(
      /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i
    );

  return {
    classes:
      (
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
    .map(
      (match) =>
        match[1] || ""
    )
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

function rewriteCssUrls(
  css,
  baseHref,
  localUrlFor
) {
  return css.replace(
    /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi,
    (
      whole,
      a,
      b,
      c
    ) => {
      const raw =
        a ?? b ?? c ?? "";

      if (
        !raw ||
        raw.startsWith("#") ||
        /^data:/i.test(raw)
      ) {
        return whole;
      }

      const absolute =
        resolveUrl(
          raw,
          baseHref
        );

      if (!absolute) {
        return whole;
      }

      const local =
        localUrlFor(
          absolute
        );

      return local
        ? `url("${local}")`
        : 'url("data:,")';
    }
  );
}

function rewriteSrcset(
  value,
  baseHref,
  localUrlFor
) {
  return value
    .split(",")
    .map((part) => {
      const trimmed =
        part.trim();

      if (!trimmed) {
        return trimmed;
      }

      const pieces =
        trimmed.split(/\s+/);

      const raw =
        pieces.shift();

      const absolute =
        resolveUrl(
          raw,
          baseHref
        );

      const local =
        absolute
          ? localUrlFor(
              absolute
            )
          : null;

      return [
        local || "data:,",
        ...pieces
      ].join(" ");
    })
    .join(", ");
}

function getTagAttribute(
  tag,
  name
) {
  const regex =
    new RegExp(
      `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
      "i"
    );

  const match =
    tag.match(regex);

  return (
    match?.[1] ??
    match?.[2] ??
    null
  );
}

function missingImagePlaceholder(
  tag,
  absoluteUrl
) {
  const alt =
    getTagAttribute(
      tag,
      "alt"
    );

  const label =
    alt?.trim()
      ? `Missing image: ${alt.trim()}`
      : "Missing image";

  return (
    `<div class="recovery-missing-asset" ` +
    `data-recovery-missing="${escapeHtml(
      absoluteUrl
    )}">` +
    `[${escapeHtml(label)}]` +
    `</div>`
  );
}

function rewriteHtmlAssets(
  html,
  baseHref,
  localUrlFor,
  mode
) {
  let rewritten = html;

  if (mode !== "normal") {
    rewritten =
      rewritten.replace(
        /<img\b[^>]*>/gi,
        (tag) => {
          const raw =
            getTagAttribute(
              tag,
              "src"
            );

          const absolute =
            resolveUrl(
              raw,
              baseHref
            );

          if (
            absolute &&
            !localUrlFor(
              absolute
            )
          ) {
            return (
              missingImagePlaceholder(
                tag,
                absolute
              )
            );
          }

          return tag;
        }
      );
  }

  rewritten =
    rewritten.replace(
      /\b(src|poster|data|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (
        whole,
        name,
        doubleValue,
        singleValue
      ) => {
        const raw =
          doubleValue ??
          singleValue ??
          "";

        const absolute =
          resolveUrl(
            raw,
            baseHref
          );

        if (!absolute) {
          return whole;
        }

        const local =
          localUrlFor(
            absolute
          );

        if (local) {
          return (
            `${name}="${local}"`
          );
        }

        return (
          `${name}="data:," ` +
          `data-recovery-missing="` +
          `${escapeHtml(
            absolute
          )}"`
        );
      }
    );

  rewritten =
    rewritten.replace(
      /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
      (
        whole,
        doubleValue,
        singleValue
      ) => {
        const value =
          doubleValue ??
          singleValue ??
          "";

        return (
          `srcset="${rewriteSrcset(
            value,
            baseHref,
            localUrlFor
          )}"`
        );
      }
    );

  if (mode === "normal") {
    rewritten =
      rewritten.replace(
        /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
        (
          whole,
          doubleValue,
          singleValue
        ) => {
          const value =
            doubleValue ??
            singleValue ??
            "";

          const css =
            rewriteCssUrls(
              value,
              baseHref,
              localUrlFor
            ).replaceAll(
              '"',
              "&quot;"
            );

          return (
            `style="${css}"`
          );
        }
      );
  } else {
    rewritten =
      rewritten
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
  const body =
    extractBody(
      removeActiveContent(
        html
      )
    ).inner;

  let working = body;

  working =
    working.replace(
      /<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi,
      (
        _,
        a,
        b
      ) =>
        `\n[Image: ${a ?? b ?? ""}]\n`
    );

  working =
    working
      .replace(
        /<img\b[^>]*>/gi,
        "\n[Image]\n"
      )
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

  return decodeHtmlEntities(
    working
  )
    .replace(/\r/g, "")
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

function plainTextToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const cleaned =
        block
          .split("\n")
          .map(
            (line) =>
              escapeHtml(
                line.trim()
              )
          )
          .filter(Boolean)
          .join("<br>");

      return cleaned
        ? `<p>${cleaned}</p>`
        : "";
    })
    .filter(Boolean)
    .join("\n");
}

async function fileExists(filePath) {
  try {
    const stat =
      await fs.stat(
        filePath
      );

    return stat.isFile();
  } catch {
    return false;
  }
}

function captureLabel(entry) {
  if (
    Number.isInteger(
      entry.readerNumber
    )
  ) {
    return (
      `reader_${pad2(
        entry.readerNumber
      )}`
    );
  }

  const after =
    Number.isInteger(
      entry.afterReaderNumber
    )
      ? pad2(
          entry.afterReaderNumber
        )
      : "unknown";

  const ordinal =
    Number.isInteger(
      entry.auxOrderWithinGap
    )
      ? pad2(
          entry.auxOrderWithinGap
        )
      : "01";

  return (
    `aux_after_${after}_${ordinal}`
  );
}

function modeForCapture(entry) {
  if (renderMode === "normal") {
    return "normal";
  }

  if (renderMode === "safe") {
    return "safe";
  }

  if (renderMode === "plain") {
    return "plain";
  }

  if (
    renderMode === "partial-safe"
  ) {
    return partialFallbackFiles.has(
      entry.savedAs
    )
      ? "safe"
      : "normal";
  }

  if (
    renderMode ===
    "partial-plain"
  ) {
    return partialFallbackFiles.has(
      entry.savedAs
    )
      ? "plain"
      : "normal";
  }

  return "normal";
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
`;

const scopedSafeCss = `
.recovery-safe-fragment {
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 11pt !important;
  line-height: 1.48 !important;
  color: #111 !important;
  background: white !important;
}
.recovery-safe-fragment h1,
.recovery-safe-fragment h2,
.recovery-safe-fragment h3,
.recovery-safe-fragment h4,
.recovery-safe-fragment h5,
.recovery-safe-fragment h6 {
  page-break-after: avoid !important;
  break-after: avoid !important;
}
.recovery-safe-fragment img,
.recovery-safe-fragment svg,
.recovery-safe-fragment video {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  margin: 0.15in auto !important;
}
.recovery-safe-fragment table {
  width: 100% !important;
  border-collapse: collapse !important;
}
.recovery-safe-fragment td,
.recovery-safe-fragment th {
  border: 1px solid #999 !important;
  padding: 0.06in !important;
  vertical-align: top !important;
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
`;

const scopedPlainCss = `
.recovery-plain-fragment {
  font-family: Arial, Helvetica, sans-serif !important;
  font-size: 12pt !important;
  line-height: 1.55 !important;
  color: #111 !important;
  background: white !important;
  margin: 0 0 0.12in !important;
}
.recovery-plain-fragment p {
  margin: 0 0 0.14in !important;
}
`;

const missingAssetCss = `
.recovery-missing-asset {
  display: block;
  margin: 0.12in 0;
  padding: 0.08in;
  border: 1px dashed #777;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
}
`;

try {
  const manifest =
    JSON.parse(
      await fs.readFile(
        MANIFEST_PATH,
        "utf8"
      )
    );

  let inventory = {
    assets: []
  };

  try {
    inventory =
      JSON.parse(
        await fs.readFile(
          inventoryPath,
          "utf8"
        )
      );
  } catch (error) {
    if (
      [
        "normal",
        "partial-safe",
        "partial-plain"
      ].includes(renderMode) &&
      error.code === "ENOENT"
    ) {
      throw error;
    }
  }

  const analysis =
    analyzeChapterCaptures(
      manifest.captures || [],
      chapterNumber
    );

  const captures =
    sortChapterCaptures(
      analysis.captures
    );

  if (!captures.length) {
    throw new Error(
      `No captured XHTML fragments found for Chapter ${chapterNumber}.`
    );
  }

  if (
    analysis
      .knownLinkedMissing
      .length
  ) {
    throw new Error(
      `Chapter ${chapterNumber} explicitly references uncaptured reader fragments: ` +
      `${analysis.knownLinkedMissing.join(", ")}. Re-record this chapter before assembling.`
    );
  }

  if (
    renderMode.startsWith(
      "partial-"
    ) &&
    !partialFallbackFiles.size
  ) {
    throw new Error(
      "Partial fallback was selected, but no affected captured fragments were supplied."
    );
  }

  if (
    analysis.numericGaps.length
  ) {
    const message =
      `Chapter ${chapterNumber} has non-contiguous reader file IDs: ` +
      `${analysis.numericGaps.join(", ")}.`;

    if (strictReaderSequence) {
      throw new Error(
        `${message} MHE_STRICT_READER_SEQUENCE is enabled.`
      );
    }

    console.log(
      `\n[warning] ${message}`
    );

    console.log(
      "Reader IDs are file identifiers and are not assumed to be continuous."
    );
  }

  const localMap =
    new Map();

  for (
    const entry of
    inventory.assets || []
  ) {
    const abs =
      path.join(
        assetRoot,
        entry.localFile
      );

    if (
      await fileExists(abs)
    ) {
      localMap.set(
        normalizeUrl(
          entry.url
        ),
        pathToFileURL(
          abs
        ).href
      );
    }
  }

  const localUrlFor =
    (url) =>
      localMap.get(
        normalizeUrl(url)
      ) || null;

  const needsNormalStyles =
    renderMode === "normal" ||
    renderMode.startsWith(
      "partial-"
    );

  const publisherCss = [];

  if (needsNormalStyles) {
    for (
      const entry of
      inventory.assets || []
    ) {
      if (
        !(
          entry.kinds || []
        ).includes(
          "stylesheet"
        )
      ) {
        continue;
      }

      const abs =
        path.join(
          assetRoot,
          entry.localFile
        );

      if (
        !(await fileExists(abs))
      ) {
        continue;
      }

      const css =
        await fs.readFile(
          abs,
          "utf8"
        );

      publisherCss.push(
        `/* ${entry.url} */\n` +
        rewriteCssUrls(
          css,
          entry.url,
          localUrlFor
        )
      );
    }
  }

  const bodyClasses =
    new Set();

  const inlineStyles = [];
  const fragments = [];

  for (
    const entry of captures
  ) {
    const capturePath =
      path.join(
        CAPTURE_ROOT,
        entry.savedAs
      );

    const xhtml =
      await fs.readFile(
        capturePath,
        "utf8"
      );

    const fragmentMode =
      modeForCapture(entry);

    if (
      fragmentMode === "plain"
    ) {
      const text =
        plainTextFromHtml(
          xhtml
        );

      fragments.push(
        `<!-- ${chapterLabel} ${captureLabel(entry)} : plain fallback -->\n` +
        `<section class="recovery-plain-fragment" data-recovery-source="${escapeHtml(entry.savedAs)}">\n` +
        `${plainTextToHtml(text)}\n` +
        `</section>`
      );

      continue;
    }

    const body =
      extractBody(xhtml);

    if (
      fragmentMode === "normal"
    ) {
      for (
        const className of
        body.classes
      ) {
        bodyClasses.add(
          className
        );
      }

      for (
        const css of
        extractInlineStyles(
          xhtml
        )
      ) {
        inlineStyles.push(
          rewriteCssUrls(
            css,
            entry.baseHref,
            localUrlFor
          )
        );
      }
    }

    const cleaned =
      removeActiveContent(
        body.inner
      );

    const rewritten =
      rewriteHtmlAssets(
        cleaned,
        entry.baseHref,
        localUrlFor,
        fragmentMode
      );

    if (
      fragmentMode === "safe"
    ) {
      fragments.push(
        `<!-- ${chapterLabel} ${captureLabel(entry)} : safe fallback -->\n` +
        `<section class="recovery-safe-fragment" data-recovery-source="${escapeHtml(entry.savedAs)}">\n` +
        `${rewritten}\n` +
        `</section>`
      );
    } else {
      fragments.push(
        `<!-- ${chapterLabel} ${captureLabel(entry)} -->\n` +
        rewritten
      );
    }
  }

  const baseTitle =
    captures.find(
      (entry) =>
        entry.title
    )?.title ||
    `Chapter ${chapterNumber}`;

  const title =
    `${baseTitle}${variantInfo.titleSuffix}`;

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

  let modeCss = "";

  if (renderMode === "safe") {
    modeCss = safeCss;
  } else if (
    renderMode === "plain"
  ) {
    modeCss = plainCss;
  } else if (
    renderMode ===
    "partial-safe"
  ) {
    modeCss =
      scopedSafeCss;
  } else if (
    renderMode ===
    "partial-plain"
  ) {
    modeCss =
      scopedPlainCss;
  }

  const output =
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="recovery-render-mode" content="${escapeHtml(renderMode)}">
<title>${escapeHtml(title)}</title>
<style>
${publisherCss.join("\n\n")}
${needsNormalStyles ? inlineStyles.join("\n\n") : ""}
${reconstructionCss}
${modeCss}
${missingAssetCss}
</style>
</head>
<body class="${needsNormalStyles ? [...bodyClasses].join(" ") : ""}">
${fragments.join("\n\n")}
</body>
</html>
`;

  await fs.mkdir(
    outputRoot,
    { recursive: true }
  );

  await fs.writeFile(
    htmlPath,
    output,
    "utf8"
  );

  console.log(
    "\nChapter reconstruction assembled\n"
  );

  console.log(
    `Chapter: ${chapterNumber}`
  );

  console.log(
    `Render mode: ${renderMode}`
  );

  if (
    renderMode.startsWith(
      "partial-"
    )
  ) {
    console.log(
      "Partial fallback fragments:"
    );

    for (
      const file of
      partialFallbackFiles
    ) {
      console.log(
        `  - ${file}`
      );
    }
  }

  console.log(
    `Reader fragments: ${analysis.readerNumbers.length}`
  );

  console.log(
    `Auxiliary fragments: ${analysis.auxiliaryCount}`
  );

  console.log(
    `Total XHTML fragments: ${captures.length}`
  );

  console.log(
    `Cached resources available: ${localMap.size}`
  );

  console.log(
    `Saved: ${htmlPath}\n`
  );
} catch (error) {
  console.error(
    `\nASSEMBLY FAILED\n${error.message}\n`
  );

  process.exitCode = 1;
}
