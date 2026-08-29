import fs from "node:fs/promises";
import path from "node:path";
import {
  ASSET_ROOT,
  BACKUP_ROOT,
  CAPTURE_ROOT,
  MANIFEST_PATH,
  OUTPUT_ROOT,
  STAGING_ROOT,
  STRUCTURE_ROOT
} from "./config.mjs";

const chapterNumber = Number.parseInt(
  process.env.MHE_CHAPTER || "",
  10
);

const level = (
  process.argv.find((arg) => arg.startsWith("--level="))
    ?.split("=", 2)[1] ||
  process.env.MHE_RESET_LEVEL ||
  ""
).toLowerCase();

const readerNumberRaw =
  process.argv.find((arg) => arg.startsWith("--reader="))
    ?.split("=", 2)[1] ||
  process.env.MHE_READER ||
  "";

const readerNumber = readerNumberRaw
  ? Number.parseInt(readerNumberRaw, 10)
  : null;

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

if (!["output", "assets", "recording", "fragment"].includes(level)) {
  throw new Error(
    "Reset level must be output, assets, recording, or fragment."
  );
}

if (
  level === "fragment" &&
  (!Number.isInteger(readerNumber) || readerNumber < 1)
) {
  throw new Error(
    "Fragment reset requires a positive MHE_READER / --reader value."
  );
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  BACKUP_ROOT,
  `${timestamp}-${chapterLabel}-${level}`
);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function backupAndRemove(source, relativeBackup) {
  if (!(await exists(source))) return;

  const destination = path.join(
    backupRoot,
    relativeBackup
  );

  await fs.mkdir(path.dirname(destination), {
    recursive: true
  });

  await fs.cp(source, destination, {
    recursive: true,
    force: false,
    errorOnExist: true
  });

  await fs.rm(source, {
    recursive: true,
    force: true
  });
}

async function readManifest() {
  return JSON.parse(
    await fs.readFile(MANIFEST_PATH, "utf8")
  );
}

async function backupManifest(manifest) {
  await fs.mkdir(backupRoot, { recursive: true });
  await fs.writeFile(
    path.join(backupRoot, "manifest.before.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

try {
  await fs.mkdir(backupRoot, { recursive: true });

  if (level === "output") {
    await backupAndRemove(
      path.join(OUTPUT_ROOT, chapterLabel),
      `output/${chapterLabel}`
    );
  }

  if (level === "assets") {
    await backupAndRemove(
      path.join(ASSET_ROOT, chapterLabel),
      `assets/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(STAGING_ROOT, chapterLabel),
      `staging/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(OUTPUT_ROOT, chapterLabel),
      `output/${chapterLabel}`
    );
  }

  if (level === "recording") {
    const manifest = await readManifest();
    await backupManifest(manifest);

    const chapterEntries = manifest.captures.filter(
      (entry) => entry.chapterNumber === chapterNumber
    );

    for (const entry of chapterEntries) {
      const source = path.join(
        CAPTURE_ROOT,
        entry.savedAs
      );

      if (await exists(source)) {
        const destination = path.join(
          backupRoot,
          "captures",
          entry.savedAs
        );

        await fs.mkdir(path.dirname(destination), {
          recursive: true
        });

        await fs.copyFile(source, destination);
      }
    }

    manifest.captures = manifest.captures.filter(
      (entry) => entry.chapterNumber !== chapterNumber
    );

    manifest.updatedAt = new Date().toISOString();

    await fs.writeFile(
      MANIFEST_PATH,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    await fs.rm(
      path.join(CAPTURE_ROOT, chapterLabel),
      { recursive: true, force: true }
    );

    await backupAndRemove(
      path.join(ASSET_ROOT, chapterLabel),
      `assets/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(STAGING_ROOT, chapterLabel),
      `staging/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(OUTPUT_ROOT, chapterLabel),
      `output/${chapterLabel}`
    );

    await fs.rm(
      path.join(STRUCTURE_ROOT, "discovery-report.json"),
      { force: true }
    );
  }

  if (level === "fragment") {
    const manifest = await readManifest();
    await backupManifest(manifest);

    const matching = manifest.captures.filter(
      (entry) =>
        entry.chapterNumber === chapterNumber &&
        entry.readerNumber === readerNumber
    );

    if (!matching.length) {
      throw new Error(
        `No captured Chapter ${chapterNumber} reader_${readerNumber} fragment exists.`
      );
    }

    for (const entry of matching) {
      const source = path.join(
        CAPTURE_ROOT,
        entry.savedAs
      );

      if (await exists(source)) {
        const destination = path.join(
          backupRoot,
          "captures",
          entry.savedAs
        );

        await fs.mkdir(path.dirname(destination), {
          recursive: true
        });

        await fs.copyFile(source, destination);
        await fs.rm(source, { force: true });
      }
    }

    manifest.captures = manifest.captures.filter(
      (entry) =>
        !(
          entry.chapterNumber === chapterNumber &&
          entry.readerNumber === readerNumber
        )
    );

    manifest.updatedAt = new Date().toISOString();

    await fs.writeFile(
      MANIFEST_PATH,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    await backupAndRemove(
      path.join(ASSET_ROOT, chapterLabel),
      `assets/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(STAGING_ROOT, chapterLabel),
      `staging/${chapterLabel}`
    );
    await backupAndRemove(
      path.join(OUTPUT_ROOT, chapterLabel),
      `output/${chapterLabel}`
    );

    await fs.rm(
      path.join(STRUCTURE_ROOT, "discovery-report.json"),
      { force: true }
    );
  }

  console.log("\nChapter reset complete\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Reset level: ${level}`);

  if (level === "fragment") {
    console.log(`Reader fragment: ${readerNumber}`);
  }

  console.log(`Backup: ${backupRoot}\n`);
} catch (error) {
  console.error(`\nCHAPTER RESET FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
