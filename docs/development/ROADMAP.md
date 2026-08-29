# Development Roadmap

## Completed

### Step 1 - Reader inspection / XHTML capture

Implemented the dedicated Chrome + CDP connection and manual-navigation XHTML capture.

### Step 2 - TOC / structure discovery

Added TOC extraction and chapter/spine analysis.

### Step 3 - Asset inventory / recovery

Added asset inventory and browser-response capture after standalone CDN requests returned HTTP 403.

### Step 4 - Reconstruction proof

Added:

- direct-vs-supplemental asset validation;
- continuous local chapter HTML assembly;
- Chrome PDF rendering.

Chapter 1 produced a usable proof PDF.

Minor font differences are accepted when they do not materially harm usability.

## Step 5 - Full manual capture + quality of life

Current stage.

Step 5 adds:

- optional chapter-scoped recording;
- book-root scope locking to prevent accidental cross-book mixing;
- `npm run status`;
- `scripts/chapter.ps1`;
- explicit `chrome:start` / `chrome:stop` commands;
- Chrome loopback debugging / background-mode cleanup;
- stronger Git ignore rules and a repository security preflight;
- reorganized user/developer documentation.

The remaining Step 5 work is operational: manually record the remaining desired chapters.

## Step 6 - Remaining chapter assets

For each fully recorded chapter:

1. build the local asset inventory;
2. run the browser-response asset watcher during a manual chapter pass;
3. validate that direct XHTML resources are present.

Do not spend time reproducing every generic publisher font unless a missing font causes a meaningful usability problem.

## Step 7 - Batch chapter generation

Planned improvements:

- process all completed local chapter captures in one command;
- produce all chapter HTML/PDF files;
- report build failures/gaps per chapter;
- avoid requiring a manual `MHE_CHAPTER` build command for every completed chapter.

This stage operates only on local captures/assets.

## Step 8 - Master document / final QA

Planned:

- combine completed chapter PDFs in correct order;
- create a master PDF;
- preserve useful metadata/bookmarks where practical;
- run automated sanity checks;
- visually spot-check chapter boundaries, figures, tables, and reading order.

The project must also decide whether the desired "complete book" includes top-level material outside numbered chapters, such as front matter, index, and accessibility-content sections.

## Compatibility work after the main project

The current adapter targets the McGraw Hill reader conventions observed during development.

Possible future work:

- alternate TOC label conventions;
- non-`chapterNN/reader_N.xhtml` path conventions;
- changed iframe/DOM selectors;
- book-specific adapters;
- better automatic compatibility diagnostics.

These are not required before finishing the current book.
