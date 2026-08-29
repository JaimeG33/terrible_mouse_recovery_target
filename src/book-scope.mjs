import fs from "node:fs/promises";
import path from "node:path";
import { CAPTURE_ROOT, MANIFEST_PATH } from "./config.mjs";

export const BOOK_SCOPE_PATH = path.join(CAPTURE_ROOT, "book-scope.json");

export function extractBookRoot(baseHref) {
  try {
    const url = new URL(baseHref);
    const opsIndex = url.pathname.indexOf("/OPS/");

    if (opsIndex >= 0) {
      return `${url.origin}${url.pathname.slice(0, opsIndex + 5)}`;
    }

    const chapterMatch = url.pathname.match(/^(.*\/)chapter\d+\/reader_\d+\.xhtml$/i);
    if (chapterMatch) {
      return `${url.origin}${chapterMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function readBookScope() {
  return readJsonIfPresent(BOOK_SCOPE_PATH);
}

async function inferExistingBookRoot() {
  const manifest = await readJsonIfPresent(MANIFEST_PATH);
  const firstHref = manifest?.captures?.find((entry) => entry.baseHref)?.baseHref;
  return firstHref ? extractBookRoot(firstHref) : null;
}

export async function ensureBookScope(snapshot) {
  const currentRoot = extractBookRoot(snapshot.baseHref);

  if (!currentRoot) {
    throw new Error(
      "Could not determine the current book root from the rendered reader URL. " +
      "Open a normal chapter reader fragment and retry."
    );
  }

  let scope = await readBookScope();

  if (!scope) {
    const inferredRoot = await inferExistingBookRoot();
    const lockedRoot = inferredRoot || currentRoot;

    if (lockedRoot !== currentRoot) {
      throw new Error(
        [
          "BOOK SCOPE MISMATCH",
          `Existing captures belong to: ${lockedRoot}`,
          `Current reader belongs to:  ${currentRoot}`,
          "Use a separate project copy/workspace for a different book, or archive the ignored runtime folders before starting a new book."
        ].join("\n")
      );
    }

    scope = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      bookRoot: lockedRoot,
      firstObservedBaseHref: snapshot.baseHref,
      firstObservedTitle: snapshot.title || null
    };

    await fs.mkdir(CAPTURE_ROOT, { recursive: true });
    await fs.writeFile(
      BOOK_SCOPE_PATH,
      `${JSON.stringify(scope, null, 2)}\n`,
      "utf8"
    );
  }

  if (scope.bookRoot !== currentRoot) {
    throw new Error(
      [
        "BOOK SCOPE MISMATCH",
        `Workspace book: ${scope.bookRoot}`,
        `Current reader: ${currentRoot}`,
        "This guard prevents captures from two different books from being mixed together."
      ].join("\n")
    );
  }

  return scope;
}
