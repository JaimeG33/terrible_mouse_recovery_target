# Scoping and Troubleshooting

## `record` stops after `Active book selected`

Versions 0.6.1/0.6.2 exposed two different orchestration issues.

Version 0.6.2 fixed the Windows `npm.ps1` chaining issue, but then revealed that `book-manager.mjs use-current` itself kept a Playwright CDP websocket alive.

The symptom was:

```text
Active book selected
Book ID: ...
Title: ...
Root: ...
```

with no return to the wrapper and no:

```text
ONE-PASS CHAPTER RECORDING READY
```

Version 0.6.3 fixes this by explicitly terminating the short-lived book-manager Node process after its awaited registry writes complete.

It does **not** call `browser.close()`, so dedicated Chrome remains open.

## Normal success signal

Do not navigate until you see:

```text
ONE-PASS CHAPTER RECORDING READY
```

## Legacy fallback

If the combined recorder has a future problem, use:

```text
docs/usage-guide/LEGACY_RECORDING.md
```

The legacy path keeps XHTML capture and asset capture independent.

## Book scope

Runtime is isolated under:

```text
books/<bookId>/
```

Check:

```powershell
npm run books
npm run runtime:doctor
```

## `knownMissing`

If `npm run status` lists a reader under `knownMissing`, re-run recording and revisit the relevant chapter section.

Formatting fallbacks do not override known missing text.

## Opening assets

If recording begins while already inside the target chapter, wait for `READY`, then manually re-enter the chapter beginning through the TOC.

## Asset-only legacy errors

Version 0.6.3 fixes the legacy asset watcher to use the active per-book asset directory rather than the obsolete project-root `assets/` directory.

## Recovery

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```
