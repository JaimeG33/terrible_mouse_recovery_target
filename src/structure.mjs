import fs from "node:fs/promises";
import path from "node:path";
import { MANIFEST_PATH, PROJECT_ROOT } from "./config.mjs";

const STRUCTURE_ROOT = path.join(PROJECT_ROOT, "structure");
const TOC_PATH = path.join(STRUCTURE_ROOT, "toc.json");
const REPORT_PATH = path.join(STRUCTURE_ROOT, "discovery-report.json");

function parseReaderLocation(url) {
  const match = String(url || "").match(
    /\/chapter(\d+)\/reader_(\d+)\.xhtml(?:[#?].*)?$/i
  );

  if (!match) return null;

  return {
    chapterNumber: Number.parseInt(match[1], 10),
    readerNumber: Number.parseInt(match[2], 10)
  };
}

function sortedNumbers(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function rangesFromToc(toc) {
  const chapters = toc.nodes
    .filter((node) => node.level === 0)
    .map((node) => {
      const match = node.label.match(/\bChapter\s+(\d+)\b/i);
      if (!match) return null;

      return {
        chapterNumber: Number.parseInt(match[1], 10),
        label: node.label,
        startSpinePosition: node.spinePosition,
        nodeId: node.nodeId,
        hash: node.hash
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  return chapters.map((chapter, index) => {
    const next = chapters[index + 1];

    return {
      ...chapter,
      nextChapterStartSpinePosition: next?.startSpinePosition ?? null,
      inferredSpineEnd:
        next && Number.isInteger(next.startSpinePosition)
          ? next.startSpinePosition - 1
          : null
    };
  });
}

async function readJson(filePath, description) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${description} not found at ${filePath}`);
    }
    throw error;
  }
}

try {
  const manifest = await readJson(
    MANIFEST_PATH,
    "Capture manifest. Run npm run capture first"
  );

  const toc = await readJson(
    TOC_PATH,
    "TOC snapshot. Run npm run toc first"
  );

  const chapterMap = new Map();

  function getChapter(chapterNumber) {
    if (!chapterMap.has(chapterNumber)) {
      chapterMap.set(chapterNumber, {
        chapterNumber,
        captured: new Set(),
        discovered: new Set(),
        capturedEntries: []
      });
    }
    return chapterMap.get(chapterNumber);
  }

  for (const entry of manifest.captures) {
    if (!Number.isInteger(entry.chapterNumber)) continue;

    const chapter = getChapter(entry.chapterNumber);

    if (Number.isInteger(entry.readerNumber)) {
      chapter.captured.add(entry.readerNumber);
      chapter.discovered.add(entry.readerNumber);
    }

    chapter.capturedEntries.push({
      readerNumber: entry.readerNumber,
      baseHref: entry.baseHref,
      title: entry.title,
      pageBreaks: entry.pageBreaks
    });

    for (const href of entry.readerLinks || []) {
      const location = parseReaderLocation(href);
      if (!location) continue;

      const linkedChapter = getChapter(location.chapterNumber);
      linkedChapter.discovered.add(location.readerNumber);
    }
  }

  const tocChapterRanges = rangesFromToc(toc);
  const tocChapterByNumber = new Map(
    tocChapterRanges.map((chapter) => [chapter.chapterNumber, chapter])
  );

  const allChapterNumbers = sortedNumbers([
    ...chapterMap.keys(),
    ...tocChapterByNumber.keys()
  ]);

  const chapterDiscovery = allChapterNumbers.map((chapterNumber) => {
    const observed = chapterMap.get(chapterNumber) || {
      captured: new Set(),
      discovered: new Set(),
      capturedEntries: []
    };

    const captured = sortedNumbers(observed.captured);
    const discovered = sortedNumbers(observed.discovered);
    const missingKnown = discovered.filter((reader) => !observed.captured.has(reader));
    const tocInfo = tocChapterByNumber.get(chapterNumber) || null;

    return {
      chapterNumber,
      title: tocInfo?.label ?? null,
      tocStartSpinePosition: tocInfo?.startSpinePosition ?? null,
      tocInferredSpineEnd: tocInfo?.inferredSpineEnd ?? null,
      capturedReaders: captured,
      discoveredReaders: discovered,
      missingReadersAlreadyReferencedByCapturedXhtml: missingKnown,
      highestDiscoveredReader: discovered.at(-1) ?? null,
      capturedEntries: observed.capturedEntries
    };
  });

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tocNodeCount: toc.nodeCount,
    tocTopLevelCount: toc.topLevelCount,
    tocChapterCount: tocChapterRanges.length,
    tocChapterRanges,
    chapterDiscovery,
    interpretation: [
      "capturedReaders are XHTML fragments already saved locally.",
      "discoveredReaders are reader_N.xhtml numbers referenced by XHTML that was already rendered and captured.",
      "missingReadersAlreadyReferencedByCapturedXhtml are known links that have not yet been captured.",
      "The absence of missing known readers does not prove a chapter is complete.",
      "TOC spine positions describe reader navigation structure and are kept separate from reader_N.xhtml numbering."
    ]
  };

  await fs.mkdir(STRUCTURE_ROOT, { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\nBook structure discovery report\n");
  console.log(`Saved: ${REPORT_PATH}`);
  console.log(`TOC chapters detected: ${tocChapterRanges.length}\n`);

  console.table(
    chapterDiscovery.map((chapter) => ({
      chapter: chapter.chapterNumber,
      tocStart: chapter.tocStartSpinePosition,
      captured: chapter.capturedReaders.join(", ") || "(none)",
      discovered: chapter.discoveredReaders.join(", ") || "(none)",
      missingKnown:
        chapter.missingReadersAlreadyReferencedByCapturedXhtml.join(", ") || "none"
    }))
  );

  console.log(
    "\nUse missingKnown as the next manual-navigation targets. " +
    "This report does not fetch or navigate to those fragments automatically."
  );
} catch (error) {
  console.error(`\nSTRUCTURE ANALYSIS FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
