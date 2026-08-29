# Technical Overview

## Purpose

The project is a local manual-navigation capture/reconstruction tool for supported McGraw Hill EPUB reader books.

Current data flow:

```text
manual navigation in dedicated Chrome
          |
          +------------------------+
          |                        |
          v                        v
 rendered XHTML             browser responses
          |                        |
          v                        v
      captures/                 staging/
          |                        |
          +-----------+------------+
                      |
                      v
                 build pipeline
                      |
            chapter validation
                      |
             asset inventory
                      |
            staged promotion
                      |
             asset validation
                      |
        normal / safe / plain assembly
                      |
                PDF rendering
```

## Technologies

- Node.js / ESM
- PowerShell
- Google Chrome
- Chrome DevTools Protocol
- `playwright-core`

## Runtime roots

`src/config.mjs` derives the source project root and active per-book runtime:

```text
books/<activeBookId>/
```

## Multi-book registry

`src/book-manager.mjs` identifies the currently open EPUB root, selects/creates a local book record, and writes `books/active.json`.

## Windows orchestration rule (0.6.2)

Do not use unqualified `npm` for sequential orchestration inside project `.ps1` scripts.

On Windows PowerShell, `npm` may resolve to `npm.ps1`. The npm PowerShell shim ends with an `exit` using the child exit code, which can terminate a parent orchestration scope before later commands run.

Version 0.6.2 therefore:

- invokes `node src/book-manager.mjs use-current` directly;
- invokes `node src/record.mjs` directly afterward;
- uses `npm.cmd` explicitly inside the multi-stage build wrapper.

The book-selection and recorder stages intentionally use separate Node processes so `src/config.mjs` loads the newly written `books/active.json` when the recorder starts.

## One-pass recording

`src/record.mjs` combines:

- iframe navigation-event capture;
- polling fallback;
- XHTML deduplication;
- scoped auxiliary XHTML preservation;
- passive same-book resource staging.

No automatic textbook navigation is performed.

## Asset promotion

Captured XHTML is inventoried after recording.

Only staged resources whose URLs are required by the captured chapter are promoted to the chapter asset cache.

## Validation

`src/chapter-health.mjs` distinguishes known linked missing readers from merely non-contiguous reader IDs.

## Assembly modes

- `normal`
- `safe`
- `plain`

Known missing XHTML remains blocking.

## Build orchestration

`scripts/build-chapter.ps1` runs:

1. chapter validation;
2. asset inventory;
3. staged promotion;
4. asset validation;
5. assembly;
6. PDF rendering.

## Reset

Interactive PowerShell UI delegates to `src/reset-chapter.mjs`, which creates backups before destructive reset operations.

## Migration

`src/migrate-runtime.mjs` handles pre-0.6 runtime migration and partial-migration repair.

`src/runtime-doctor.mjs` checks active runtime integrity.

## Compatibility

The current adapter expects the observed McGraw Hill reader URL/iframe/TOC conventions. It is reader-specific rather than textbook-title-specific.

## Development environment

Required:

- Node.js 20+
- npm
- Google Chrome
- Git
- Windows PowerShell

Recommended VS Code extension:

- PowerShell by Microsoft

## Safe development constraints

Preserve:

- manual navigation;
- no cookie/token export;
- no guessed textbook crawling;
- per-book isolation;
- Git-ignore runtime/book content;
- never silently hide known missing text through formatting fallback.
