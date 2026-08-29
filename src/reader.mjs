import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  CAPTURE_ROOT,
  CDP_URL,
  MANIFEST_PATH,
  READER_URL_HINTS
} from "./config.mjs";

export async function connectToChrome() {
  try {
    return await chromium.connectOverCDP(CDP_URL);
  } catch (error) {
    throw new Error(
      [
        `Could not connect to Chrome at ${CDP_URL}.`,
        "Start Chrome with scripts\\start-chrome.ps1 first.",
        `Original error: ${error.message}`
      ].join("\n")
    );
  }
}

export async function findReaderPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());

  for (const page of pages) {
    if (READER_URL_HINTS.some((hint) => page.url().includes(hint))) {
      return page;
    }
  }

  for (const page of pages) {
    try {
      if (await page.$("#clo-iframe")) {
        return page;
      }
    } catch {
      // Page may be in the middle of navigating.
    }
  }

  const available = pages.map((page, index) => `  ${index + 1}. ${page.url()}`).join("\n");
  throw new Error(
    [
      "No open McGraw Hill reader page with #clo-iframe was found.",
      "Open the book in the dedicated Chrome window, then retry.",
      available ? `Open pages:\n${available}` : "No pages were visible over CDP."
    ].join("\n")
  );
}

async function snapshotFrame(frame, outerPageUrl) {
  const snapshot = await frame.evaluate(() => {
    const baseHref =
      document.querySelector("base")?.href ||
      document.baseURI ||
      location.href ||
      "";

    const title = document.title || "";
    const html = document.documentElement?.outerHTML || "";
    const textLength = document.body?.innerText?.length || 0;

    const pageBreaks = [...document.querySelectorAll('[role="doc-pagebreak"]')]
      .map((element) => ({
        id: element.id || "",
        page: element.getAttribute("aria-label") || "",
        text: (element.textContent || "").trim()
      }));

    const readerLinks = [...document.querySelectorAll("[data-href-url]")]
      .map((element) => element.getAttribute("data-href-url") || "")
      .filter((href) => /\/reader_\d+\.xhtml(?:#|$)/i.test(href));

    return {
      baseHref,
      title,
      html,
      textLength,
      pageBreaks,
      readerLinks: [...new Set(readerLinks)]
    };
  });

  return {
    ...snapshot,
    outerPageUrl,
    capturedAt: new Date().toISOString()
  };
}

export async function getReaderSnapshotFromFrame(frame, outerPageUrl = "") {
  return snapshotFrame(frame, outerPageUrl || frame.page().url());
}

export async function getReaderSnapshot(page) {
  const iframeHandle = await page.$("#clo-iframe");
  if (!iframeHandle) {
    throw new Error("The reader page is open, but iframe#clo-iframe is not currently present.");
  }

  const frame = await iframeHandle.contentFrame();
  if (!frame) {
    throw new Error("iframe#clo-iframe exists, but its document is not available yet.");
  }

  return getReaderSnapshotFromFrame(frame, page.url());
}

export function parseReaderLocation(baseHref) {
  const match = String(baseHref || "").match(
    /\/chapter(\d+)\/reader_(\d+)\.xhtml(?:[#?].*)?$/i
  );

  if (!match) {
    return null;
  }

  return {
    chapterNumber: Number.parseInt(match[1], 10),
    readerNumber: Number.parseInt(match[2], 10)
  };
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function fallbackName(snapshot, chapterNumberOverride = null) {
  const digest = sha256(snapshot.html).slice(0, 12);

  if (Number.isInteger(chapterNumberOverride)) {
    return path.join(
      `chapter${pad2(chapterNumberOverride)}`,
      `aux_${digest}.xhtml`
    );
  }

  return path.join("unclassified", `fragment_${digest}.xhtml`);
}

function relativeCapturePath(snapshot, chapterNumberOverride = null) {
  const location = parseReaderLocation(snapshot.baseHref);
  if (!location) {
    return fallbackName(snapshot, chapterNumberOverride);
  }

  return path.join(
    `chapter${pad2(location.chapterNumber)}`,
    `reader_${pad2(location.readerNumber)}.xhtml`
  );
}

async function readManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        captures: []
      };
    }
    throw error;
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(CAPTURE_ROOT, { recursive: true });
  manifest.schemaVersion = Math.max(manifest.schemaVersion || 1, 2);
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function saveSnapshot(snapshot, options = {}) {
  if (!snapshot.html.trim()) {
    return { saved: false, reason: "empty-html" };
  }

  const manifest = await readManifest();
  const digest = sha256(snapshot.html);
  const location = parseReaderLocation(snapshot.baseHref);
  const chapterNumberOverride = Number.isInteger(options.chapterNumberOverride)
    ? options.chapterNumberOverride
    : null;

  const effectiveChapterNumber =
    location?.chapterNumber ??
    chapterNumberOverride ??
    null;

  const relPath = relativeCapturePath(snapshot, chapterNumberOverride);

  const duplicate = manifest.captures.find((entry) => {
    if (snapshot.baseHref && entry.baseHref === snapshot.baseHref) {
      return true;
    }
    return entry.sha256 === digest;
  });

  if (duplicate) {
    let changed = false;

    if (
      !Number.isInteger(duplicate.chapterNumber) &&
      Number.isInteger(effectiveChapterNumber)
    ) {
      duplicate.chapterNumber = effectiveChapterNumber;
      duplicate.scopedAuxiliary = !location;
      changed = true;
    }

    if (!location && Number.isInteger(chapterNumberOverride)) {
      if (duplicate.afterReaderNumber !== (options.afterReaderNumber ?? null)) {
        duplicate.afterReaderNumber = options.afterReaderNumber ?? null;
        changed = true;
      }

      if (duplicate.auxOrderWithinGap !== (options.auxOrderWithinGap ?? null)) {
        duplicate.auxOrderWithinGap = options.auxOrderWithinGap ?? null;
        changed = true;
      }

      if (duplicate.scopedAuxiliary !== true) {
        duplicate.scopedAuxiliary = true;
        changed = true;
      }
    }

    if (changed) {
      duplicate.updatedAt = new Date().toISOString();
      await writeManifest(manifest);
    }

    return {
      saved: false,
      reason: "duplicate",
      updated: changed,
      entry: duplicate
    };
  }

  const absPath = path.join(CAPTURE_ROOT, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const sourceComment = [
    "<!--",
    "Captured from an already-rendered McGraw Hill reader iframe.",
    `Captured: ${snapshot.capturedAt}`,
    `Base: ${snapshot.baseHref}`,
    Number.isInteger(chapterNumberOverride) && !location
      ? `Manual chapter scope: ${chapterNumberOverride} (auxiliary/non-reader fragment)`
      : null,
    "Manual navigation only; this file was not retrieved by URL crawling.",
    "-->"
  ]
    .filter(Boolean)
    .join("\n");

  await fs.writeFile(absPath, `${sourceComment}\n${snapshot.html}\n`, "utf8");

  const entry = {
    chapterNumber: effectiveChapterNumber,
    readerNumber: location?.readerNumber ?? null,
    scopedAuxiliary: !location && Number.isInteger(chapterNumberOverride),
    afterReaderNumber:
      !location && Number.isInteger(chapterNumberOverride)
        ? options.afterReaderNumber ?? null
        : null,
    auxOrderWithinGap:
      !location && Number.isInteger(chapterNumberOverride)
        ? options.auxOrderWithinGap ?? null
        : null,
    baseHref: snapshot.baseHref,
    title: snapshot.title,
    outerPageUrl: snapshot.outerPageUrl,
    capturedAt: snapshot.capturedAt,
    savedAs: relPath.replaceAll("\\", "/"),
    sha256: digest,
    htmlLength: snapshot.html.length,
    textLength: snapshot.textLength,
    pageBreaks: snapshot.pageBreaks,
    readerLinks: snapshot.readerLinks
  };

  manifest.captures.push(entry);

  manifest.captures.sort((a, b) => {
    const ca = a.chapterNumber ?? 9999;
    const cb = b.chapterNumber ?? 9999;
    if (ca !== cb) return ca - cb;

    const ra = a.readerNumber ?? 9999;
    const rb = b.readerNumber ?? 9999;
    if (ra !== rb) return ra - rb;

    return String(a.capturedAt || "").localeCompare(String(b.capturedAt || ""));
  });

  await writeManifest(manifest);
  return { saved: true, entry, absolutePath: absPath };
}

export function describeSnapshot(snapshot) {
  const location = parseReaderLocation(snapshot.baseHref);
  const pageNumbers = snapshot.pageBreaks
    .map((item) => item.page)
    .filter(Boolean);

  return {
    outerPageUrl: snapshot.outerPageUrl,
    baseHref: snapshot.baseHref || "(none)",
    title: snapshot.title || "(untitled)",
    chapter: location?.chapterNumber ?? "(unclassified)",
    readerFragment: location?.readerNumber ?? "(unclassified)",
    htmlLength: snapshot.html.length,
    textLength: snapshot.textLength,
    pageBreakCount: snapshot.pageBreaks.length,
    pageNumbers: pageNumbers.length ? pageNumbers.join(", ") : "(none found)",
    linkedReaderFragments: snapshot.readerLinks.length
  };
}
