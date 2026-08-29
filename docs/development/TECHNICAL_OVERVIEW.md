# Technical Overview

## Purpose

The project is a local manual-navigation capture/reconstruction tool for supported McGraw Hill EPUB reader books.

The core principle is:

```text
user manually opens/navigates content
        |
        v
dedicated signed-in Chrome
        |
        +--> rendered iframe XHTML --> captures/
        |
        +--> naturally loaded assets --> assets/
        |
        v
local assembler
        |
        +--> continuous HTML
        |
        v
Chrome PDF renderer
        |
        +--> chapter PDF
```

The tool does not automatically walk guessed textbook URLs.

## Main technologies

### Node.js / ECMAScript modules

The project uses Node's built-in modules including:

- `fs/promises`
- `path`
- `url`
- `crypto`
- `child_process`

The package is configured with:

```json
"type": "module"
```

### `playwright-core`

`playwright-core` is the only project dependency.

It connects to an already-running Chrome instance through the Chrome DevTools Protocol (CDP).

Unlike the full Playwright package, `playwright-core` does not need to install its own browser for this workflow because the project targets the user's installed Google Chrome.

### Google Chrome + CDP

`scripts/start-chrome.ps1` launches Chrome with:

```text
--remote-debugging-port=9222
--remote-debugging-address=127.0.0.1
--user-data-dir=<project>/.chrome-profile
```

The separate user-data directory is important because modern Chrome restricts remote-debugging behavior against the normal default profile.

### PowerShell

PowerShell is used for Windows startup and the chapter-scoping helper.

`scripts/chapter.ps1` temporarily sets `MHE_CHAPTER` for one child command and restores the previous environment afterward.

## Reader assumptions

The current implementation expects the supported McGraw Hill reader to expose:

- an outer reader URL matching the configured `reader-ui` hints;
- an iframe with id `clo-iframe`;
- chapter fragments whose base URL resembles `chapterNN/reader_N.xhtml`;
- a material TOC tree with the attributes used by `src/toc.mjs`.

These conventions are not hardcoded to one title, but they are specific to this reader implementation.

A different McGraw Hill legacy product, PDF-only product, or redesigned reader may require adapter changes.

## Book detection / scope

The project does not identify a textbook by ISBN or a built-in catalog database.

Instead, `src/book-scope.mjs` derives a stable book root from the currently rendered EPUB base URL, normally the path through `/OPS/`.

The first book in a workspace becomes the local scope. A later content-capture attempt from a different root fails rather than mixing two books under `captures/chapterXX/`.

## Chapter detection

The number `13` is not a hardcoded book limit.

`src/toc.mjs` reads the active book's TOC tree.

`src/structure.mjs` recognizes top-level labels matching:

```text
Chapter <number>
```

and derives the chapter range from neighboring top-level TOC nodes.

The XHTML parser independently extracts numeric chapter/reader information from paths resembling:

```text
/chapter01/reader_1.xhtml
```

Books using different naming conventions may need parser changes.

## Content capture

`src/capture.mjs` polls the current reader.

`src/reader.mjs` snapshots the already-rendered iframe DOM:

- full `documentElement.outerHTML`;
- base URL;
- document title;
- visible text length;
- EPUB page-break elements;
- reader links present in the XHTML.

`saveSnapshot` hashes the XHTML and stores each unique fragment once.

A `reader_N.xhtml` fragment can contain multiple print/page-break markers. The application is recording reader fragments, not taking one screenshot per visible page.

## TOC / structure discovery

`src/toc.mjs` reads and expands the reader's existing TOC interface.

`src/structure.mjs` compares the TOC with locally captured reader fragments and reports known referenced gaps.

It deliberately does not auto-navigate to those gaps.

## Asset handling

`src/assets.mjs inventory` parses captured XHTML for resources such as images and stylesheets.

The original standalone HTTP downloader may receive HTTP 403 from McGraw Hill's EPUB CDN.

`src/assets-capture.mjs` therefore attaches to the signed-in browser and saves matching resource response bodies that Chrome naturally receives during manual navigation.

Publisher CSS can declare a very large generic font/icon library. `src/asset-health.mjs` treats resources referenced directly by captured XHTML as required and reports CSS-only supplemental resources separately.

## Reconstruction

`src/assemble.mjs`:

1. reads one chapter's captured XHTML in reader-number order;
2. extracts body content;
3. removes active scripts/iframes;
4. rewrites available resources to local file URLs;
5. combines fragments into one continuous HTML document.

## PDF rendering

`src/render-pdf.mjs` opens the assembled local HTML in the attached Chrome browser and calls Playwright's PDF renderer.

The PDF proof requests:

- Letter paper;
- printed backgrounds;
- tagged PDF output;
- outline generation.

## VS Code development setup

Required outside VS Code:

- Node.js 20+
- npm
- Google Chrome
- Git

Recommended VS Code extension:

- **PowerShell** by Microsoft

Useful built-in VS Code features:

- JavaScript/TypeScript IntelliSense;
- integrated PowerShell terminal;
- source control / Git diff;
- JSON validation.

There is currently no ESLint, TypeScript build step, bundler, database, or web server dependency.

## Safe development rules

Preserve these design constraints:

- manual content navigation;
- no cookie/token export;
- no automatic guessing/crawling of textbook fragments;
- one runtime workspace per book;
- runtime/book material must remain Git-ignored;
- browser automation should operate only on content already opened by the user.
