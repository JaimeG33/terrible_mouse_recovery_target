import { POLL_MS } from "./config.mjs";
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

let stopping = false;
let fatalError = null;
let scopePrinted = false;
let lastOutsideScope = "";
let lastKnownReader = null;
let captureQueue = Promise.resolve();

const attachedPages = new WeakSet();
const scheduledBases = new Set();
const completedBases = new Set();
const auxCounters = new Map();

function stop() {
  stopping = true;
}

function readChapterScope() {
  const envValue = process.env.MHE_CHAPTER;
  const eqArg = process.argv.find((arg) => arg.startsWith("--chapter="));
  const chapterArgIndex = process.argv.indexOf("--chapter");

  const raw =
    eqArg?.split("=", 2)[1] ??
    (chapterArgIndex >= 0 ? process.argv[chapterArgIndex + 1] : null) ??
    envValue ??
    null;

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid chapter scope: ${raw}`);
  }

  return parsed;
}

const targetChapter = readChapterScope();

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function nextAuxOrder(afterReaderNumber) {
  const key = String(afterReaderNumber ?? 0);
  const next = (auxCounters.get(key) || 0) + 1;
  auxCounters.set(key, next);
  return next;
}

async function processSnapshot(snapshot, source) {
  if (!snapshot.baseHref || !snapshot.html.trim()) return;

  const scope = await ensureBookScope(snapshot);

  if (!scopePrinted) {
    console.log(`[book-scope] ${scope.bookRoot}\n`);
    scopePrinted = true;
  }

  const location = parseReaderLocation(snapshot.baseHref);

  if (
    targetChapter &&
    location &&
    location.chapterNumber !== targetChapter
  ) {
    const outsideKey = `${location.chapterNumber}:${location.readerNumber}`;

    if (outsideKey !== lastOutsideScope) {
      lastOutsideScope = outsideKey;
      console.log(
        `[outside-scope] current chapter=${location.chapterNumber} ` +
        `reader=${location.readerNumber}; target chapter=${targetChapter}; not saved`
      );
    }

    return;
  }

  lastOutsideScope = "";

  let saveOptions = {};

  if (targetChapter && !location) {
    const afterReaderNumber = Number.isInteger(lastKnownReader)
      ? lastKnownReader
      : 0;

    saveOptions = {
      chapterNumberOverride: targetChapter,
      afterReaderNumber,
      auxOrderWithinGap: nextAuxOrder(afterReaderNumber)
    };
  }

  if (location?.chapterNumber === targetChapter || (!targetChapter && location)) {
    lastKnownReader = location.readerNumber;
  }

  const result = await saveSnapshot(snapshot, saveOptions);
  const d = describeSnapshot(snapshot);

  if (result.saved) {
    if (result.entry.scopedAuxiliary) {
      console.log(
        `[captured-aux] chapter=${result.entry.chapterNumber} ` +
        `afterReader=${result.entry.afterReaderNumber ?? "?"} ` +
        `pages=${d.pageNumbers} -> ${result.entry.savedAs}`
      );
    } else {
      console.log(
        `[captured] chapter=${d.chapter} reader=${d.readerFragment} ` +
        `pages=${d.pageNumbers} -> ${result.entry.savedAs}`
      );
    }
  } else if (result.reason === "duplicate") {
    if (result.updated) {
      console.log(
        `[reclassified] existing auxiliary fragment assigned to chapter=${result.entry.chapterNumber} ` +
        `afterReader=${result.entry.afterReaderNumber ?? "?"}`
      );
    } else if (result.entry.scopedAuxiliary) {
      console.log(
        `[seen-aux] chapter=${result.entry.chapterNumber} ` +
        `afterReader=${result.entry.afterReaderNumber ?? "?"} already captured`
      );
    } else {
      console.log(
        `[seen] chapter=${d.chapter} reader=${d.readerFragment} already captured`
      );
    }
  } else {
    console.log(`[skip] ${result.reason}`);
  }

  if (source === "navigation" && result.saved) {
    // Navigation event handled successfully. Polling remains as a fallback.
  }
}

function scheduleSnapshot(snapshot, source) {
  const key = snapshot.baseHref || `html:${snapshot.html.length}`;

  if (completedBases.has(key) || scheduledBases.has(key)) {
    return;
  }

  scheduledBases.add(key);

  captureQueue = captureQueue
    .then(async () => {
      await processSnapshot(snapshot, source);
      completedBases.add(key);
    })
    .catch((error) => {
      fatalError = error;
      stopping = true;
    })
    .finally(() => {
      scheduledBases.delete(key);
    });
}

async function attachNavigationListener(page) {
  if (attachedPages.has(page)) return;
  attachedPages.add(page);

  page.on("framenavigated", async (frame) => {
    if (stopping) return;

    try {
      const iframeHandle = await page.$("#clo-iframe");
      if (!iframeHandle) return;

      const currentReaderFrame = await iframeHandle.contentFrame();
      if (currentReaderFrame !== frame) return;

      await frame
        .waitForLoadState("domcontentloaded", { timeout: 2500 })
        .catch(() => {});

      // Give the newly loaded XHTML a brief moment to finish DOM setup, while
      // still capturing much sooner than the polling fallback.
      await new Promise((resolve) => setTimeout(resolve, 60));

      const snapshot = await getReaderSnapshotFromFrame(frame, page.url());
      scheduleSnapshot(snapshot, "navigation");
    } catch {
      // The frame may have moved again very quickly. Polling below is the fallback.
    }
  });
}

try {
  const browser = await connectToChrome();

  console.log("\nCapture watcher started.");
  console.log("Navigate the book manually in the dedicated Chrome window.");
  console.log(
    "Reader-frame navigation events are captured immediately, with polling as a fallback."
  );

  if (targetChapter) {
    console.log(`Chapter scope: ${targetChapter}.`);
    console.log(
      "Standard reader fragments from other chapters are ignored."
    );
    console.log(
      "Non-standard/auxiliary XHTML encountered while you manually traverse this chapter is preserved in chapter order."
    );
  } else {
    console.log("Chapter scope: unrestricted.");
    console.log(
      "For long capture sessions, prefer scripts\\chapter.ps1 so auxiliary content can be associated with the intended chapter."
    );
  }

  console.log("Press Ctrl+C here when finished.\n");

  while (!stopping) {
    try {
      const page = await findReaderPage(browser);
      await attachNavigationListener(page);

      const snapshot = await getReaderSnapshot(page);
      scheduleSnapshot(snapshot, "poll");
    } catch (error) {
      const firstLine = error.message.split("\n")[0];

      if (firstLine === "BOOK SCOPE MISMATCH") {
        fatalError = error;
        stopping = true;
        break;
      }

      console.log(`[waiting] ${firstLine}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  await captureQueue;

  if (fatalError) {
    throw fatalError;
  }
} catch (error) {
  console.error(`\nCAPTURE FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  console.log("\nCapture watcher stopped.");
  console.log("Run `npm run status` to review what was captured.\n");

  // Exiting drops the CDP connection but leaves the user's dedicated Chrome open.
  process.exit(process.exitCode || 0);
}
