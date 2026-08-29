import fs from "node:fs/promises";
import path from "node:path";
import {
  ASSET_ROOT,
  MANIFEST_PATH
} from "./config.mjs";

const chapterNumber = Number.parseInt(
  process.env.MHE_CHAPTER || "1",
  10
);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const assetRoot = path.join(ASSET_ROOT, chapterLabel);
const inventoryPath = path.join(assetRoot, "inventory.json");
const healthReportPath = path.join(assetRoot, "health-report.json");

async function exists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

try {
  const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));

  const chapterSourceFiles = new Set(
    (manifest.captures || [])
      .filter((entry) => entry.chapterNumber === chapterNumber)
      .map((entry) => entry.savedAs)
  );

  const direct = [];
  const supplemental = [];

  for (const entry of inventory.assets || []) {
    const row = {
      present: await exists(path.join(assetRoot, entry.localFile)),
      kinds: entry.kinds || [],
      referencedBy: entry.referencedBy || [],
      url: entry.url,
      localFile: entry.localFile
    };

    const isDirect = row.referencedBy.some((source) =>
      chapterSourceFiles.has(source)
    );

    (isDirect ? direct : supplemental).push(row);
  }

  const directMissing = direct.filter((item) => !item.present);
  const directPresent = direct.filter((item) => item.present);

  const missingFormattingOnly = directMissing.filter((entry) =>
    entry.kinds.every((kind) =>
      ["stylesheet", "inline-css", "style-attribute"].includes(kind)
    )
  );

  const missingContentAssets = directMissing.filter(
    (entry) => !missingFormattingOnly.includes(entry)
  );

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    chapterNumber,
    direct: {
      total: direct.length,
      present: directPresent.length,
      missing: directMissing.length
    },
    supplemental: {
      total: supplemental.length,
      present: supplemental.filter((item) => item.present).length,
      missing: supplemental.filter((item) => !item.present).length
    },
    missingFormattingOnly,
    missingContentAssets,
    missing: directMissing
  };

  await fs.writeFile(
    healthReportPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  console.log("\nAsset health report\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log("");
  console.log("Direct captured-XHTML assets");
  console.log(`  Present: ${report.direct.present}`);
  console.log(`  Missing: ${report.direct.missing}`);
  console.log(`  Total:   ${report.direct.total}`);
  console.log("");
  console.log("Supplemental CSS-declared resources");
  console.log(`  Present: ${report.supplemental.present}`);
  console.log(`  Missing/unobserved: ${report.supplemental.missing}`);
  console.log(`  Total declared: ${report.supplemental.total}`);

  if (directMissing.length) {
    console.log("\nMissing direct assets:");
    console.table(
      directMissing.map((item) => ({
        kind: item.kinds.join("|"),
        referencedBy: item.referencedBy.join(", "),
        url: item.url
      }))
    );

    if (missingContentAssets.length) {
      console.log(
        "\nSome missing assets are images/media/content resources. Re-recording is recommended for a complete visual copy."
      );
    } else {
      console.log(
        "\nAll missing direct assets appear formatting-related. Safe/Plain build modes can continue without publisher formatting."
      );
    }

    process.exitCode = 2;
  } else {
    console.log(
      "\nPASS: every direct asset referenced by captured Chapter XHTML is present."
    );
  }

  console.log(`Health report: ${healthReportPath}\n`);
} catch (error) {
  console.error(`\nASSET HEALTH FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
