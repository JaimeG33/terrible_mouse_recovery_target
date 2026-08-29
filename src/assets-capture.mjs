import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./config.mjs";
import { connectToChrome, findReaderPage } from "./reader.mjs";

const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "1", 10);
if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const chapterAssetRoot = path.join(PROJECT_ROOT, "assets", chapterLabel);
const cacheRoot = path.join(chapterAssetRoot, "cache");
const inventoryPath = path.join(chapterAssetRoot, "inventory.json");

let browser;
let stopping = false;
let inventory;
const watched = new Map();
const pendingWrites = new Set();
let savedCount = 0;
let seenCount = 0;
let failedCount = 0;
let discoveredCssDeps = 0;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    if (/^\.[a-z0-9]{1,8}$/i.test(ext)) return ext.toLowerCase();
  } catch {
    // Fall back below.
  }
  return ".bin";
}

function localNameForUrl(url) {
  return `${sha256(url)}${extFromUrl(url)}`;
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

function resolveAssetUrl(raw, baseHref) {
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

function extractCssUrls(css, baseHref) {
  const urls = [];
  const regex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")\s]+))\s*\)/gi;
  let match;

  while ((match = regex.exec(css))) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const resolved = resolveAssetUrl(value, baseHref);
    if (resolved) urls.push(resolved);
  }

  return [...new Set(urls)];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureInventoryEntry(url, kind, referencedBy) {
  const normalized = normalizeUrl(url);

  let entry = inventory.assets.find((item) => normalizeUrl(item.url) === normalized);

  if (!entry) {
    entry = {
      url: normalized,
      kinds: [kind],
      referencedBy: [referencedBy],
      localFile: `cache/${localNameForUrl(normalized)}`
    };
    inventory.assets.push(entry);
  } else {
    entry.kinds = [...new Set([...(entry.kinds || []), kind])].sort();
    entry.referencedBy = [
      ...new Set([...(entry.referencedBy || []), referencedBy])
    ].sort();
  }

  watched.set(normalized, entry);
  return entry;
}

async function saveInventory() {
  inventory.assets.sort((a, b) => a.url.localeCompare(b.url));
  inventory.assetCount = inventory.assets.length;
  inventory.browserCaptureUpdatedAt = new Date().toISOString();
  inventory.browserCaptureStats = {
    savedCount,
    seenCount,
    failedCount,
    discoveredCssDeps
  };

  await fs.writeFile(
    inventoryPath,
    `${JSON.stringify(inventory, null, 2)}\n`,
    "utf8"
  );
}

async function processResponse(response) {
  const url = normalizeUrl(response.url());
  const entry = watched.get(url);
  if (!entry) return;

  const task = (async () => {
    const status = response.status();

    if (status < 200 || status >= 400) {
      failedCount += 1;
      console.log(`[skip ${status}] ${url}`);
      return;
    }

    const localPath = path.join(chapterAssetRoot, entry.localFile);

    if (await fileExists(localPath)) {
      seenCount += 1;
      return;
    }

    try {
      await response.finished().catch(() => {});
      const body = await response.body();

      if (!body?.length) {
        failedCount += 1;
        console.log(`[empty] ${url}`);
        return;
      }

      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, body);

      savedCount += 1;
      const contentType = response.headers()["content-type"] || "";
      console.log(
        `[saved ${status}] ${entry.localFile} (${body.length} bytes) <- ${url}`
      );

      const isCss =
        entry.kinds?.includes("stylesheet") ||
        contentType.toLowerCase().includes("text/css") ||
        /\.css(?:$|\?)/i.test(url);

      if (isCss) {
        const css = body.toString("utf8");
        for (const dependencyUrl of extractCssUrls(css, url)) {
          if (watched.has(dependencyUrl)) continue;

          ensureInventoryEntry(
            dependencyUrl,
            "css-dependency",
            url
          );

          discoveredCssDeps += 1;
          console.log(`[watch+] CSS dependency ${dependencyUrl}`);
        }

        await saveInventory();
      }
    } catch (error) {
      failedCount += 1;
      console.log(`[body-error] ${url} :: ${error.message}`);
    }
  })();

  pendingWrites.add(task);
  task.finally(() => pendingWrites.delete(task));
}

try {
  inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));

  if (!Array.isArray(inventory.assets) || !inventory.assets.length) {
    throw new Error(
      `No asset inventory entries exist for Chapter ${chapterNumber}. Run npm run assets:inventory first.`
    );
  }

  await fs.mkdir(cacheRoot, { recursive: true });

  for (const entry of inventory.assets) {
    watched.set(normalizeUrl(entry.url), entry);
  }

  browser = await connectToChrome();
  const page = await findReaderPage(browser);

  page.on("response", processResponse);

  console.log("\nBrowser-response asset capture started.");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Watching ${watched.size} known asset URLs.`);
  console.log("");
  console.log(
    "Navigate Chapter 1 normally in the dedicated Chrome window and scroll through the pages."
  );
  console.log(
    "This tool only saves matching resource responses that Chrome itself receives."
  );
  console.log(
    "If CSS adds font/background dependencies, they will be added to the watch list automatically."
  );
  console.log("Press Ctrl+C here when finished.\n");

  while (!stopping) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await Promise.allSettled([...pendingWrites]);
  await saveInventory();

  console.log("\nBrowser-response asset capture stopped.");
  console.log(`Saved: ${savedCount}`);
  console.log(`Already cached/seen: ${seenCount}`);
  console.log(`Failed response bodies: ${failedCount}`);
  console.log(`New CSS dependencies discovered: ${discoveredCssDeps}`);
  console.log(`Inventory now tracks: ${inventory.assets.length} assets\n`);
} catch (error) {
  console.error(`\nBROWSER ASSET CAPTURE FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  // This tool attached to an already-running dedicated Chrome instance.
  // Exit the Node process to drop the CDP connection without intentionally closing Chrome.
  process.exit(process.exitCode || 0);
}
