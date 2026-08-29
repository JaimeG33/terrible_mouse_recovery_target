import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const booksRoot = path.join(projectRoot, "books");
const indexPath = path.join(booksRoot, "index.json");
const activePath = path.join(booksRoot, "active.json");
const reportPath = path.join(booksRoot, "migration-report.json");

const runtimeDirs = [
  { name: "captures", critical: true },
  { name: "assets", critical: true },
  { name: "structure", critical: false },
  { name: "staging", critical: false },
  { name: "output", critical: false }
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

    if (sn) {
      return sn
        .replace(/[^a-z0-9_-]+/gi, "-")
        .toLowerCase();
    }
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

async function isDirectory(filePath) {
  try {
    return (await fs.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function discoverExistingBookCandidates() {
  if (!(await exists(booksRoot))) return [];

  const entries = await fs.readdir(booksRoot, {
    withFileTypes: true
  });

  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "_unselected") continue;

    const runtimeRoot = path.join(booksRoot, entry.name);
    const scope = await readJsonIfPresent(
      path.join(runtimeRoot, "captures", "book-scope.json")
    );

    const manifest = await readJsonIfPresent(
      path.join(runtimeRoot, "captures", "manifest.json")
    );

    if (!scope && !manifest) continue;

    candidates.push({
      bookId: entry.name,
      runtimeRoot,
      scope,
      manifest
    });
  }

  return candidates;
}

function inferRootFromManifest(manifest) {
  const href = manifest?.captures?.find(
    (entry) => entry.baseHref
  )?.baseHref;

  if (!href) return null;

  try {
    const url = new URL(href);
    const opsIndex = url.pathname.indexOf("/OPS/");

    if (opsIndex >= 0) {
      return `${url.origin}${url.pathname.slice(
        0,
        opsIndex + 5
      )}`;
    }
  } catch {
    // No usable URL.
  }

  return null;
}

async function chooseTargetBook() {
  const active = await readJsonIfPresent(activePath);
  const index = await readJsonIfPresent(indexPath);
  const candidates = await discoverExistingBookCandidates();

  if (active?.bookId) {
    const activeCandidate = candidates.find(
      (candidate) => candidate.bookId === active.bookId
    );

    const activeIndexRecord = index?.books?.find(
      (book) => book.bookId === active.bookId
    );

    if (activeCandidate || activeIndexRecord) {
      return {
        bookId: active.bookId,
        bookRoot:
          activeCandidate?.scope?.bookRoot ||
          activeIndexRecord?.bookRoot ||
          inferRootFromManifest(activeCandidate?.manifest),
        title:
          activeCandidate?.scope?.firstObservedTitle ||
          activeIndexRecord?.title ||
          `McGraw Hill Book (${active.bookId})`,
        createdAt:
          activeCandidate?.scope?.createdAt ||
          activeIndexRecord?.createdAt ||
          new Date().toISOString(),
        source: "existing-active"
      };
    }
  }

  const legacyScope = await readJsonIfPresent(
    path.join(projectRoot, "captures", "book-scope.json")
  );

  const legacyManifest = await readJsonIfPresent(
    path.join(projectRoot, "captures", "manifest.json")
  );

  const legacyRoot =
    legacyScope?.bookRoot ||
    inferRootFromManifest(legacyManifest);

  if (legacyRoot) {
    const matchingCandidate = candidates.find(
      (candidate) =>
        candidate.scope?.bookRoot === legacyRoot ||
        inferRootFromManifest(candidate.manifest) === legacyRoot
    );

    return {
      bookId:
        matchingCandidate?.bookId ||
        deriveBookId(legacyRoot),
      bookRoot: legacyRoot,
      title:
        legacyScope?.firstObservedTitle ||
        matchingCandidate?.scope?.firstObservedTitle ||
        `Imported McGraw Hill Book (${deriveBookId(legacyRoot)})`,
      createdAt:
        legacyScope?.createdAt ||
        matchingCandidate?.scope?.createdAt ||
        new Date().toISOString(),
      source: matchingCandidate
        ? "legacy-plus-partial-destination"
        : "legacy-root"
    };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];
    const bookRoot =
      candidate.scope?.bookRoot ||
      inferRootFromManifest(candidate.manifest);

    return {
      bookId: candidate.bookId,
      bookRoot,
      title:
        candidate.scope?.firstObservedTitle ||
        `Imported McGraw Hill Book (${candidate.bookId})`,
      createdAt:
        candidate.scope?.createdAt ||
        new Date().toISOString(),
      source: "partial-destination"
    };
  }

  if (index?.books?.length === 1) {
    const only = index.books[0];

    return {
      bookId: only.bookId,
      bookRoot: only.bookRoot,
      title: only.title,
      createdAt:
        only.createdAt ||
        new Date().toISOString(),
      source: "single-index-record"
    };
  }

  if (candidates.length > 1) {
    throw new Error(
      [
        "Multiple partially migrated book directories exist and no active book is set.",
        `Candidates: ${candidates
          .map((candidate) => candidate.bookId)
          .join(", ")}`,
        "Run `npm run book:use-current` with the intended book open, then rerun `npm run runtime:migrate`."
      ].join("\n")
    );
  }

  return null;
}

async function ensureRegistry(target) {
  await fs.mkdir(booksRoot, { recursive: true });

  const index = (await readJsonIfPresent(indexPath)) || {
    schemaVersion: 1,
    books: []
  };

  let record = index.books.find(
    (book) => book.bookId === target.bookId
  );

  if (!record) {
    record = {
      bookId: target.bookId,
      title:
        target.title ||
        `McGraw Hill Book (${target.bookId})`,
      bookRoot: target.bookRoot || null,
      createdAt:
        target.createdAt ||
        new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };

    index.books.push(record);
  } else {
    if (!record.bookRoot && target.bookRoot) {
      record.bookRoot = target.bookRoot;
    }

    if (!record.title && target.title) {
      record.title = target.title;
    }

    record.lastUsedAt = new Date().toISOString();
  }

  index.schemaVersion = 1;
  index.updatedAt = new Date().toISOString();

  await fs.writeFile(
    indexPath,
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8"
  );

  // Write active.json BEFORE best-effort legacy cleanup. The first Step 5.2
  // migration failed after moving captures/assets/structure but before this file
  // was written, which made config resolve to books/_unselected.
  await fs.writeFile(
    activePath,
    `${JSON.stringify(
      {
        bookId: target.bookId,
        selectedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return record;
}

async function copyTreeMissingOnly(
  source,
  destination,
  summary,
  relative = ""
) {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    await fs.mkdir(destination, {
      recursive: true
    });

    const entries = await fs.readdir(source, {
      withFileTypes: true
    });

    for (const entry of entries) {
      const childRelative = relative
        ? path.join(relative, entry.name)
        : entry.name;

      await copyTreeMissingOnly(
        path.join(source, entry.name),
        path.join(destination, entry.name),
        summary,
        childRelative
      );
    }

    return;
  }

  if (await exists(destination)) {
    const destinationStat = await fs.stat(destination);

    if (
      destinationStat.isFile() &&
      destinationStat.size === stat.size
    ) {
      summary.alreadyPresent.push(relative);
      return;
    }

    summary.conflicts.push({
      file: relative,
      sourceBytes: stat.size,
      destinationBytes: destinationStat.size
    });

    return;
  }

  await fs.mkdir(path.dirname(destination), {
    recursive: true
  });

  await fs.copyFile(source, destination);
  summary.copied.push(relative);
}

async function mergeLegacyDirectory(
  dirInfo,
  destinationRoot
) {
  const source = path.join(
    projectRoot,
    dirInfo.name
  );

  const destination = path.join(
    destinationRoot,
    dirInfo.name
  );

  const summary = {
    name: dirInfo.name,
    critical: dirInfo.critical,
    sourceExisted: await exists(source),
    copied: [],
    alreadyPresent: [],
    conflicts: [],
    copyErrors: [],
    cleanup: "not-needed"
  };

  if (!summary.sourceExisted) {
    return summary;
  }

  try {
    await copyTreeMissingOnly(
      source,
      destination,
      summary
    );
  } catch (error) {
    summary.copyErrors.push({
      message: error.message,
      code: error.code || null
    });
  }

  if (
    !summary.copyErrors.length &&
    !summary.conflicts.length
  ) {
    try {
      await fs.rm(source, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 250
      });

      summary.cleanup = "removed-legacy-source";
    } catch (error) {
      // A PDF viewer, Explorer preview, antivirus, or another process can keep a
      // Windows directory/file handle open. Leaving the legacy source behind is
      // safe because config now points at books/<bookId>/.
      summary.cleanup = `left-in-place: ${error.code || ""} ${error.message}`;
    }
  } else {
    summary.cleanup =
      "left-in-place-because-merge-was-not-clean";
  }

  return summary;
}

try {
  await fs.mkdir(booksRoot, {
    recursive: true
  });

  const target = await chooseTargetBook();

  if (!target) {
    console.log(
      "No existing single-book runtime data was found. Multi-book storage will initialize when a book is first recorded."
    );
    process.exit(0);
  }

  const destinationRoot = path.join(
    booksRoot,
    target.bookId
  );

  await fs.mkdir(destinationRoot, {
    recursive: true
  });

  const record = await ensureRegistry(target);

  console.log("\nRuntime migration / repair\n");
  console.log(`Target book ID: ${target.bookId}`);
  console.log(`Detection source: ${target.source}`);
  console.log(
    `Runtime destination: ${destinationRoot}`
  );
  console.log(
    "Active-book registry has been written before legacy cleanup."
  );
  console.log("");

  const summaries = [];

  for (const dirInfo of runtimeDirs) {
    const summary = await mergeLegacyDirectory(
      dirInfo,
      destinationRoot
    );

    summaries.push(summary);

    if (!summary.sourceExisted) continue;

    console.log(
      `${dirInfo.name}/: copied ${summary.copied.length}, ` +
      `already present ${summary.alreadyPresent.length}, ` +
      `conflicts ${summary.conflicts.length}, ` +
      `copy errors ${summary.copyErrors.length}`
    );

    if (
      summary.cleanup.startsWith("left-in-place")
    ) {
      console.log(
        `  Legacy ${dirInfo.name}/ kept in place: ${summary.cleanup}`
      );
    }
  }

  const criticalProblems = summaries.filter(
    (summary) =>
      summary.critical &&
      (
        summary.conflicts.length ||
        summary.copyErrors.length
      )
  );

  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    status: criticalProblems.length
      ? "critical-merge-problems"
      : "usable",
    target: {
      bookId: target.bookId,
      title: record.title,
      bookRoot: record.bookRoot,
      runtimeRoot: destinationRoot
    },
    summaries,
    notes: [
      "Legacy source directories may remain if Windows kept a file handle open.",
      "A leftover root-level output/ directory is noncritical because output is derived and can be rebuilt.",
      "New runtime commands use books/<activeBookId>/ after active.json is written."
    ]
  };

  await fs.writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log("");
  console.log(`Migration report: ${reportPath}`);

  if (criticalProblems.length) {
    console.error(
      "\nCRITICAL MIGRATION WARNING: captures/assets contained merge errors or conflicts."
    );
    console.error(
      "Do not delete the legacy copies. Review migration-report.json."
    );
    process.exitCode = 2;
  } else {
    console.log(
      "\nPASS: the active multi-book runtime is usable."
    );

    const leftovers = summaries.filter(
      (summary) =>
        summary.sourceExisted &&
        summary.cleanup.startsWith("left-in-place")
    );

    if (leftovers.length) {
      console.log(
        "Some old root-level runtime folders remain because Windows would not release them."
      );
      console.log(
        "They are ignored by Git and can be deleted later after closing the program that holds them open."
      );
    }
  }
} catch (error) {
  console.error(
    `\nMULTI-BOOK MIGRATION FAILED\n${error.message}\n`
  );
  process.exitCode = 1;
}
