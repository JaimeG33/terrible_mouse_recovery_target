# Step 5.1 - Chapter Capture / Ordering Fix

## Symptom

Chapter 2 manually traversed to Chapter 3, but the capture manifest contained:

```text
reader 1, 2, 3, 4, 5, 6, 7, 9
```

The assembler then stopped on:

```text
Chapter 2 has internal reader gaps: 8
```

The PDF command failed afterward because the HTML assembler had never produced `chapter02.html`.

## What the log revealed

Two assumptions in Step 5 were too strict.

### 1. Scoped capture rejected non-`reader_N` XHTML

Immediately after Chapter 2 `reader_03`, the reader displayed an XHTML location that did not match:

```text
/chapterNN/reader_N.xhtml
```

The Step 5 scoped watcher treated a null parse result as outside the target chapter.

That is unsafe for completeness because a book can contain manually navigated auxiliary XHTML with another filename convention.

The fix preserves same-book non-standard XHTML encountered during a chapter-scoped manual traversal and records where it appeared relative to the last normal reader fragment.

### 2. Reader file IDs were assumed to be contiguous

The old assembler generated every integer from `1..highestReader` and treated any missing number as a missing document.

EPUB resource filenames do not guarantee that numbering must be contiguous.

The new assembler distinguishes:

- **numeric ID gaps**: informational unless strict mode is requested;
- **known linked missing readers**: blocking, because captured XHTML explicitly references them.

## Capture reliability improvement

The watcher now listens for actual `clo-iframe` frame navigation events and snapshots those navigations quickly.

The original polling loop remains as a fallback.

This reduces the chance of missing a short-lived reader fragment when the user advances pages faster than the polling interval.

## Auxiliary fragment ordering

During a scoped chapter capture, a non-standard XHTML fragment is saved with:

- `chapterNumber` = the explicit manual scope;
- `readerNumber` = null;
- `afterReaderNumber` = the last normal reader observed;
- `auxOrderWithinGap` = its observed order in that gap.

The assembler uses this metadata to place the auxiliary XHTML between surrounding normal reader fragments.

## Asset watcher cleanup

Generic CSS font/icon dependencies are no longer added to the normal watch list by default.

This avoids the large stream of irrelevant `response.body` errors seen during Chapter 2 asset capture.

To deliberately restore optional CSS dependency capture:

```powershell
$env:MHE_CAPTURE_CSS_DEPS = "1"
```

For the current accepted PDF fidelity, this should normally stay off.

## Re-test Chapter 2

After installing this patch:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action capture
```

Manually traverse Chapter 2 again from the beginning to the beginning of Chapter 3.

Then:

```powershell
npm run status
npm run validate
.\scripts\chapter.ps1 -Chapter 2 -Action inventory
.\scripts\chapter.ps1 -Chapter 2 -Action assets
.\scripts\chapter.ps1 -Chapter 2 -Action proof
```

Re-running the inventory is important because newly preserved auxiliary XHTML may reference assets that were not present in the old nine-item Chapter 2 inventory.
