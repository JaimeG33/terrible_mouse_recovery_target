import fs from "node:fs/promises";
import path from "node:path";
import {
  ASSET_ROOT,
  MANIFEST_PATH,
  STAGING_ROOT
} from "./config.mjs";

const chapterNumber = Number.parseInt(
  process.env.MHE_CHAPTER || "",
  10
);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const assetRoot = path.join(ASSET_ROOT, chapterLabel);
const inventoryPath = path.join(assetRoot, "inventory.json");
const stagingChapterRoot = path.join(STAGING_ROOT, chapterLabel);
const stagingIndexPath = path.join(stagingChapterRoot, "index.json");
const reportPath = path.join(assetRoot, "staging-promotion-report.json");

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href;
  } catch {
    return String(value || "");
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

async function exists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

try {
  const inventory = await readJsonIfPresent(inventoryPath);
  const staging = await readJsonIfPresent(stagingIndexPath);
  const manifest = await readJsonIfPresent(MANIFEST_PATH);

  if (!inventory) {
    throw new Error(
      `Asset inventory not found for Chapter ${chapterNumber}.`
    );
  }

  const chapterFiles = new Set(
    (manifest?.captures || [])
      .filter((entry) => entry.chapterNumber === chapterNumber)
      .map((entry) => entry.savedAs)
  );

  const directEntries = (inventory.assets || []).filter((entry) =>
    (entry.referencedBy || []).some((source) =>
      chapterFiles.has(source)
    )
  );

  const stagedByUrl = new Map(
    (staging?.responses || []).map((entry) => [
      normalizeUrl(entry.url),
      entry
    ])
  );

  let existing = 0;
  let promoted = 0;
  const missing = [];

  for (const entry of directEntries) {
    const destination = path.join(assetRoot, entry.localFile);

    if (await exists(destination)) {
      existing += 1;
      continue;
    }

    const staged = stagedByUrl.get(normalizeUrl(entry.url));

    if (!staged) {
      missing.push({
        url: entry.url,
        kinds: entry.kinds,
        referencedBy: entry.referencedBy,
        reason: "not-seen-during-recording"
      });
      continue;
    }

    const source = path.join(stagingChapterRoot, staged.localFile);

    if (!(await exists(source))) {
      missing.push({
        url: entry.url,
        kinds: entry.kinds,
        referencedBy: entry.referencedBy,
        reason: "staging-file-missing"
      });
      continue;
    }

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    promoted += 1;
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chapterNumber,
    requiredDirectAssets: directEntries.length,
    alreadyPresent: existing,
    promotedFromStaging: promoted,
    missingCount: missing.length,
    missing
  };

  await fs.mkdir(assetRoot, { recursive: true });
  await fs.writeFile(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log("\nStaged asset promotion\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Direct assets required: ${directEntries.length}`);
  console.log(`Already present: ${existing}`);
  console.log(`Promoted from one-pass recording: ${promoted}`);
  console.log(`Still missing: ${missing.length}`);

  if (missing.length) {
    console.log("\nMissing assets:");
    console.table(
      missing.map((entry) => ({
        kind: (entry.kinds || []).join("|"),
        referencedBy: (entry.referencedBy || []).join(", "),
        url: entry.url
      }))
    );
  }

  console.log(`\nReport: ${reportPath}\n`);
} catch (error) {
  console.error(`\nSTAGED ASSET PROMOTION FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
