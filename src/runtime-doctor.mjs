import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVE_BOOK_PATH,
  BOOK_INDEX_PATH,
  BOOKS_ROOT,
  PROJECT_ROOT
} from "./config.mjs";

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

try {
  const active = await readJsonIfPresent(
    ACTIVE_BOOK_PATH
  );

  const index = await readJsonIfPresent(
    BOOK_INDEX_PATH
  );

  console.log("\nRuntime doctor\n");

  if (!active?.bookId) {
    console.error(
      "FAIL: books/active.json does not select a book."
    );
    console.error(
      "Run `npm run runtime:migrate`, or open a book and run `npm run book:use-current`."
    );
    process.exit(2);
  }

  const record = index?.books?.find(
    (book) => book.bookId === active.bookId
  );

  const runtimeRoot = path.join(
    BOOKS_ROOT,
    active.bookId
  );

  const manifestPath = path.join(
    runtimeRoot,
    "captures",
    "manifest.json"
  );

  const scopePath = path.join(
    runtimeRoot,
    "captures",
    "book-scope.json"
  );

  const manifest = await readJsonIfPresent(
    manifestPath
  );

  const scope = await readJsonIfPresent(scopePath);

  console.log(`Active book: ${active.bookId}`);
  console.log(
    `Title: ${record?.title || scope?.firstObservedTitle || "(unknown)"}`
  );
  console.log(
    `Book root: ${record?.bookRoot || scope?.bookRoot || "(unknown)"}`
  );
  console.log(`Runtime root: ${runtimeRoot}`);
  console.log(
    `Capture manifest: ${manifest ? "present" : "missing"}`
  );

  if (manifest) {
    console.log(
      `Capture entries: ${(manifest.captures || []).length}`
    );
  }

  const legacyNames = [
    "captures",
    "assets",
    "structure",
    "staging",
    "output"
  ];

  const legacyLeftovers = [];

  for (const name of legacyNames) {
    if (
      await exists(path.join(PROJECT_ROOT, name))
    ) {
      legacyLeftovers.push(name);
    }
  }

  if (legacyLeftovers.length) {
    console.log("");
    console.log(
      `Legacy root folders still present: ${legacyLeftovers.join(", ")}`
    );
    console.log(
      "This is not automatically a failure. Windows may keep derived output files open."
    );
    console.log(
      "Current commands use the active books/<bookId>/ runtime, not these legacy locations."
    );
  }

  if (!manifest) {
    console.error("");
    console.error(
      "FAIL: the active book has no capture manifest."
    );
    process.exitCode = 2;
  } else {
    console.log("");
    console.log(
      "PASS: active multi-book runtime resolves to a valid capture manifest."
    );
  }
} catch (error) {
  console.error(
    `\nRUNTIME DOCTOR FAILED\n${error.message}\n`
  );
  process.exitCode = 1;
}
