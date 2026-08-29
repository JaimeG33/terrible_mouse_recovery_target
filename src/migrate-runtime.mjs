import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const booksRoot = path.join(projectRoot, "books");
const indexPath = path.join(booksRoot, "index.json");
const activePath = path.join(booksRoot, "active.json");

const legacyDirs = [
  "captures",
  "assets",
  "structure",
  "staging",
  "output"
];

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
    if (sn) return sn.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  } catch {
    // Fall back below.
  }

  return `book-${shortHash(bookRoot || "legacy")}`;
}

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

async function moveDirectory(source, destination) {
  if (!(await exists(source))) return false;

  await fs.mkdir(path.dirname(destination), { recursive: true });

  if (await exists(destination)) {
    throw new Error(
      `Migration destination already exists: ${destination}. ` +
      `No files were overwritten.`
    );
  }

  await fs.rename(source, destination);
  return true;
}

try {
  await fs.mkdir(booksRoot, { recursive: true });

  const active = await readJsonIfPresent(activePath);
  if (active?.bookId) {
    console.log(`Multi-book runtime already initialized: ${active.bookId}`);
    process.exit(0);
  }

  const hasLegacyRuntime = (
    await Promise.all(
      legacyDirs.map((name) => exists(path.join(projectRoot, name)))
    )
  ).some(Boolean);

  if (!hasLegacyRuntime) {
    console.log("No legacy runtime data found. Multi-book registry will initialize on first record.");
    process.exit(0);
  }

  const legacyScope = await readJsonIfPresent(
    path.join(projectRoot, "captures", "book-scope.json")
  );

  const bookRoot = legacyScope?.bookRoot || `legacy://${shortHash(projectRoot)}`;
  const bookId = deriveBookId(bookRoot);
  const destinationRoot = path.join(booksRoot, bookId);

  await fs.mkdir(destinationRoot, { recursive: true });

  for (const dirName of legacyDirs) {
    const source = path.join(projectRoot, dirName);
    const destination = path.join(destinationRoot, dirName);

    if (await moveDirectory(source, destination)) {
      console.log(`Moved ${dirName}/ -> books/${bookId}/${dirName}/`);
    }
  }

  const index = (await readJsonIfPresent(indexPath)) || {
    schemaVersion: 1,
    books: []
  };

  let record = index.books.find((book) => book.bookId === bookId);

  if (!record) {
    record = {
      bookId,
      title:
        legacyScope?.firstObservedTitle ||
        `Imported McGraw Hill Book (${bookId})`,
      bookRoot,
      createdAt: legacyScope?.createdAt || new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };
    index.books.push(record);
  }

  index.updatedAt = new Date().toISOString();

  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await fs.writeFile(
    activePath,
    `${JSON.stringify({ bookId, selectedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Legacy runtime migrated to local book: ${bookId}`);
} catch (error) {
  console.error(`\nMULTI-BOOK MIGRATION FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
