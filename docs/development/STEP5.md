# Step 5 - Full Manual Capture / Quality-of-Life Pass

Step 4 proved that local captures can be reconstructed into a usable chapter PDF.

Step 5 therefore focuses on making the repetitive manual capture stage safer and easier before scaling to the remaining chapters.

## Changes

### Chapter-scoped capture

`src/capture.mjs` now reads `MHE_CHAPTER` or `--chapter`.

When a target chapter is set, other chapters are reported as `outside-scope` and are not saved.

Recommended syntax:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action capture
```

### Book scope guard

The first book root is stored locally in:

```text
captures/book-scope.json
```

A later content watcher session from another book root fails with `BOOK SCOPE MISMATCH`.

This protects the existing single-book runtime directory structure.

### Capture status

```powershell
npm run status
```

shows chapter/reader fragments currently present in the local capture manifest.

It is a progress display, not proof of completeness.

### Dedicated Chrome lifecycle

New commands:

```powershell
npm run chrome:start
npm run chrome:stop
```

Normal inspection/capture commands no longer intentionally close the already-running Chrome instance when their CDP connection ends.

The startup script also binds debugging to `127.0.0.1` and launches the dedicated profile with Chrome background mode disabled.

### Security guardrails

The `.gitignore` now covers additional common authentication/debug artifacts.

Run:

```powershell
npm run security:check
```

before publishing changes.

### Documentation

Old step notes moved to:

```text
docs/development/
```

End-user documentation now lives under:

```text
docs/usage-guide/
```
