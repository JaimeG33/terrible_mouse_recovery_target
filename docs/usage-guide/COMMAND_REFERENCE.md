# Command Reference

## Chrome

### `npm run chrome:start`

Starts the dedicated Chrome profile with local Chrome DevTools Protocol access.

Equivalent script:

```powershell
.\scripts\start-chrome.ps1
```

The profile is stored in `.chrome-profile/`. Step 5 explicitly binds the debugging interface to `127.0.0.1` and disables Chrome background mode for this dedicated launch.

### `npm run chrome:stop`

Intentionally closes the Chrome browser reachable at the configured CDP URL.

Use this when you are done and want an explicit shutdown.

## Reader inspection / structure

### `npm run inspect`

Reads the currently rendered `iframe#clo-iframe` and prints information such as:

- chapter number;
- `reader_N` fragment;
- source base URL;
- EPUB page-break markers;
- reader links found in the rendered XHTML.

It does not save the page.

### `npm run toc`

Opens/reads the visible McGraw Hill table-of-contents tree and saves the result under `structure/toc.json`.

Run this once when setting up a book workspace or when the TOC needs to be refreshed.

### `npm run structure`

Combines the TOC snapshot with the local capture manifest and reports:

- chapters detected from the TOC;
- captured `reader_N` fragments;
- reader fragments already referenced by captured XHTML;
- known gaps.

A lack of known gaps does not prove that a chapter has been completely traversed.

### `npm run status`

Prints a simpler capture-progress table for normal use.

## XHTML recording

### `npm run capture`

Starts the content watcher.

Without a chapter scope it saves any compatible rendered chapter fragment from the workspace's locked book.

You can scope it in PowerShell:

```powershell
$env:MHE_CHAPTER = "2"
npm run capture
```

or:

```powershell
npm run capture -- --chapter 2
```

For normal use, prefer:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action capture
```

The watcher polls the current reader, snapshots each new XHTML fragment once, and writes it under `captures/chapterXX/`.

Stop with `Ctrl+C`.

### `npm run validate`

Checks the raw XHTML capture set for internal numbering gaps.

This is different from `assets:validate`.

## Assets

### `npm run assets:inventory`

Reads one captured chapter and creates/refreshes its asset inventory.

Select the chapter using `MHE_CHAPTER` or the `chapter.ps1` wrapper.

### `npm run assets:capture`

Attaches to the dedicated Chrome session and saves matching resource responses while you manually navigate the chapter.

It is the preferred method for protected McGraw Hill CDN resources that returned HTTP 403 to standalone Node requests.

### `npm run assets:validate`

Checks the resources directly referenced by the captured XHTML.

Direct XHTML resources are required. Generic CSS-declared dependencies are reported separately.

### `npm run assets:validate:raw`

Runs the older strict validator that treats all currently inventoried CSS dependencies as missing/present resources. This is mainly diagnostic and can overstate what is actually required.

### `npm run assets:download`

Attempts ordinary Node HTTP downloads for inventory items. Some McGraw Hill CDN resources reject this with HTTP 403, so this is not the normal authenticated-reader workflow.

## Reconstruction

### `npm run assemble`

Combines the selected chapter's local XHTML fragments into one continuous HTML file and rewrites available assets to local files.

### `npm run pdf`

Renders the selected chapter's assembled HTML to PDF using the dedicated Chrome instance.

### `npm run proof`

Runs:

```text
assets:validate -> assemble -> pdf
```

for the chapter in `MHE_CHAPTER`.

## Scoped helper

The most convenient syntax is:

```powershell
.\scripts\chapter.ps1 -Chapter <number> -Action <action>
```

Supported actions:

```text
capture
inventory
assets
validate
assemble
pdf
proof
status
```

Example:

```powershell
.\scripts\chapter.ps1 -Chapter 7 -Action pdf
```

## Security

### `npm run security:check`

Uses `git ls-files` to ensure known runtime/auth locations are not tracked and verifies the core `.gitignore` protections.

It is a guardrail, not a complete secret scanner.
