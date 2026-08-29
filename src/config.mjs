import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(here, "..");
export const BOOKS_ROOT = path.join(PROJECT_ROOT, "books");
export const BOOK_INDEX_PATH = path.join(BOOKS_ROOT, "index.json");
export const ACTIVE_BOOK_PATH = path.join(BOOKS_ROOT, "active.json");

function readActiveBookId() {
  if (process.env.MHE_BOOK_ID) {
    return process.env.MHE_BOOK_ID;
  }

  try {
    const active = JSON.parse(fs.readFileSync(ACTIVE_BOOK_PATH, "utf8"));
    return active.bookId || null;
  } catch {
    return null;
  }
}

export const ACTIVE_BOOK_ID = readActiveBookId();

export const RUNTIME_ROOT = ACTIVE_BOOK_ID
  ? path.join(BOOKS_ROOT, ACTIVE_BOOK_ID)
  : path.join(BOOKS_ROOT, "_unselected");

export const CAPTURE_ROOT = path.join(RUNTIME_ROOT, "captures");
export const MANIFEST_PATH = path.join(CAPTURE_ROOT, "manifest.json");
export const STRUCTURE_ROOT = path.join(RUNTIME_ROOT, "structure");
export const ASSET_ROOT = path.join(RUNTIME_ROOT, "assets");
export const STAGING_ROOT = path.join(RUNTIME_ROOT, "staging");
export const OUTPUT_ROOT = path.join(RUNTIME_ROOT, "output");
export const BACKUP_ROOT = path.join(RUNTIME_ROOT, "backups");

export const CDP_URL =
  process.env.MHE_CDP_URL || "http://127.0.0.1:9222";

export const POLL_MS = Number.parseInt(
  process.env.MHE_POLL_MS || "1000",
  10
);

export const READER_URL_HINTS = [
  "prod.reader-ui.prod.mheducation.com/epub/",
  "reader-ui.prod.mheducation.com/epub/"
];
