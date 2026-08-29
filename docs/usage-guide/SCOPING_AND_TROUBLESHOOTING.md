# Scoping and Troubleshooting

## The two kinds of scope

### Book scope

A workspace should contain runtime data for one book.

The project records the current EPUB book root in:

```text
captures/book-scope.json
```

Future content capture sessions compare the current reader to that root.

If you open a different textbook in the same dedicated Chrome profile, the capture watcher stops with:

```text
BOOK SCOPE MISMATCH
```

Use a separate project copy/workspace for the second book.

### Chapter scope

Set a chapter before a long recording session:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action capture
```

Standard `reader_N.xhtml` fragments from other chapters are ignored.

**Important:** a manually navigated same-book XHTML page that does not use the normal `chapterNN/reader_N.xhtml` filename is not automatically discarded. It is stored as an auxiliary fragment under the explicit chapter scope and ordered relative to the last normal reader fragment.

This prevents chapter review/transition pages with alternate EPUB filenames from disappearing simply because their filename is different.

## "Could not connect to Chrome"

Run:

```powershell
npm run chrome:start
```

Then use the Chrome window started by that command.

## "No open McGraw Hill reader page"

Open the book in the dedicated Chrome window and wait for the reader to load, then retry:

```powershell
npm run inspect
```

## Capture says `outside-scope`

This is expected when a normal reader fragment clearly belongs to another chapter.

Example:

```text
[outside-scope] current chapter=3 reader=1; target chapter=2; not saved
```

## Capture says `captured-aux`

This means the manually navigated book displayed XHTML whose URL did not match the normal `chapterNN/reader_N.xhtml` pattern.

Example:

```text
[captured-aux] chapter=2 afterReader=3 ...
```

This is expected. The fragment is being preserved because the chapter scope and manual navigation provide the chapter context.

## Status shows `numericGaps`

Example:

```text
readers: 1, 2, 3, 4, 5, 6, 7, 9
numericGaps: 8
knownMissing: none
```

A numeric gap alone is not considered proof that content is missing. `reader_N` is a resource filename, not a guaranteed contiguous page sequence.

The more important field is `knownMissing`.

If `knownMissing` lists a number, captured XHTML explicitly references that reader file and you should revisit the chapter before building.

To restore the older strict behavior for a diagnostic run:

```powershell
$env:MHE_STRICT_READER_SEQUENCE = "1"
.\scripts\chapter.ps1 -Chapter 2 -Action assemble
Remove-Item Env:MHE_STRICT_READER_SEQUENCE
```

## `assets:download` returns HTTP 403

Use the signed-in browser-response workflow:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action assets
```

## Asset capture used to print many font errors

Step 5.1 no longer watches every generic font/icon declared by the global publisher stylesheet by default.

Direct chapter assets remain watched.

Optional CSS dependency capture can be enabled manually:

```powershell
$env:MHE_CAPTURE_CSS_DEPS = "1"
```

For normal chapter PDFs this is usually unnecessary.

## A required opening image is missing

Start the asset watcher while positioned outside the target opening page, then navigate into the chapter after the watcher starts.

## PDF fonts differ slightly from the website

Some publisher fonts may not have been cached.

If text, figures, tables, and reading order remain usable, this can be accepted.

## Chrome appears to remain running

Close the whole dedicated Chrome window normally or run:

```powershell
npm run chrome:stop
```
