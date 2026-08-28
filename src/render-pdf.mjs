import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./config.mjs";
import { connectToChrome } from "./reader.mjs";

const chapterNumber = Number.parseInt(process.env.MHE_CHAPTER || "1", 10);

if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
  throw new Error("MHE_CHAPTER must be a positive integer.");
}

const pad2 = (value) => String(value).padStart(2, "0");
const chapterLabel = `chapter${pad2(chapterNumber)}`;
const outputRoot = path.join(PROJECT_ROOT, "output", chapterLabel);
const htmlPath = path.join(outputRoot, `${chapterLabel}.html`);
const pdfPath = path.join(outputRoot, `${chapterLabel}.pdf`);

let page;
let exitCode = 0;

try {
  await fs.access(htmlPath);

  const browser = await connectToChrome();
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error("Connected Chrome has no browser context.");
  }

  page = await context.newPage();

  await page.goto(pathToFileURL(htmlPath).href, {
    waitUntil: "load",
    timeout: 30000
  });

  await page.evaluate(async () => {
    for (const image of document.images) {
      image.loading = "eager";
    }

    const images = [...document.images];
    await Promise.allSettled(
      images.map(async (image) => {
        if (image.complete) return;
        await new Promise((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          setTimeout(done, 5000);
        });
      })
    );

    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 3000))
      ]);
    }
  });

  await page.emulateMedia({ media: "print" });

  await fs.mkdir(outputRoot, { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true
  });

  const stat = await fs.stat(pdfPath);

  console.log("\nChapter PDF created\n");
  console.log(`Chapter: ${chapterNumber}`);
  console.log(`Source HTML: ${htmlPath}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`PDF bytes: ${stat.size}\n`);
  console.log(
    "Open both the HTML and PDF and compare several pages, especially images, headings, sidebars, and the transition between reader fragments."
  );
} catch (error) {
  exitCode = 1;
  console.error(`\nPDF RENDER FAILED\n${error.message}\n`);
} finally {
  await page?.close().catch(() => {});
}

// connectOverCDP attaches to the user's dedicated Chrome.
// Exiting Node drops this CDP connection without intentionally closing Chrome.
process.exit(exitCode);
