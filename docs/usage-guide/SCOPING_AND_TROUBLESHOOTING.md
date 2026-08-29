# Scoping and Troubleshooting

## `record` returns immediately after selecting the book

Symptom:

```text
Active book selected
...
PS ...>
```

and the terminal never prints:

```text
Launching one-pass chapter recorder...
ONE-PASS CHAPTER RECORDING READY
```

In version 0.6.1, `scripts/chapter.ps1` chained:

```text
npm run book:use-current
npm run record
```

inside one PowerShell script.

On Windows, `npm` may resolve to `npm.ps1`. The npm PowerShell shim ends with `exit $LASTEXITCODE`, and in this orchestration context it could terminate the wrapper after book selection before `record` launched.

Version 0.6.2 fixes this by:

- running `src/book-manager.mjs use-current` directly with Node;
- launching `src/record.mjs` directly in a second Node process;
- using `npm.cmd` explicitly in other multi-stage PowerShell orchestration.

After updating, successful recording startup must reach:

```text
ONE-PASS CHAPTER RECORDING READY
```

## Book scope

Version 0.6+ supports multiple books under:

```text
books/<bookId>/
```

The active book is selected in:

```text
books/active.json
```

Normal recording selects the currently open book automatically.

Diagnostics:

```powershell
npm run books
npm run runtime:doctor
```

## Chapter scope

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action record
```

Normal reader fragments clearly belonging to another chapter are ignored.

Same-book XHTML with a non-standard resource name can be preserved as an auxiliary fragment.

## `outside-scope`

Expected when entering another chapter:

```text
[outside-scope] current chapter=5 reader=1; target chapter=4; not saved
```

## `captured-aux`

Expected for scoped same-book XHTML that does not match the normal reader filename:

```text
[captured-aux] chapter=2 afterReader=3 ...
```

## `numericGaps` vs `knownMissing`

`numericGaps` alone are informational.

`knownMissing` means captured XHTML explicitly references an uncaptured reader fragment.

If `knownMissing` lists values, re-run `record` and revisit the relevant chapter portion.

## Opening assets are missing

If you start recording while already inside the target chapter, wait for `READY`, then use the TOC to re-enter the beginning before proceeding.

## Build stops at chapter validation

Known XHTML/text is missing.

Re-record. Do not use formatting fallback to hide it.

## Build stops at asset validation

For missing visual/media resources, re-record.

For formatting-only problems, use automatic Safe/Plain fallback or explicitly request:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode safe
```

or:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action build -Mode plain
```

## Reset / retry

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action reset
```

Use this instead of manually editing `manifest.json`.

## Chrome connection failure

```powershell
npm run chrome:start
```

## Reader not found

Open the book in dedicated Chrome, wait for it to load, then:

```powershell
npm run inspect
```

## Runtime/migration problems

```powershell
npm run runtime:migrate
npm run runtime:doctor
npm run books
```

## PDF rendering failure

Keep dedicated Chrome running through the PDF stage.

If HTML assembly succeeded, the HTML remains available even if PDF rendering fails.
