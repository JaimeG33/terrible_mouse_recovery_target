# Step 5.2.2 - Windows Record Wrapper Hotfix

## Symptom

Running:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

printed:

```text
Active book selected

Book ID: ...
Title: ...
Root: ...
```

and then immediately returned to the PowerShell prompt.

It never printed:

```text
ONE-PASS CHAPTER RECORDING READY
```

As a result, manually traversing Chapter 3 happened with no recorder running. Existing Chapter 3 readers 1-2 remained unchanged, and the later build correctly stopped because readers 3-4 were still explicitly referenced but uncaptured.

## Root cause

Version 0.6.1 used:

```powershell
npm run book:use-current
npm run record
```

sequentially inside `scripts/chapter.ps1`.

On Windows PowerShell, `npm` may resolve to the Node installation's `npm.ps1` shim rather than `npm.cmd`.

That shim uses `exit $LASTEXITCODE`. In the affected orchestration context, the first npm invocation could terminate the parent chapter wrapper after book selection, so the second npm invocation was never reached.

The log proves the failure occurred in the wrapper rather than `src/record.mjs`: npm never printed the `record` script header, and `record.mjs` never printed its READY banner.

## Fix

Version 0.6.2 changes `Action record` to:

```text
node src/book-manager.mjs use-current
        |
        v
node src/record.mjs
```

The processes remain separate intentionally.

`book-manager.mjs` writes `books/active.json` first. Then the new recorder process imports `src/config.mjs` and sees the newly selected `ACTIVE_BOOK_ID`.

Other multi-stage PowerShell orchestration now invokes `npm.cmd` explicitly instead of ambiguous `npm`.

## Expected behavior

A successful recording startup now prints:

```text
Active book selected
...
Launching one-pass chapter recorder...
...
ONE-PASS CHAPTER RECORDING READY
```

Only after `READY` should the user start manually navigating the chapter.

## Chapter 3 recovery

Existing Chapter 3 readers 1-2 do not need to be deleted.

After applying the hotfix:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

manually traverse all of Chapter 3, then press `Ctrl+C`.

Check:

```powershell
npm run status
```

When Chapter 3 shows:

```text
knownMissing: none
```

run:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```
