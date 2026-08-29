# Recovery and Fallbacks

The goal is to let a non-programmer recover from common chapter failures without editing source code or `manifest.json`.

## Recording did not actually start

A successful `record` command must print:

```text
ONE-PASS CHAPTER RECORDING READY
```

If an older version returns to the shell immediately after `Active book selected`, no new chapter XHTML or staged assets were recorded.

Version 0.6.2 fixes that Windows PowerShell wrapper issue.

## Build stops because XHTML/text is missing

This is a major content problem.

Do not use formatting fallback to hide known missing text.

Run:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action record
```

and manually revisit the chapter.

Existing good fragments are deduplicated.

## Missing images/styles/media

For a complete visual copy, re-run `record`.

If the remaining problem is formatting-only or a usable text copy is sufficient, choose Safe or Plain mode.

## Safe mode

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode safe
```

Attempts to preserve semantic HTML, headings, paragraphs, lists, tables, and available images with simple built-in CSS.

## Plain mode

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode plain
```

Creates a text-first reconstruction with minimal formatting dependencies.

Plain mode is not a claim that missing visual content was recovered.

## Reset menu

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action reset
```

Options include:

- output only;
- assets/staging;
- full chapter recording;
- one `reader_N` fragment.

Reset operations create timestamped backups.
