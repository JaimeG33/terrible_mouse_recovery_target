import {
  connectToChrome,
  describeSnapshot,
  findReaderPage,
  getReaderSnapshot
} from "./reader.mjs";

let browser;

try {
  browser = await connectToChrome();
  const page = await findReaderPage(browser);
  const snapshot = await getReaderSnapshot(page);
  const description = describeSnapshot(snapshot);

  console.log("\nCurrent reader fragment\n");
  console.table(description);

  if (snapshot.readerLinks.length) {
    console.log("\nReader fragment links visible in the current XHTML:");
    for (const href of snapshot.readerLinks) {
      console.log(`  - ${href}`);
    }
  }

  if (snapshot.pageBreaks.length) {
    console.log("\nEPUB page-break markers in the current XHTML:");
    console.table(snapshot.pageBreaks);
  }
} catch (error) {
  console.error(`\nINSPECT FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  // This tool attached to an already-running dedicated Chrome instance.
  // Exit the Node process to drop the CDP connection without intentionally closing Chrome.
  process.exit(process.exitCode || 0);
}
