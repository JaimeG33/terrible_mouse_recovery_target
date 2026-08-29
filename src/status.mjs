import fs from "node:fs/promises";
import path from "node:path";
import { CAPTURE_ROOT, MANIFEST_PATH, PROJECT_ROOT } from "./config.mjs";
import { readBookScope } from "./book-scope.mjs";
import { analyzeChapterCaptures } from "./capture-order.mjs";

const TOC_PATH = path.join(PROJECT_ROOT, "structure", "toc.json");

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

try {
  const manifest = await readJsonIfPresent(MANIFEST_PATH);
  const toc = await readJsonIfPresent(TOC_PATH);
  const bookScope = await readBookScope();

  if (!manifest?.captures?.length) {
    console.log("\nNo captures found yet.");
    console.log(`Capture root: ${CAPTURE_ROOT}\n`);
    process.exit(0);
  }

  const chapterTitles = new Map();

  for (const node of toc?.nodes || []) {
    if (node.level !== 0) continue;

    const match = String(node.label || "").match(/\bChapter\s+(\d+)\b/i);
    if (!match) continue;

    chapterTitles.set(
      Number.parseInt(match[1], 10),
      node.label
    );
  }

  const chapterNumbers = [
    ...new Set([
      ...chapterTitles.keys(),
      ...manifest.captures
        .map((entry) => entry.chapterNumber)
        .filter(Number.isInteger)
    ])
  ].sort((a, b) => a - b);

  console.log("\nCapture status\n");

  if (bookScope?.bookRoot) {
    console.log(`Book scope: ${bookScope.bookRoot}`);
  }

  if (process.env.MHE_CHAPTER) {
    console.log(`Active MHE_CHAPTER: ${process.env.MHE_CHAPTER}`);
  }

  console.log("");

  console.table(
    chapterNumbers.map((chapterNumber) => {
      const analysis = analyzeChapterCaptures(
        manifest.captures,
        chapterNumber
      );

      const pageMarkers = analysis.captures.reduce(
        (sum, entry) => sum + (entry.pageBreaks || []).length,
        0
      );

      return {
        chapter: chapterNumber,
        title: chapterTitles.get(chapterNumber) || "",
        readers: analysis.readerNumbers.join(", ") || "(none)",
        auxiliary: analysis.auxiliaryCount,
        numericGaps:
          analysis.numericGaps.length
            ? analysis.numericGaps.join(", ")
            : "none",
        knownMissing:
          analysis.knownLinkedMissing.length
            ? analysis.knownLinkedMissing.join(", ")
            : "none",
        pageMarkers
      };
    })
  );

  console.log(
    "\n`numericGaps` are informational because McGraw Hill reader file numbers may skip."
  );
  console.log(
    "`knownMissing` means captured XHTML explicitly references a reader fragment that is not saved and should be investigated."
  );
  console.log(
    "Auxiliary fragments are non-reader_N XHTML encountered during a manually scoped chapter pass and are preserved in sequence.\n"
  );
} catch (error) {
  console.error(`\nSTATUS FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
