# Typical Usage

## Recommended one-pass workflow

Start dedicated Chrome:

```powershell
npm run chrome:start
```

Sign in and open the intended McGraw Hill book.

Start a chapter recording:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

Expected sequence:

```text
Active book selected
...
Launching one-pass chapter recorder...
...
ONE-PASS CHAPTER RECORDING READY
```

Version 0.6.3 fixes the CDP lifecycle bug that could leave the book-selection Node process running after `Active book selected`.

Do not navigate until `READY`.

Then manually traverse the entire chapter. Stop with `Ctrl+C` when you reach the next chapter.

Check:

```powershell
npm run status
```

When `knownMissing` is `none`, build:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build pipeline performs:

```text
chapter validation
-> asset inventory
-> staged asset promotion
-> asset validation
-> assembly
-> PDF rendering
```

## If the one-pass workflow has a regression

The independent two-pass workflow used while developing Chapters 1 and 2 is intentionally retained.

See:

```text
docs/usage-guide/LEGACY_RECORDING.md
```

That workflow runs XHTML capture and asset capture as separate long-running Node processes.
