# Scoping and Troubleshooting

## Recording readiness

A successful one-pass recording must reach:

```text
ONE-PASS CHAPTER RECORDING READY
```

Do not navigate before that line.

## Build stops at Stage 1 even though `status` says `knownMissing: none`

Version 0.6.3 had a PowerShell output-capture bug in `scripts/build-chapter.ps1`.

The build helper returned an exit code from a function whose npm stdout was also PowerShell pipeline output. Assigning the function call to `$exitCode` captured both the console text and the integer exit code.

That could make a successful validator look nonzero and also hide its output.

Version 0.6.4 stores `$LASTEXITCODE` separately and leaves command output visible.

After updating, Stage 1 should print the full `chapter:validate` report before deciding whether to continue.

## `record` stops after `Active book selected`

Version 0.6.3 fixes the short-lived book-manager CDP lifecycle so it exits after registry writes without closing dedicated Chrome.

## `knownMissing`

If `npm run status` lists values under `knownMissing`, re-record and revisit the relevant chapter portion.

A numeric reader-ID gap by itself is informational.

## Legacy fallback

See:

```text
docs/usage-guide/LEGACY_RECORDING.md
```

for the independent XHTML + asset two-pass workflow.

## Opening assets

If recording starts while already inside the target chapter, wait for `READY`, then re-enter the chapter beginning through the TOC.

## Recovery

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```
