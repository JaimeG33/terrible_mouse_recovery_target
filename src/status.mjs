import fs from "node:fs/promises";
import path from "node:path";
import { CAPTURE_ROOT, MANIFEST_PATH, PROJECT_ROOT } from "./config.mjs";
import { readBookScope } from "./book-scope.mjs";

const TOC_PATH = path.join(PROJECT_ROOT, "structure", "toc.json");

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function sortedNumbers(values) {
  return [...new Set(values)].sort((a, b) => a - b);
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

  const chapters = new Map();

  function ensureChapter(chapterNumber) {
    if (!chapters.has(chapterNumber)) {
      chapters.set(chapterNumber, {
        chapterNumber,
        title: null,
        readers: [],
        fragments: 0,
        pageMarkers: 0
      });
    }

    return chapters.get(chapterNumber);
  }

  for (const node of toc?.nodes || []) {
    if (node.level !== 0) continue;
    const match = String(node.label || "").match(/\bChapter\s+(\d+)\b/i);
    if (!match) continue;

    const chapter = ensureChapter(Number.parseInt(match[1], 10));
    chapter.title = node.label;
  }

  for (const entry of manifest.captures) {
    if (!Number.isInteger(entry.chapterNumber)) continue;

    const chapter = ensureChapter(entry.chapterNumber);
    chapter.fragments += 1;
    chapter.pageMarkers += (entry.pageBreaks || []).length;

    if (Number.isInteger(entry.readerNumber)) {
      chapter.readers.push(entry.readerNumber);
    }
  }

  console.log("\nCapture status\n");

  if (bookScope?.bookRoot) {
    console.log(`Book scope: ${bookScope.bookRoot}`);
  }

  if (process.env.MHE_CHAPTER) {
    console.log(`Active MHE_CHAPTER: ${process.env.MHE_CHAPTER}`);
  }

  console.log("");

  console.table(
    [...chapters.values()]
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((chapter) => ({
        chapter: chapter.chapterNumber,
        title: chapter.title || "",
        capturedReaders: sortedNumbers(chapter.readers).join(", ") || "(none)",
        fragments: chapter.fragments,
        pageMarkers: chapter.pageMarkers
      }))
  );

  console.log(
    "\nStatus reports what has been observed and saved. It does not prove that an entire chapter has been manually traversed."
  );
  console.log(
    "Use `npm run structure` after capture sessions for linked-reader and TOC/spine diagnostics.\n"
  );
} catch (error) {
  console.error(`\nSTATUS FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
