import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(here, "..");
export const CAPTURE_ROOT = path.join(PROJECT_ROOT, "captures");
export const MANIFEST_PATH = path.join(CAPTURE_ROOT, "manifest.json");

export const CDP_URL = process.env.MHE_CDP_URL || "http://127.0.0.1:9222";
export const POLL_MS = Number.parseInt(process.env.MHE_POLL_MS || "1000", 10);

export const READER_URL_HINTS = [
  "prod.reader-ui.prod.mheducation.com/epub/",
  "reader-ui.prod.mheducation.com/epub/"
];
