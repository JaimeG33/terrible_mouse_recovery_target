# Typical Usage

## 1. Start dedicated Chrome

```powershell
npm run chrome:start
```

## 2. Record

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

Wait for:

```text
ONE-PASS CHAPTER RECORDING READY
```

Version 0.6.5 disables the Chrome cache during recording so a manual revisit can produce fresh asset responses.

If you started while already inside the chapter, use the TOC to re-enter its beginning after `READY`.

Then manually traverse the chapter and stop with `Ctrl+C`.

## 3. Check

```powershell
npm run status
```

`knownMissing` should be `none`.

## 4. Build

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build runs validation, inventory, staged-asset promotion, asset health, assembly, and PDF rendering.

If an asset is missing, the automatic recovery menu can keep normal formatting everywhere except the affected captured fragment.

## Output names

Normal:

```text
chapter03.pdf
```

Whole-chapter fallbacks:

```text
chapter03_safe-formatting.pdf
chapter03_bare-bones.pdf
```

Partial fallbacks:

```text
chapter03_partial-safe.pdf
chapter03_partial-bare-bones.pdf
```

Alternative names are intentional so they cannot be mistaken for a fully normal reconstruction.
