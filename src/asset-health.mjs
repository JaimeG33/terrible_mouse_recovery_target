import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./config.mjs";

const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "1", 10);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const chapterLabel = `chapter${String(chapterNumber).padStart(2, "0")}`;
const assetRoot = path.join(PROJECT_ROOT, "assets", chapterLabel);
const inventoryPath = path.join(assetRoot, "inventory.json");

function isDirectXhtmlAsset(entry) {
  return (entry.referencedBy || []).some((source) =>
    new RegExp(`^${chapterLabel}/reader_\\d+\\.xhtml$`, "i").test(source)
  );
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
  const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));

  const direct = [];
  const supplemental = [];

  for (const entry of inventory.assets || []) {
    const present = await exists(path.join(assetRoot, entry.localFile));

    const row = {
      present,
      kind: (entry.kinds || []).join("|"),
      url: entry.url,
      localFile: entry.localFile
    };

    if (isDirectXhtmlAsset(entry)) {
      direct.push(row);
    } else {
      supplemental.push(row);
    }
  }

  const directPresent = direct.filter((item) => item.present);
  const directMissing = direct.filter((item) => !item.present);
  const supplementalPresent = supplemental.filter((item) => item.present);
  const supplementalMissing = supplemental.filter((item) => !item.present);

  console.log("\nAsset health report\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log("");
  console.log("Direct XHTML assets (required for reconstruction)");
  console.log(`  Present: ${directPresent.length}`);
  console.log(`  Missing: ${directMissing.length}`);
  console.log(`  Total:   ${direct.length}`);
  console.log("");
  console.log("CSS-declared supplemental resources");
  console.log(`  Present: ${supplementalPresent.length}`);
  console.log(`  Missing/unobserved: ${supplementalMissing.length}`);
  console.log(`  Total declared: ${supplemental.length}`);
  console.log("");

  if (directMissing.length) {
    console.log("Missing required assets:\n");
    console.table(
      directMissing.map((item) => ({
        kind: item.kind,
        url: item.url,
        localFile: item.localFile
      }))
    );
    process.exitCode = 2;
  } else {
    console.log(
      "PASS: every asset referenced directly by captured Chapter XHTML is present."
    );
    console.log(
      "Supplemental CSS dependencies are informational; the publisher stylesheet declares many fonts/icons that a chapter may never actually use."
    );
  }
} catch (error) {
  console.error(`\nASSET HEALTH FAILED\n${error.message}\n`);
  process.exitCode = 1;
}
