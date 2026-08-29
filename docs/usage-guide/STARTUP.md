# Startup Guide

This guide covers a clean setup before recording any book content.

## Requirements

Install:

1. **Google Chrome**
2. **VS Code**
3. **Node.js 20 or newer** (npm is included with Node.js)
4. **Git** if you are cloning the repository

Recommended VS Code extension:

- **PowerShell** by Microsoft

The JavaScript/TypeScript language support used by this project is already built into VS Code. No browser extension is required.

## Install the project

Open the project folder in VS Code, then open a PowerShell terminal.

Run:

```powershell
npm install
```

This installs `playwright-core`, which is used to connect to Chrome through the Chrome DevTools Protocol (CDP).

## Start the dedicated Chrome profile

Run:

```powershell
npm run chrome:start
```

This launches a separate Chrome user-data directory at:

```text
.chrome-profile/
```

The browser opens the McGraw Hill bookshelf by default.

Sign in using your own existing McGraw Hill account and open the book you want to work with.

The profile is intentionally separate from your normal Chrome profile. It may remember your McGraw Hill login because Chrome stores cookies/local site data in that dedicated profile.

## Verify the reader

With the eBook open, run:

```powershell
npm run inspect
```

A successful result should identify a chapter and reader fragment and show a `baseHref` resembling:

```text
.../OPS/.../chapter01/reader_1.xhtml
```

If `inspect` cannot see the reader, see `SCOPING_AND_TROUBLESHOOTING.md`.

## Capture the TOC once per book

For a new book workspace:

```powershell
npm run toc
npm run structure
```

`toc` reads the visible McGraw Hill table-of-contents tree.

`structure` compares that TOC with the captures already stored locally.

You do not need to rerun `toc` before every chapter unless the original TOC capture was incomplete.

## One workspace per book

The project stores runtime material under shared local folders such as:

```text
captures/
assets/
structure/
output/
```

Step 5 adds a `captures/book-scope.json` guard. Once a workspace is associated with one book root, content capture refuses to save a different book into the same workspace.

For a second textbook, use another clone/copy of the project or archive the current ignored runtime folders first.

## Before publishing code

Run:

```powershell
npm run security:check
```

Never force-add `.chrome-profile`, `captures`, `assets`, `structure`, or `output` to Git.
