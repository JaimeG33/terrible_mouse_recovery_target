import fs from "node:fs/promises";
import { MANIFEST_PATH } from "./config.mjs";
import { analyzeChapterCaptures } from "./capture-order.mjs";

try {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);

  const chapterNumbers = [
    ...new Set(
      (manifest.captures || [])
        .map((entry) => entry.chapterNumber)
        .filter(Number.isInteger)
    )
  ].sort((a, b) => a - b);

  const rows = chapterNumbers.map((chapterNumber) => {
    const analysis = analyzeChapterCaptures(
      manifest.captures,
      chapterNumber
    );

    return {
      chapter: chapterNumber,
      readerFragments: analysis.readerNumbers.length,
      auxiliaryFragments: analysis.auxiliaryCount,
      readers: analysis.readerNumbers.join(", ") || "(none)",
      numericIdGaps:
        analysis.numericGaps.length
          ? analysis.numericGaps.join(", ")
          : "none",
      knownLinkedMissing:
        analysis.knownLinkedMissing.length
          ? analysis.knownLinkedMissing.join(", ")
          : "none"
    };
  });

  console.log("\nCapture manifest validation\n");
  console.table(rows);

  const classified = (manifest.captures || []).filter(
    (entry) => Number.isInteger(entry.chapterNumber)
  ).length;
  const unclassified = (manifest.captures || []).length - classified;

  console.log(`Total captures: ${(manifest.captures || []).length}`);
  console.log(`Assigned to chapters: ${classified}`);
  console.log(`Unassigned fragments: ${unclassified}`);

  const blocking = rows.filter((row) => row.knownLinkedMissing !== "none");

  console.log(
    "\nNumeric reader IDs are file identifiers and are not assumed to be contiguous."
  );
  console.log(
    "`knownLinkedMissing` is more important: it means captured XHTML explicitly references a reader fragment that has not been captured."
  );

  if (blocking.length) {
    console.log(
      "\nWARNING: at least one chapter has a reader fragment explicitly referenced by captured XHTML but not yet captured."
    );
    process.exitCode = 2;
  }
} catch (error) {
  if (error.code === "ENOENT") {
    console.error("\nNo capture manifest exists yet. Run npm run capture first.\n");
  } else {
    console.error(`\nVALIDATION FAILED\n${error.message}\n`);
  }
  process.exitCode = 1;
}
