import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ASSET_ROOT, CAPTURE_ROOT, MANIFEST_PATH } from "./config.mjs";
const mode = process.argv[2] || "inventory";
const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "1", 10);

if (!["inventory", "download", "validate"].includes(mode)) {
  throw new Error(`Unknown mode: ${mode}`);
}

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const chapterAssetRoot = path.join(ASSET_ROOT, chapterLabel);
const cacheRoot = path.join(chapterAssetRoot, "cache");
const inventoryPath = path.join(chapterAssetRoot, "inventory.json");

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    if (/^\.[a-z0-9]{1,8}$/i.test(ext)) return ext.toLowerCase();
  } catch {
    // No extension.
  }
  return ".bin";
}

function localNameForUrl(url) {
  return `${sha256(url)}${extFromUrl(url)}`;
}

function resolveUrl(raw, baseHref) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^(?:data|blob|javascript|mailto|tel):/i.test(value)) return null;
  if (value.startsWith("#")) return null;

  try {
    const url = new URL(value, baseHref);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function parseAttributes(tag) {
  const attrs = new Map();
  const regex = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = regex.exec(tag))) {
    attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attrs;
}

function splitSrcset(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function addReference(map, rawUrl, baseHref, kind, sourceFile) {
  const url = resolveUrl(rawUrl, baseHref);
  if (!url) return;

  if (!map.has(url)) {
    map.set(url, {
      url,
      kinds: new Set(),
      referencedBy: new Set(),
      localFile: `cache/${localNameForUrl(url)}`
    });
  }

  const entry = map.get(url);
  entry.kinds.add(kind);
  entry.referencedBy.add(sourceFile);
}

function extractFromXhtml(html, baseHref, sourceFile, map) {
  const tagRegex = /<(img|link|source|video|audio|object|image)\b[^>]*>/gi;
  let match;

  while ((match = tagRegex.exec(html))) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];
    const attrs = parseAttributes(tag);

    if (tagName === "img") {
      addReference(map, attrs.get("src"), baseHref, "image", sourceFile);
      for (const item of splitSrcset(attrs.get("srcset"))) {
        addReference(map, item, baseHref, "image-srcset", sourceFile);
      }
    }

    if (tagName === "link") {
      const rel = (attrs.get("rel") || "").toLowerCase();
      if (rel.split(/\s+/).includes("stylesheet")) {
        addReference(map, attrs.get("href"), baseHref, "stylesheet", sourceFile);
      }
    }

    if (tagName === "source") {
      addReference(map, attrs.get("src"), baseHref, "media-source", sourceFile);
      for (const item of splitSrcset(attrs.get("srcset"))) {
        addReference(map, item, baseHref, "media-srcset", sourceFile);
      }
    }

    if (tagName === "video") {
      addReference(map, attrs.get("poster"), baseHref, "video-poster", sourceFile);
      addReference(map, attrs.get("src"), baseHref, "video", sourceFile);
    }

    if (tagName === "audio") {
      addReference(map, attrs.get("src"), baseHref, "audio", sourceFile);
    }

    if (tagName === "object") {
      addReference(map, attrs.get("data"), baseHref, "object", sourceFile);
    }

    if (tagName === "image") {
      addReference(
        map,
        attrs.get("href") || attrs.get("xlink:href"),
        baseHref,
        "svg-image",
        sourceFile
      );
    }
  }

  const styleBlocks = html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  for (const styleMatch of styleBlocks) {
    extractCssUrls(styleMatch[1], baseHref, sourceFile, map, "inline-css");
  }

  const styleAttrs = html.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi);
  for (const styleMatch of styleAttrs) {
    extractCssUrls(
      styleMatch[1] ?? styleMatch[2] ?? "",
      baseHref,
      sourceFile,
      map,
      "style-attribute"
    );
  }
}

function extractCssUrls(css, baseHref, sourceFile, map, kind = "css-dependency") {
  const regex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi;
  let match;

  while ((match = regex.exec(css))) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    addReference(map, value, baseHref, kind, sourceFile);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function buildInventory() {
  const manifest = await readJson(MANIFEST_PATH);

  const captures = manifest.captures
    .filter((entry) => entry.chapterNumber === chapterNumber)
    .sort((a, b) => (a.readerNumber ?? 9999) - (b.readerNumber ?? 9999));

  if (!captures.length) {
    throw new Error(`No captures found for Chapter ${chapterNumber}.`);
  }

  const map = new Map();

  for (const entry of captures) {
    const capturePath = path.join(CAPTURE_ROOT, entry.savedAs);
    const html = await fs.readFile(capturePath, "utf8");
    extractFromXhtml(html, entry.baseHref, entry.savedAs, map);
  }

  const entries = [...map.values()]
    .map((entry) => ({
      url: entry.url,
      kinds: [...entry.kinds].sort(),
      referencedBy: [...entry.referencedBy].sort(),
      localFile: entry.localFile
    }))
    .sort((a, b) => a.url.localeCompare(b.url));

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chapterNumber,
    captureCount: captures.length,
    assetCount: entries.length,
    assets: entries
  };

  await fs.mkdir(chapterAssetRoot, { recursive: true });
  await fs.writeFile(inventoryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return payload;
}

async function downloadInventory(inventory) {
  await fs.mkdir(cacheRoot, { recursive: true });

  const queue = [...inventory.assets];
  const byUrl = new Map(queue.map((entry) => [entry.url, entry]));
  const results = [];
  let cursor = 0;

  while (cursor < queue.length) {
    const entry = queue[cursor++];
    const absolutePath = path.join(chapterAssetRoot, entry.localFile);

    try {
      await fs.access(absolutePath);
      results.push({ url: entry.url, status: "existing", localFile: entry.localFile });
      continue;
    } catch {
      // Download below.
    }

    try {
      const response = await fetch(entry.url, {
        redirect: "follow",
        headers: {
          "User-Agent": "terrible_mouse_recovery_target/0.3 local accessibility export"
        }
      });

      if (!response.ok) {
        results.push({
          url: entry.url,
          status: "http-error",
          httpStatus: response.status,
          localFile: entry.localFile
        });
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(absolutePath, buffer);

      const contentType = response.headers.get("content-type") || "";
      results.push({
        url: entry.url,
        status: "downloaded",
        httpStatus: response.status,
        contentType,
        bytes: buffer.length,
        localFile: entry.localFile
      });

      const isStylesheet =
        entry.kinds.includes("stylesheet") ||
        contentType.toLowerCase().includes("text/css") ||
        /\.css(?:$|\?)/i.test(entry.url);

      if (isStylesheet) {
        const css = buffer.toString("utf8");
        const cssMap = new Map();
        extractCssUrls(css, entry.url, entry.url, cssMap);

        for (const nested of cssMap.values()) {
          if (byUrl.has(nested.url)) continue;

          const nestedEntry = {
            url: nested.url,
            kinds: [...nested.kinds].sort(),
            referencedBy: [...nested.referencedBy].sort(),
            localFile: nested.localFile
          };

          byUrl.set(nested.url, nestedEntry);
          queue.push(nestedEntry);
        }
      }
    } catch (error) {
      results.push({
        url: entry.url,
        status: "error",
        error: error.message,
        localFile: entry.localFile
      });
    }
  }

  const finalAssets = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
  const payload = {
    ...inventory,
    updatedAt: new Date().toISOString(),
    assetCount: finalAssets.length,
    assets: finalAssets,
    downloadResults: results
  };

  await fs.writeFile(inventoryPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function validateInventory(inventory) {
  const rows = [];
  let present = 0;
  let missing = 0;

  for (const entry of inventory.assets) {
    const absolutePath = path.join(chapterAssetRoot, entry.localFile);

    try {
      const stat = await fs.stat(absolutePath);
      present += 1;
      rows.push({
        status: "present",
        bytes: stat.size,
        kind: entry.kinds.join("|"),
        url: entry.url
      });
    } catch {
      missing += 1;
      rows.push({
        status: "missing",
        bytes: 0,
        kind: entry.kinds.join("|"),
        url: entry.url
      });
    }
  }

  console.log("\nAsset validation\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Present: ${present}`);
  console.log(`Missing: ${missing}`);
  console.log(`Total: ${inventory.assets.length}\n`);

  const failures = rows.filter((row) => row.status === "missing");
  if (failures.length) {
    console.table(failures.slice(0, 25));
    if (failures.length > 25) {
      console.log(`... ${failures.length - 25} additional missing assets omitted`);
    }
  }

  return { present, missing, total: inventory.assets.length };
}

try {
  if (mode === "inventory") {
    const inventory = await buildInventory();
    console.log("\nReferenced asset inventory created\n");
    console.log(`Chapter: ${chapterNumber}`);
    console.log(`Captured XHTML fragments scanned: ${inventory.captureCount}`);
    console.log(`Referenced assets found: ${inventory.assetCount}`);
    console.log(`Saved: ${inventoryPath}\n`);
  }

  if (mode === "download") {
    let inventory;
    try {
      inventory = await readJson(inventoryPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      inventory = await buildInventory();
    }

    const updated = await downloadInventory(inventory);
    const downloaded = updated.downloadResults.filter(
      (item) => item.status === "downloaded"
    ).length;
    const existing = updated.downloadResults.filter(
      (item) => item.status === "existing"
    ).length;
    const failed = updated.downloadResults.filter(
      (item) => !["downloaded", "existing"].includes(item.status)
    ).length;

    console.log("\nReferenced asset download finished\n");
    console.log(`Chapter: ${chapterNumber}`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Already present: ${existing}`);
    console.log(`Failed: ${failed}`);
    console.log(`Inventory now tracks: ${updated.assetCount} assets`);
    console.log(`Saved under: ${cacheRoot}\n`);
  }

  if (mode === "validate") {
    const inventory = await readJson(inventoryPath);
    const result = await validateInventory(inventory);

    if (result.missing) {
      process.exitCode = 2;
    }
  }
} catch (error) {
  console.error(`\nASSET ${mode.toUpperCase()} FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
