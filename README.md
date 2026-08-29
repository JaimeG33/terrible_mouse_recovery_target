# to_spite_ghislaine_maxwell

A local accessibility/recovery helper for supported McGraw Hill eBook reader books.

The tool uses a dedicated Chrome profile and records **only the textbook content you manually navigate to**. It saves rendered XHTML and matching browser-loaded assets locally, then reconstructs the chapter into continuous HTML and PDF.

It does not automatically crawl hidden textbook URLs or export account cookies/tokens into scripts.

## Normal workflow

Install once:

```powershell
npm install
```

Start the dedicated Chrome window:

```powershell
npm run chrome:start
```

Sign into McGraw Hill and open the book.

Record a chapter **once**:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

After the terminal says `ONE-PASS CHAPTER RECORDING READY`, manually move through the chapter. Press `Ctrl+C` when you reach the next chapter.

Build the chapter:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build command runs capture validation, asset inventory, staged-asset matching, asset validation, HTML assembly, and PDF rendering in order.

If normal publisher formatting fails but text is intact, the build can offer:

- **Safe** formatting: semantic content + simple built-in CSS.
- **Plain** formatting: text-first fallback with minimal styling.

Known missing XHTML/text remains a hard stop.

## Multiple books

The tool keeps a local book registry:

```powershell
npm run books
```

Runtime data is isolated under:

```text
books/<bookId>/
```

so Chapter 1 of Book A cannot collide with Chapter 1 of Book B.

When `Action record` starts, the book currently open in the dedicated Chrome reader is selected/registered automatically.

## Reset / retry

For a chapter that needs to be redone:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```

The menu can rebuild output only, reset assets, reset an entire chapter recording, or remove one `reader_N` fragment. Data is backed up before destructive reset operations.

## Useful diagnostics

```powershell
npm run status
npm run structure
npm run books
npm run security:check
```

## Documentation

See:

```text
docs/usage-guide/
docs/development/
```

Start with:

- `docs/usage-guide/TYPICAL_USAGE.md`
- `docs/usage-guide/RECOVERY_AND_FALLBACKS.md`
- `docs/usage-guide/MULTI_BOOK.md`
