import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVE_BOOK_ID,
  STAGING_ROOT,
  POLL_MS
} from "./config.mjs";
import { ensureBookScope } from "./book-scope.mjs";
import {
  connectToChrome,
  describeSnapshot,
  findReaderPage,
  getReaderSnapshot,
  getReaderSnapshotFromFrame,
  parseReaderLocation,
  saveSnapshot
} from "./reader.mjs";

const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "", 10);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error(
    "RECORD requires MHE_CHAPTER. Use scripts\\chapter.ps1 -Chapter <number> -Action record."
  );
}

if (!ACTIVE_BOOK_ID) {
  throw new Error(
    "No active book is selected. Run npm run book:use-current first."
  );
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const stagingChapterRoot = path.join(STAGING_ROOT, chapterLabel);
const responseRoot = path.join(stagingChapterRoot, "responses");
const stagingIndexPath = path.join(stagingChapterRoot, "index.json");

let stopping = false;
let fatalError = null;
let bookScope = null;
let lastKnownReader = null;
let lastOutsideScope = "";
let captureQueue = Promise.resolve();
let responseQueue = Promise.resolve();

const attachedPages = new WeakSet();
const scheduledBases = new Set();
const completedBases = new Set();
const auxCounters = new Map();
const seenResponseUrls = new Set();

let xhtmlSaved = 0;
let auxiliarySaved = 0;
let assetsStaged = 0;
let assetsSeen = 0;
let assetBodyErrors = 0;

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
    const ext = path.extname(new URL(url).pathname);
    if (/^\.[a-z0-9]{1,8}$/i.test(ext)) return ext.toLowerCase();
  } catch {
    // Fall through.
  }

  return ".bin";
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

function nextAuxOrder(afterReaderNumber) {
  const key = String(afterReaderNumber ?? 0);
  const next = (auxCounters.get(key) || 0) + 1;
  auxCounters.set(key, next);
  return next;
}

function responseEligible(response) {
  const url = normalizeUrl(response.url());

  if (!url || !bookScope?.bookRoot) return false;

  const fromBook = url.startsWith(bookScope.bookRoot);
  const readerIframeStyle =
    /^https:\/\/(?:prod\.)?reader-ui\.prod\.mheducation\.com\/epub-iframe-styles\.css/i.test(
      url
    );

  if (!fromBook && !readerIframeStyle) return false;

  const resourceType = response.request().resourceType();
  const contentType = (
    response.headers()["content-type"] || ""
  ).toLowerCase();

  if (
    ["image", "stylesheet", "font", "media"].includes(resourceType)
  ) {
    return true;
  }

  if (
    /^(?:image\/|font\/|audio\/|video\/|text\/css)/i.test(contentType)
  ) {
    return true;
  }

  return /\.(?:css|png|jpe?g|gif|webp|svg|woff2?|ttf|otf|mp4|mp3|m4a)(?:$|\?)/i.test(
    url
  );
}

async function readStagingIndex() {
  try {
    return JSON.parse(await fs.readFile(stagingIndexPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        bookId: ACTIVE_BOOK_ID,
        chapterNumber,
        createdAt: new Date().toISOString(),
        responses: []
      };
    }
    throw error;
  }
}

async function writeStagingIndex(index) {
  await fs.mkdir(stagingChapterRoot, { recursive: true });
  index.updatedAt = new Date().toISOString();
  index.responseCount = index.responses.length;
  await fs.writeFile(
    stagingIndexPath,
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8"
  );
}

async function stageResponse(response) {
  if (!responseEligible(response)) return;

  const url = normalizeUrl(response.url());
  if (seenResponseUrls.has(url)) {
    assetsSeen += 1;
    return;
  }

  seenResponseUrls.add(url);

  const task = async () => {
    try {
      const status = response.status();
      if (status < 200 || status >= 400) return;

      const body = await response.body();
      if (!body?.length) return;

      const fileName = `${sha256(url)}${extFromUrl(url)}`;
      const localFile = `responses/${fileName}`;
      const absPath = path.join(stagingChapterRoot, localFile);

      await fs.mkdir(responseRoot, { recursive: true });
      await fs.writeFile(absPath, body);

      const index = await readStagingIndex();
      const existing = index.responses.find(
        (entry) => normalizeUrl(entry.url) === url
      );

      const row = {
        url,
        localFile,
        status,
        bytes: body.length,
        contentType: response.headers()["content-type"] || "",
        resourceType: response.request().resourceType(),
        capturedAt: new Date().toISOString()
      };

      if (existing) {
        Object.assign(existing, row);
      } else {
        index.responses.push(row);
      }

      await writeStagingIndex(index);
      assetsStaged += 1;

      console.log(
        `[asset] ${fileName} (${body.length} bytes)`
      );
    } catch (error) {
      assetBodyErrors += 1;
      console.log(
        `[asset-warning] ${url} :: ${error.message.split("\n")[0]}`
      );
    }
  };

  responseQueue = responseQueue.then(task);
}

async function processSnapshot(snapshot) {
  if (!snapshot.baseHref || !snapshot.html.trim()) return;

  const scope = await ensureBookScope(snapshot);
  bookScope = scope;

  const location = parseReaderLocation(snapshot.baseHref);

  if (location && location.chapterNumber !== chapterNumber) {
    const key = `${location.chapterNumber}:${location.readerNumber}`;

    if (key !== lastOutsideScope) {
      lastOutsideScope = key;
      console.log(
        `[outside-scope] current chapter=${location.chapterNumber} ` +
        `reader=${location.readerNumber}; target chapter=${chapterNumber}; not saved`
      );
    }

    return;
  }

  lastOutsideScope = "";

  let saveOptions = {};

  if (!location) {
    const afterReaderNumber = Number.isInteger(lastKnownReader)
      ? lastKnownReader
      : 0;

    saveOptions = {
      chapterNumberOverride: chapterNumber,
      afterReaderNumber,
      auxOrderWithinGap: nextAuxOrder(afterReaderNumber)
    };
  } else {
    lastKnownReader = location.readerNumber;
  }

  const result = await saveSnapshot(snapshot, saveOptions);
  const d = describeSnapshot(snapshot);

  if (result.saved) {
    if (result.entry.scopedAuxiliary) {
      auxiliarySaved += 1;
      console.log(
        `[captured-aux] chapter=${chapterNumber} ` +
        `afterReader=${result.entry.afterReaderNumber ?? "?"} ` +
        `pages=${d.pageNumbers} -> ${result.entry.savedAs}`
      );
    } else {
      xhtmlSaved += 1;
      console.log(
        `[captured] chapter=${d.chapter} reader=${d.readerFragment} ` +
        `pages=${d.pageNumbers} -> ${result.entry.savedAs}`
      );
    }
  } else if (result.reason === "duplicate") {
    if (result.entry.scopedAuxiliary) {
      console.log(
        `[seen-aux] afterReader=${result.entry.afterReaderNumber ?? "?"}`
      );
    } else {
      console.log(
        `[seen] chapter=${d.chapter} reader=${d.readerFragment}`
      );
    }
  }
}

function scheduleSnapshot(snapshot) {
  const key = snapshot.baseHref || `html:${snapshot.html.length}`;

  if (completedBases.has(key) || scheduledBases.has(key)) {
    return;
  }

  scheduledBases.add(key);

  captureQueue = captureQueue
    .then(async () => {
      await processSnapshot(snapshot);
      completedBases.add(key);
    })
    .catch((error) => {
      fatalError = error;
      stopping = true;
    })
    .finally(() => scheduledBases.delete(key));
}

async function attachListeners(page) {
  if (attachedPages.has(page)) return;
  attachedPages.add(page);

  page.on("response", (response) => {
    stageResponse(response);
  });

  page.on("framenavigated", async (frame) => {
    if (stopping) return;

    try {
      const iframeHandle = await page.$("#clo-iframe");
      if (!iframeHandle) return;

      const readerFrame = await iframeHandle.contentFrame();
      if (readerFrame !== frame) return;

      await frame
        .waitForLoadState("domcontentloaded", { timeout: 2500 })
        .catch(() => {});

      await new Promise((resolve) => setTimeout(resolve, 60));
      scheduleSnapshot(
        await getReaderSnapshotFromFrame(frame, page.url())
      );
    } catch {
      // Polling remains the fallback.
    }
  });
}

try {
  await fs.mkdir(responseRoot, { recursive: true });

  const browser = await connectToChrome();
  const page = await findReaderPage(browser);
  const initialSnapshot = await getReaderSnapshot(page);

  bookScope = await ensureBookScope(initialSnapshot);
  await attachListeners(page);

  const initialLocation = parseReaderLocation(initialSnapshot.baseHref);

  console.log("\nONE-PASS CHAPTER RECORDING READY\n");
  console.log(`Book ID:  ${ACTIVE_BOOK_ID}`);
  console.log(`Chapter:  ${chapterNumber}`);
  console.log("");
  console.log(
    "This records rendered XHTML and passively stages matching book images/styles/media at the same time."
  );
  console.log(
    "Manually traverse the chapter once. No automatic page navigation is performed."
  );

  if (initialLocation?.chapterNumber === chapterNumber) {
    console.log("");
    console.log(
      "NOTE: You are already inside the target chapter. To capture opening assets reliably,"
    );
    console.log(
      "manually use the TOC to re-enter the beginning of this chapter after this READY message."
    );
  }

  console.log("\nPress Ctrl+C when you reach the next chapter.\n");

  scheduleSnapshot(initialSnapshot);

  while (!stopping) {
    try {
      const currentPage = await findReaderPage(browser);
      await attachListeners(currentPage);
      scheduleSnapshot(await getReaderSnapshot(currentPage));
    } catch (error) {
      console.log(`[waiting] ${error.message.split("\n")[0]}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  await captureQueue;
  await responseQueue;

  if (fatalError) throw fatalError;

  console.log("\nOne-pass recording stopped.");
  console.log(`New reader XHTML captures: ${xhtmlSaved}`);
  console.log(`New auxiliary XHTML captures: ${auxiliarySaved}`);
  console.log(`Assets staged this session: ${assetsStaged}`);
  console.log(`Already seen asset responses: ${assetsSeen}`);
  console.log(`Asset response warnings: ${assetBodyErrors}`);
  console.log(`Staging index: ${stagingIndexPath}\n`);
  console.log(
    `Next: .\\scripts\\chapter.ps1 -Chapter ${chapterNumber} -Action build`
  );
} catch (error) {
  console.error(`\nRECORDING FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  process.exit(process.exitCode || 0);
}
