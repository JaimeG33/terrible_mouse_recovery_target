import { POLL_MS } from "./config.mjs";
import { ensureBookScope } from "./book-scope.mjs";
import {
  connectToChrome,
  describeSnapshot,
  findReaderPage,
  getReaderSnapshot,
  parseReaderLocation,
  saveSnapshot
} from "./reader.mjs";

let stopping = false;
let lastObservedBase = "";
let lastOutsideScope = "";
let scopePrinted = false;

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

try {
  const browser = await connectToChrome();

  console.log("\nCapture watcher started.");
  console.log("Navigate the book manually in the dedicated Chrome window.");
  console.log("Each newly rendered #clo-iframe XHTML fragment will be saved once.");

  if (targetChapter) {
    console.log(`Chapter scope: ${targetChapter} (other chapters will not be saved).`);
  } else {
    console.log("Chapter scope: unrestricted.");
    console.log(
      "For long capture sessions, prefer scripts\\chapter.ps1 so accidental chapter changes are ignored."
    );
  }

  console.log("Press Ctrl+C here when finished.\n");

  while (!stopping) {
    try {
      const page = await findReaderPage(browser);
      const snapshot = await getReaderSnapshot(page);
      const location = parseReaderLocation(snapshot.baseHref);

      const scope = await ensureBookScope(snapshot);
      if (!scopePrinted) {
        console.log(`[book-scope] ${scope.bookRoot}\n`);
        scopePrinted = true;
      }

      if (snapshot.baseHref !== lastObservedBase) {
        lastObservedBase = snapshot.baseHref;

        if (
          targetChapter &&
          location?.chapterNumber !== targetChapter
        ) {
          const outsideKey = `${location?.chapterNumber ?? "?"}:${location?.readerNumber ?? "?"}`;
          if (outsideKey !== lastOutsideScope) {
            lastOutsideScope = outsideKey;
            console.log(
              `[outside-scope] current chapter=${location?.chapterNumber ?? "?"} ` +
              `reader=${location?.readerNumber ?? "?"}; target chapter=${targetChapter}; not saved`
            );
          }
        } else {
          lastOutsideScope = "";
          const result = await saveSnapshot(snapshot);
          const d = describeSnapshot(snapshot);

          if (result.saved) {
            console.log(
              `[captured] chapter=${d.chapter} reader=${d.readerFragment} ` +
              `pages=${d.pageNumbers} -> ${result.entry.savedAs}`
            );
          } else if (result.reason === "duplicate") {
            console.log(
              `[seen] chapter=${d.chapter} reader=${d.readerFragment} already captured`
            );
          } else {
            console.log(`[skip] ${result.reason}`);
          }
        }
      }
    } catch (error) {
      const firstLine = error.message.split("\n")[0];

      if (firstLine === "BOOK SCOPE MISMATCH") {
        throw error;
      }

      console.log(`[waiting] ${firstLine}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
} catch (error) {
  console.error(`\nCAPTURE FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  console.log("\nCapture watcher stopped.");
  console.log("Run `npm run status` to review what was captured.\n");

  // Do not call browser.close() here. This process attached to an already-running
  // dedicated Chrome instance. Exiting Node drops the CDP connection while the
  // user's dedicated Chrome window stays open.
  process.exit(process.exitCode || 0);
}
