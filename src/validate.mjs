import fs from "node:fs/promises";
import { MANIFEST_PATH } from "./config.mjs";

function missingNumbers(values) {
  if (!values.length) return [];
  const set = new Set(values);
  const max = Math.max(...values);
  const missing = [];
  for (let i = 1; i <= max; i += 1) {
    if (!set.has(i)) missing.push(i);
  }
  return missing;
}

try {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);

  const classified = manifest.captures.filter(
    (entry) => Number.isInteger(entry.chapterNumber) && Number.isInteger(entry.readerNumber)
  );

  const byChapter = new Map();
  for (const entry of classified) {
    const list = byChapter.get(entry.chapterNumber) || [];
    list.push(entry.readerNumber);
    byChapter.set(entry.chapterNumber, list);
  }

  const rows = [...byChapter.entries()]
    .sort(([a], [b]) => a - b)
    .map(([chapter, readers]) => {
      const unique = [...new Set(readers)].sort((a, b) => a - b);
      const missing = missingNumbers(unique);
      return {
        chapter,
        capturedFragments: unique.length,
        highestReaderNumber: unique.at(-1),
        readers: unique.join(", "),
        internalGaps: missing.length ? missing.join(", ") : "none"
      };
    });

  console.log("\nCapture manifest validation\n");
  console.table(rows);

  const unclassified = manifest.captures.length - classified.length;
  console.log(`Total captures: ${manifest.captures.length}`);
  console.log(`Classified chapter fragments: ${classified.length}`);
  console.log(`Unclassified fragments: ${unclassified}`);

  console.log(
    "\nNote: 'no internal gaps' only means 1..highest captured reader number is continuous. " +
    "It does not prove the chapter is complete until we compare against navigation/TOC metadata."
  );
} catch (error) {
  if (error.code === "ENOENT") {
    console.error("\nNo capture manifest exists yet. Run npm run capture first.\n");
  } else {
    console.error(`\nVALIDATION FAILED\n${error.message}\n`);
  }
  process.exitCode = 1;
}
