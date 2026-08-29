export function parseReaderReference(value, baseHref = "") {
  try {
    const absolute = new URL(String(value || ""), baseHref || undefined).href;
    const match = absolute.match(
      /\/chapter(\d+)\/reader_(\d+)\.xhtml(?:[#?].*)?$/i
    );

    if (!match) return null;

    return {
      chapterNumber: Number.parseInt(match[1], 10),
      readerNumber: Number.parseInt(match[2], 10)
    };
  } catch {
    const match = String(value || "").match(
      /\/chapter(\d+)\/reader_(\d+)\.xhtml(?:[#?].*)?$/i
    );

    if (!match) return null;

    return {
      chapterNumber: Number.parseInt(match[1], 10),
      readerNumber: Number.parseInt(match[2], 10)
    };
  }
}

function numericGapList(readerNumbers) {
  if (!readerNumbers.length) return [];

  const set = new Set(readerNumbers);
  const max = Math.max(...readerNumbers);
  const missing = [];

  for (let reader = 1; reader <= max; reader += 1) {
    if (!set.has(reader)) missing.push(reader);
  }

  return missing;
}

export function analyzeChapterCaptures(captures, chapterNumber) {
  const chapterCaptures = (captures || []).filter(
    (entry) => entry.chapterNumber === chapterNumber
  );

  const readerNumbers = [
    ...new Set(
      chapterCaptures
        .map((entry) => entry.readerNumber)
        .filter(Number.isInteger)
    )
  ].sort((a, b) => a - b);

  const readerSet = new Set(readerNumbers);
  const referencedReaders = new Set();

  for (const entry of chapterCaptures) {
    for (const href of entry.readerLinks || []) {
      const location = parseReaderReference(href, entry.baseHref);
      if (location?.chapterNumber === chapterNumber) {
        referencedReaders.add(location.readerNumber);
      }
    }
  }

  const knownLinkedMissing = [...referencedReaders]
    .filter((reader) => !readerSet.has(reader))
    .sort((a, b) => a - b);

  return {
    captures: chapterCaptures,
    readerNumbers,
    numericGaps: numericGapList(readerNumbers),
    referencedReaders: [...referencedReaders].sort((a, b) => a - b),
    knownLinkedMissing,
    auxiliaryCount: chapterCaptures.filter(
      (entry) => !Number.isInteger(entry.readerNumber)
    ).length
  };
}

export function captureOrderKey(entry) {
  if (Number.isInteger(entry.readerNumber)) {
    return entry.readerNumber * 10000;
  }

  if (Number.isInteger(entry.afterReaderNumber)) {
    const ordinal = Number.isInteger(entry.auxOrderWithinGap)
      ? entry.auxOrderWithinGap
      : 1;

    return entry.afterReaderNumber * 10000 + 100 + ordinal;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function sortChapterCaptures(captures) {
  return [...captures].sort((a, b) => {
    const keyDiff = captureOrderKey(a) - captureOrderKey(b);
    if (keyDiff !== 0) return keyDiff;

    return String(a.capturedAt || "").localeCompare(String(b.capturedAt || ""));
  });
}
