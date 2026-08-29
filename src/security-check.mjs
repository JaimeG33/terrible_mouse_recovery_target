import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { PROJECT_ROOT } from "./config.mjs";

const riskyPathPatterns = [
  /(^|\/)\.chrome-profile(\/|$)/i,
  /^books\//i,
  /^backups\//i,
  /^captures\//i,
  /^structure\//i,
  /^assets\//i,
  /^staging\//i,
  /^output\//i,
  /(^|\/)\.env(?:\.|$)/i,
  /\.har$/i,
  /(^|\/)cookies?.*\.json$/i,
  /(^|\/)storage[-_]?state.*\.json$/i,
  /(^|\/)auth[-_]?state.*\.json$/i,
  /\.(?:pem|key|p12|pfx)$/i
];

const requiredIgnoreEntries = [
  ".chrome-profile/",
  "books/",
  "backups/",
  ".env",
  ".env.*",
  "*.har",
  "*.pem",
  "*.key"
];

try {
  const tracked = execFileSync(
    "git",
    ["ls-files"],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf8"
    }
  )
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const riskyTracked = tracked.filter((file) =>
    riskyPathPatterns.some((pattern) =>
      pattern.test(file)
    )
  );

  const gitignore = await fs.readFile(
    `${PROJECT_ROOT}/.gitignore`,
    "utf8"
  );

  const ignoreLines = gitignore.split(/\r?\n/);

  const missingIgnores = requiredIgnoreEntries.filter(
    (entry) => !ignoreLines.includes(entry)
  );

  console.log("\nRepository security preflight\n");
  console.log(`Tracked files checked: ${tracked.length}`);

  if (riskyTracked.length) {
    console.log(
      "\nFAIL: sensitive/runtime-looking paths are tracked:"
    );
    for (const file of riskyTracked) {
      console.log(`  - ${file}`);
    }
  }

  if (missingIgnores.length) {
    console.log(
      "\nWARNING: recommended .gitignore entries are missing:"
    );
    for (const entry of missingIgnores) {
      console.log(`  - ${entry}`);
    }
  }

  if (!riskyTracked.length && !missingIgnores.length) {
    console.log(
      "PASS: no known runtime/auth paths are tracked and the expected ignore rules are present."
    );
  }

  console.log(
    "\nThis is a path-based preflight, not a guarantee that arbitrary source-code text contains no secret."
  );

  if (riskyTracked.length) {
    process.exitCode = 2;
  }
} catch (error) {
  console.error(
    `\nSECURITY CHECK FAILED\n${error.message}\n`
  );
  process.exitCode = 1;
}
