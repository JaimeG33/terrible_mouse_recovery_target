# to_spite_ghislaine_maxwell

A local accessibility/recovery helper for supported McGraw Hill eBook reader books.

The tool uses a dedicated Chrome profile and records **only content you manually navigate to**. During one chapter pass it saves rendered XHTML and passively stages matching book assets that Chrome naturally loads. It can then validate, assemble, and render that chapter to continuous HTML and PDF.

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

Record a chapter once:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

The command should print:

```text
Active book selected
...
Launching one-pass chapter recorder...
...
ONE-PASS CHAPTER RECORDING READY
```

Do **not** start navigating until `ONE-PASS CHAPTER RECORDING READY` appears.

Then manually traverse the chapter. Press `Ctrl+C` when you reach the next chapter.

Build the chapter:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build pipeline runs:

```text
chapter validation
-> asset inventory
-> one-pass staged asset matching
-> asset validation
-> HTML assembly
-> PDF rendering
```

If normal publisher formatting fails while captured text is intact, the build can offer:

- **Safe** mode: semantic HTML and available images with simple built-in CSS.
- **Plain** mode: text-first reconstruction with minimal formatting.

Known missing XHTML/text remains a hard stop.

## Multiple books

Runtime data is isolated under:

```text
books/<bookId>/
```

List registered local books:

```powershell
npm run books
```

`Action record` automatically selects/registers the McGraw Hill book currently open in the dedicated Chrome reader.

Check the active runtime:

```powershell
npm run runtime:doctor
```

## Reset / retry

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```

The reset menu can clear generated output, chapter assets/staging, the entire chapter recording, or one `reader_N` fragment. Destructive resets create a backup first.

## Useful diagnostics

```powershell
npm run status
npm run structure
npm run books
npm run runtime:doctor
npm run security:check
```

## Documentation

Start with:

- `docs/usage-guide/STARTUP.md`
- `docs/usage-guide/TYPICAL_USAGE.md`
- `docs/usage-guide/COMMAND_REFERENCE.md`
- `docs/usage-guide/RECOVERY_AND_FALLBACKS.md`
- `docs/usage-guide/MULTI_BOOK.md`
- `docs/usage-guide/RUNTIME_AND_DATA_LAYOUT.md`
- `docs/usage-guide/COMPATIBILITY.md`

Developer notes are under:

```text
docs/development/
```
