import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_ROOT } from "./config.mjs";
import { connectToChrome, findReaderPage } from "./reader.mjs";

const STRUCTURE_ROOT = path.join(PROJECT_ROOT, "structure");
const TOC_PATH = path.join(STRUCTURE_ROOT, "toc.json");

async function ensureTocVisible(page) {
  const tree = page.locator('[data-automation-id="material-tree-toc"]');

  if (await tree.count()) {
    try {
      if (await tree.first().isVisible()) {
        return tree.first();
      }
    } catch {
      // Continue to opening logic.
    }
  }

  const openerSelectors = [
    '[data-automation-id="contents-menu-button"]',
    '[data-automation-id="contents-button"]',
    'button[aria-label*="Contents" i]',
    'button[title*="Contents" i]',
    'button:has(.dpg-icon-listview)'
  ];

  let opened = false;

  for (const selector of openerSelectors) {
    const candidate = page.locator(selector);
    if (!(await candidate.count())) continue;

    for (let i = 0; i < await candidate.count(); i += 1) {
      const item = candidate.nth(i);
      try {
        if (await item.isVisible()) {
          await item.click();
          opened = true;
          break;
        }
      } catch {
        // Try the next candidate.
      }
    }

    if (opened) break;
  }

  if (!opened) {
    throw new Error(
      [
        "Could not automatically open the Contents drawer.",
        "Open the reader's Contents panel manually, select the Table of Contents tab, then rerun npm run toc."
      ].join("\n")
    );
  }

  await page.waitForTimeout(500);

  const tocTab = page.locator('[data-automation-id="table-of-contents-tab"]');
  if (await tocTab.count()) {
    try {
      if (await tocTab.first().isVisible()) {
        await tocTab.first().click();
      }
    } catch {
      // The TOC tab may already be active.
    }
  }

  try {
    await tree.first().waitFor({ state: "visible", timeout: 5000 });
  } catch {
    throw new Error(
      "The Contents drawer opened, but the material TOC tree did not become visible."
    );
  }

  return tree.first();
}

async function expandVisibleTree(page, tree) {
  let clicks = 0;
  const maxClicks = 500;

  while (clicks < maxClicks) {
    const expanders = tree.locator(
      '[data-automation-id="material-toc-toggle-button"][aria-label="Expand node"]'
    );

    const count = await expanders.count();
    if (!count) break;

    let clickedOne = false;

    for (let i = 0; i < count; i += 1) {
      const button = expanders.nth(i);
      try {
        if (await button.isVisible()) {
          await button.click();
          clicks += 1;
          clickedOne = true;
          await page.waitForTimeout(60);
          break;
        }
      } catch {
        // DOM may have re-rendered after expansion. Re-query on next loop.
        clickedOne = true;
        break;
      }
    }

    if (!clickedOne) break;
  }

  return clicks;
}

function addHierarchyPaths(nodes) {
  const stack = [];

  return nodes.map((node) => {
    while (stack.length > node.level) {
      stack.pop();
    }

    stack[node.level] = node.label;
    stack.length = node.level + 1;

    return {
      ...node,
      hierarchyPath: stack.join(" > ")
    };
  });
}

let browser;

try {
  browser = await connectToChrome();
  const page = await findReaderPage(browser);
  const tree = await ensureTocVisible(page);

  const expansionClicks = await expandVisibleTree(page, tree);

  const rawNodes = await tree.locator('[role="treeitem"]').evaluateAll((elements) =>
    elements.map((element) => ({
      label:
        element.getAttribute("aria-label") ||
        element.querySelector(".node-content")?.textContent?.trim() ||
        "",
      nodeId: element.getAttribute("data-node-id"),
      level: Number.parseInt(element.getAttribute("data-level") || "0", 10),
      spinePosition: Number.parseInt(element.getAttribute("data-spine-pos") || "-1", 10),
      hash: element.getAttribute("data-hash"),
      ariaLevel: Number.parseInt(element.getAttribute("aria-level") || "0", 10),
      positionInSet: Number.parseInt(element.getAttribute("aria-posinset") || "0", 10),
      setSize: Number.parseInt(element.getAttribute("aria-setsize") || "0", 10),
      expanded: element.getAttribute("aria-expanded"),
      current: element.getAttribute("aria-current")
    }))
  );

  const nodes = addHierarchyPaths(rawNodes);
  const topLevel = nodes.filter((node) => node.level === 0);

  const payload = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    outerPageUrl: page.url(),
    expansionClicks,
    nodeCount: nodes.length,
    topLevelCount: topLevel.length,
    nodes
  };

  await fs.mkdir(STRUCTURE_ROOT, { recursive: true });
  await fs.writeFile(TOC_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("\nTOC structure captured\n");
  console.log(`Saved: ${TOC_PATH}`);
  console.log(`Tree nodes: ${nodes.length}`);
  console.log(`Top-level nodes: ${topLevel.length}`);
  console.log(`Expansion clicks: ${expansionClicks}\n`);

  console.table(
    topLevel.map((node) => ({
      spinePosition: node.spinePosition,
      label: node.label,
      nodeId: node.nodeId
    }))
  );
} catch (error) {
  console.error(`\nTOC DISCOVERY FAILED\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
}
