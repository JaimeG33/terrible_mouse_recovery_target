# terrible_mouse_recovery_target

A local accessibility/recovery helper for supported McGraw Hill eBook reader pages.

The tool connects to a **dedicated Chrome profile**, watches the McGraw Hill EPUB content that you manually navigate to, saves the already-rendered XHTML and required assets locally, and can reconstruct those captures into continuous HTML and chapter PDFs.

It is intentionally a manual-navigation workflow. It does not guess hidden `reader_*.xhtml` URLs, copy authentication tokens/cookies into scripts, or automatically crawl a textbook.

## What you need

- Windows
- Google Chrome
- VS Code
- Node.js 20+ with npm
- access to the McGraw Hill book through your own account

Install the project dependencies once:

```powershell
npm install
```

## Typical chapter workflow

Start the dedicated browser:

```powershell
npm run chrome:start
```

Sign in to McGraw Hill in that Chrome window and open the book.

Verify the reader:

```powershell
npm run inspect
```

For a chapter, the easiest scoped commands are:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action capture
```

Manually move through Chapter 2, then stop with `Ctrl+C`.

Prepare and capture its assets:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action inventory
.\scripts\chapter.ps1 -Chapter 2 -Action assets
```

Manually move through the same chapter again while the asset watcher runs, then stop with `Ctrl+C`.

Validate and build:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action validate
.\scripts\chapter.ps1 -Chapter 2 -Action assemble
.\scripts\chapter.ps1 -Chapter 2 -Action pdf
```

The chapter output is placed under:

```text
output/chapter02/
```

Check overall capture progress at any time with:

```powershell
npm run status
npm run structure
```

When finished, close the dedicated Chrome window normally or use:

```powershell
npm run chrome:stop
```

## Important scoping note

Use **one project workspace per book**. Step 5 adds a local book-scope guard so a capture session will refuse to mix a different McGraw Hill book into an existing workspace.

The tool detects chapter numbers from the current McGraw Hill reader and TOC when the book uses the expected `Chapter N` / `chapterNN/reader_N.xhtml` conventions. It is designed to work with more than one title, but it is not guaranteed to support every McGraw Hill product or legacy reader without adaptation.

## Documentation

Start here:

- [`docs/usage-guide/STARTUP.md`](docs/usage-guide/STARTUP.md) - first-time setup
- [`docs/usage-guide/TYPICAL_USAGE.md`](docs/usage-guide/TYPICAL_USAGE.md) - normal end-to-end workflow
- [`docs/usage-guide/COMMAND_REFERENCE.md`](docs/usage-guide/COMMAND_REFERENCE.md) - what each command does
- [`docs/usage-guide/SCOPING_AND_TROUBLESHOOTING.md`](docs/usage-guide/SCOPING_AND_TROUBLESHOOTING.md) - chapter/book scope and common fixes
- [`docs/development/TECHNICAL_OVERVIEW.md`](docs/development/TECHNICAL_OVERVIEW.md) - architecture and development environment
- [`docs/development/ROADMAP.md`](docs/development/ROADMAP.md) - remaining development steps

## Privacy / repository safety

The dedicated Chrome profile can contain login/session information. Captured textbook material and generated PDFs also remain local.

The following are intentionally Git-ignored:

```text
.chrome-profile/
captures/
structure/
assets/
output/
```

Run this before publishing changes:

```powershell
npm run security:check
```

Do not force-add ignored runtime folders to Git.
