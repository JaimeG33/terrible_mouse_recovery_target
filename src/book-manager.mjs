import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVE_BOOK_PATH,
  BOOK_INDEX_PATH,
  BOOKS_ROOT
} from "./config.mjs";
import { extractBookRoot } from "./book-scope.mjs";
import {
  connectToChrome,
  findReaderPage,
  getReaderSnapshot
} from "./reader.mjs";

const command = process.argv[2] || "list";

function shortHash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""), "utf8")
    .digest("hex")
    .slice(0, 8);
}

function deriveBookId(bookRoot) {
  try {
    const url = new URL(bookRoot);
    const sn = url.pathname.match(/\/publish\/([^/]+)\//i)?.[1];

    if (sn) {
      return sn
        .replace(/[^a-z0-9_-]+/gi, "-")
        .toLowerCase();
    }
  } catch {
    // Fall back below.
  }

  return `book-${shortHash(bookRoot)}`;
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeIndex(index) {
  await fs.mkdir(BOOKS_ROOT, { recursive: true });

  index.schemaVersion = 1;
  index.updatedAt = new Date().toISOString();
  index.books = [...(index.books || [])].sort((a, b) =>
    String(a.title || a.bookId).localeCompare(
      String(b.title || b.bookId)
    )
  );

  await fs.writeFile(
    BOOK_INDEX_PATH,
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8"
  );
}

async function selectCurrentBook() {
  const browser = await connectToChrome();
  const page = await findReaderPage(browser);
  const snapshot = await getReaderSnapshot(page);
  const bookRoot = extractBookRoot(snapshot.baseHref);

  if (!bookRoot) {
    throw new Error(
      "Could not identify the current McGraw Hill EPUB book. Open a normal chapter page and retry."
    );
  }

  const bookId = deriveBookId(bookRoot);
  const pageTitle = await page.title().catch(() => "");
  const title =
    snapshot.title ||
    pageTitle ||
    `McGraw Hill Book (${bookId})`;

  const index = (await readJsonIfPresent(BOOK_INDEX_PATH)) || {
    schemaVersion: 1,
    books: []
  };

  let record = index.books.find(
    (book) => book.bookRoot === bookRoot
  );

  if (!record) {
    record = {
      bookId,
      title,
      bookRoot,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };
    index.books.push(record);
  } else {
    record.lastUsedAt = new Date().toISOString();
    if (!record.title && title) {
      record.title = title;
    }
  }

  const runtimeRoot = path.join(
    BOOKS_ROOT,
    record.bookId
  );

  const captureRoot = path.join(
    runtimeRoot,
    "captures"
  );

  const scopePath = path.join(
    captureRoot,
    "book-scope.json"
  );

  await fs.mkdir(captureRoot, {
    recursive: true
  });

  const existingScope =
    await readJsonIfPresent(scopePath);

  if (!existingScope) {
    await fs.writeFile(
      scopePath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          bookRoot,
          firstObservedBaseHref: snapshot.baseHref,
          firstObservedTitle: title
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } else if (existingScope.bookRoot !== bookRoot) {
    throw new Error(
      `Book registry collision: ${record.bookId} is already associated with another book root.`
    );
  }

  await writeIndex(index);

  await fs.writeFile(
    ACTIVE_BOOK_PATH,
    `${JSON.stringify(
      {
        bookId: record.bookId,
        selectedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log("\nActive book selected\n");
  console.log(`Book ID: ${record.bookId}`);
  console.log(`Title:   ${record.title}`);
  console.log(`Root:    ${record.bookRoot}\n`);

  // Do NOT call browser.close(). This Browser object is attached over CDP to
  // the user's already-running dedicated Chrome instance, and close() would
  // terminate that Chrome session.
  //
  // The older standalone capture/asset tools worked because they explicitly
  // terminated their Node process after finishing. This command also needs to
  // drop its CDP websocket so a parent PowerShell wrapper can continue.
  return record;
}

async function listBooks() {
  const index =
    await readJsonIfPresent(BOOK_INDEX_PATH);

  const active =
    await readJsonIfPresent(ACTIVE_BOOK_PATH);

  if (!index?.books?.length) {
    console.log(
      "\nNo local books have been registered yet."
    );
    console.log(
      "Open a McGraw Hill book and run a chapter `record` action.\n"
    );
    return;
  }

  console.log("\nLocal book registry\n");

  console.table(
    index.books.map((book) => ({
      active:
        book.bookId === active?.bookId
          ? "*"
          : "",
      bookId: book.bookId,
      title: book.title,
      lastUsedAt: book.lastUsedAt || ""
    }))
  );

  console.log(
    "\nRuntime data is isolated under books/<bookId>/, so Chapter 1 from different books cannot collide.\n"
  );
}

try {
  if (command === "use-current") {
    await selectCurrentBook();
  } else if (command === "list") {
    await listBooks();
  } else {
    throw new Error(
      `Unknown book-manager command: ${command}`
    );
  }
} catch (error) {
  console.error(
    `\nBOOK MANAGER FAILED\n${error.message}\n`
  );
  process.exitCode = 1;
} finally {
  if (command === "use-current") {
    // connectOverCDP keeps a live websocket in the Node event loop.
    // `process.exitCode` alone would wait forever for that socket. The old
    // standalone capture tools explicitly called process.exit() after their
    // work completed, which is why they reliably returned control to PowerShell.
    //
    // All book registry/scope writes above are awaited before reaching here.
    // Exiting this Node process drops only its CDP client connection; it does
    // not close the dedicated Chrome process.
    const code = process.exitCode || 0;
    await new Promise((resolve) =>
      setTimeout(resolve, 25)
    );
    process.exit(code);
  }
}
