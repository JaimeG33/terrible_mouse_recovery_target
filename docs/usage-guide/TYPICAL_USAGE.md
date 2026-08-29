# Typical Usage

## 1. Start the dedicated Chrome browser

```powershell
npm run chrome:start
```

Sign into McGraw Hill and open the intended book.

## 2. Record one chapter once

Example:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

The wrapper first selects/registers the McGraw Hill book currently open in dedicated Chrome.

Version 0.6.2 then launches the recorder as a separate Node process rather than chaining two generic `npm` calls from PowerShell. This avoids the Windows `npm.ps1` shim prematurely ending the wrapper after book selection.

Expected startup sequence:

```text
Active book selected
...
Launching one-pass chapter recorder...
Do not navigate until the terminal prints ONE-PASS CHAPTER RECORDING READY.
...
ONE-PASS CHAPTER RECORDING READY
```

If the command returns to the PowerShell prompt immediately after `Active book selected` and **never** prints `ONE-PASS CHAPTER RECORDING READY`, the recorder did not start. Confirm the project is version 0.6.2 or newer.

After `READY`, manually traverse the chapter.

The recorder simultaneously:

- stores rendered chapter XHTML;
- preserves scoped auxiliary XHTML;
- passively stages eligible book images/styles/fonts/media that Chrome naturally loads.

It does not automatically advance textbook pages.

When you reach the next chapter, press:

```text
Ctrl+C
```

If you were already inside the target chapter when recording started, use the TOC to re-enter the chapter beginning after `READY` so opening asset responses can be observed.

## 3. Check progress

```powershell
npm run status
```

The most important capture-health field is:

```text
knownMissing
```

If it lists reader fragments, revisit the chapter before building.

`numericGaps` alone are informational.

## 4. Build

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build runs:

```text
chapter validation
-> asset inventory
-> staged asset matching
-> asset validation
-> HTML assembly
-> PDF render
```

If everything passes, output is stored under:

```text
books/<bookId>/output/chapter03/
```

## Formatting fallback

Automatic build mode can offer:

1. Stop/re-record.
2. Safe formatting.
3. Plain text formatting.

Force Safe mode:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode safe
```

Force Plain mode:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode plain
```

Known missing XHTML/text remains a hard stop.

## Reset / retry

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```

The interactive menu safely backs up data before removing output, assets/staging, an entire chapter recording, or one reader fragment.
