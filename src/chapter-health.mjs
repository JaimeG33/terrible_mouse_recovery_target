import fs from "node:fs/promises";
import { MANIFEST_PATH } from "./config.mjs";
import { analyzeChapterCaptures } from "./capture-order.mjs";

const chapterNumber = Number.parseInt(
  process.env.MHE_CHAPTER || "",
  10
);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

try {
  const manifest = JSON.parse(
    await fs.readFile(MANIFEST_PATH, "utf8")
  );

  const analysis = analyzeChapterCaptures(
    manifest.captures || [],
    chapterNumber
  );

  console.log("\nChapter capture health\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(
    `Reader fragments: ${analysis.readerNumbers.join(", ") || "(none)"}`
  );
  console.log(`Auxiliary fragments: ${analysis.auxiliaryCount}`);
  console.log(
    `Numeric ID gaps: ${analysis.numericGaps.join(", ") || "none (informational only)"}`
  );
  console.log(
    `Known linked missing readers: ${analysis.knownLinkedMissing.join(", ") || "none"}`
  );

  if (!analysis.captures.length) {
    console.error(
      "\nFAIL: no captured XHTML is assigned to this chapter."
    );
    process.exitCode = 2;
  } else if (analysis.knownLinkedMissing.length) {
    console.error(
      "\nFAIL: captured XHTML explicitly references reader fragments that are not saved."
    );
    console.error(
      `Re-record Chapter ${chapterNumber} and revisit reader fragment(s): ${analysis.knownLinkedMissing.join(", ")}`
    );
    process.exitCode = 2;
  } else {
    console.log(
      "\nPASS: no explicitly referenced reader fragment is missing."
    );
  }
} catch (error) {
  console.error(`\nCHAPTER HEALTH FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
