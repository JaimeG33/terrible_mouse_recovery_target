# Recovery and Fallbacks

The goal is to let a non-programmer recover from common chapter failures without editing JavaScript.

## Build stops because XHTML/text is missing

This is treated as a major content problem.

Do not use formatting fallback to hide known missing text.

Run:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action record
```

and manually revisit the chapter.

Existing good fragments are deduplicated; newly observed fragments are added.

## Build reports missing images/styles/media

The report prints the resource type and which captured XHTML referenced it.

For a complete visual copy, re-run `record`.

If the problem is formatting-only or a usable text copy is sufficient, choose Safe or Plain mode when offered.

## Safe mode

Safe mode removes most publisher layout/classes/inline styling and uses a simple built-in stylesheet.

It attempts to preserve:

- headings;
- paragraphs;
- lists;
- tables;
- figures/images that were captured;
- semantic document order.

Use:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode safe
```

## Plain mode

Plain mode is the most tolerant fallback.

It extracts readable text from the captured XHTML, removes complicated publisher layout, and converts image alt text into textual image markers where possible.

Use:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode plain
```

Plain mode is a fallback, not a claim that missing visual content was recovered.

## Reset menu

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action reset
```

Options:

- output only;
- chapter assets/staging;
- whole chapter recording;
- one `reader_N` fragment.

The reset command creates a timestamped backup before removal.
