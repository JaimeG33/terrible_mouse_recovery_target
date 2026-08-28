import { POLL_MS } from "./config.mjs";
import {
  connectToChrome,
  describeSnapshot,
  findReaderPage,
  getReaderSnapshot,
  saveSnapshot
} from "./reader.mjs";

let browser;
let stopping = false;
let lastObservedBase = "";

function stop() {
  stopping = true;
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  browser = await connectToChrome();

  console.log("\nCapture watcher started.");
  console.log("Navigate the book manually in the dedicated Chrome window.");
  console.log("Each newly rendered #clo-iframe XHTML fragment will be saved once.");
  console.log("Press Ctrl+C here when finished.\n");

  while (!stopping) {
    try {
      const page = await findReaderPage(browser);
      const snapshot = await getReaderSnapshot(page);

      if (snapshot.baseHref !== lastObservedBase) {
        lastObservedBase = snapshot.baseHref;
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
    } catch (error) {
      console.log(`[waiting] ${error.message.split("\n")[0]}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
} catch (error) {
  console.error(`\nCAPTURE FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  console.log("\nCapture watcher stopped.");
  await browser?.close().catch(() => {});
}
