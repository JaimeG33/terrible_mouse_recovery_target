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

export async function getReaderSnapshot(page) {
  const iframeHandle = await page.$("#clo-iframe");
  if (!iframeHandle) {
    throw new Error("The reader page is open, but iframe#clo-iframe is not currently present.");
  }

  const frame = await iframeHandle.contentFrame();
  if (!frame) {
    throw new Error("iframe#clo-iframe exists, but its document is not available yet.");
  }

  const snapshot = await frame.evaluate(() => {
    const baseHref = document.querySelector("base")?.href || "";
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
    outerPageUrl: page.url(),
    capturedAt: new Date().toISOString()
  };
}

export function parseReaderLocation(baseHref) {
  const match = baseHref.match(/\/chapter(\d+)\/reader_(\d+)\.xhtml(?:[#?].*)?$/i);
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

function fallbackName(snapshot) {
  const digest = sha256(snapshot.html).slice(0, 12);
  return path.join("unclassified", `fragment_${digest}.xhtml`);
}

function relativeCapturePath(snapshot) {
  const location = parseReaderLocation(snapshot.baseHref);
  if (!location) {
    return fallbackName(snapshot);
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
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        captures: []
      };
    }
    throw error;
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(CAPTURE_ROOT, { recursive: true });
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function saveSnapshot(snapshot) {
  if (!snapshot.html.trim()) {
    return { saved: false, reason: "empty-html" };
  }

  const manifest = await readManifest();
  const digest = sha256(snapshot.html);
  const relPath = relativeCapturePath(snapshot);
  const location = parseReaderLocation(snapshot.baseHref);

  const duplicate = manifest.captures.find((entry) => {
    if (snapshot.baseHref && entry.baseHref === snapshot.baseHref) {
      return true;
    }
    return entry.sha256 === digest;
  });

  if (duplicate) {
    return { saved: false, reason: "duplicate", entry: duplicate };
  }

  const absPath = path.join(CAPTURE_ROOT, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });

  const sourceComment = [
    "<!--",
    "Captured from an already-rendered McGraw Hill reader iframe.",
    `Captured: ${snapshot.capturedAt}`,
    `Base: ${snapshot.baseHref}`,
    "Manual navigation only; this file was not retrieved by URL crawling.",
    "-->"
  ].join("\n");

  await fs.writeFile(absPath, `${sourceComment}\n${snapshot.html}\n`, "utf8");

  const entry = {
    chapterNumber: location?.chapterNumber ?? null,
    readerNumber: location?.readerNumber ?? null,
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
    return (a.readerNumber ?? 9999) - (b.readerNumber ?? 9999);
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
