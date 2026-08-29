# Step 5.2.4 - Build Pipeline Exit-Code Fix

## Symptom

Chapter 3 recorded successfully and `npm run status` reported:

```text
knownMissing: none
```

but:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

printed the Stage 1 header and immediately reported:

```text
BUILD STOPPED
Stage: Chapter content validation
```

The actual `chapter:validate` output was not visible.

## Root cause

The build wrapper used:

```powershell
$exitCode = Invoke-NpmStage ...
```

and `Invoke-NpmStage` did:

```powershell
& npm.cmd run $ScriptName
return $LASTEXITCODE
```

PowerShell functions do not return only explicit `return` values.

Everything written to the success-output pipeline by commands inside the function also becomes function output.

Therefore npm's normal console output plus the explicit integer exit code were assigned to `$exitCode`.

Instead of:

```text
0
```

`$exitCode` effectively became an array resembling:

```text
[
  "> to-spite-ghislaine-maxwell@0.6.3 chapter:validate",
  "> node src/chapter-health.mjs",
  "...PASS...",
  0
]
```

The comparison:

```powershell
if ($exitCode -ne 0)
```

then treated the non-integer output strings as nonzero and entered the failure branch even though Node had exited successfully.

Because the function output was assigned, the validator's normal console text was also hidden from the terminal.

## Fix

Version 0.6.4 runs each npm stage as a standalone statement and stores the real `$LASTEXITCODE` separately in script scope.

This preserves both:

- visible stage output;
- a single integer exit code.

The same correction is applied to the low-level npm actions in `scripts/chapter.ps1`.

## Expected Chapter 3 Stage 1

After the fix:

```text
STAGE: 1/6 - Chapter content validation

> ... chapter:validate
> node src/chapter-health.mjs

Chapter capture health

Chapter: 3
Reader fragments: 1, 2, 3, 4, 5, 6, 7, 9, 10
Numeric ID gaps: 8
Known linked missing readers: none

PASS: no explicitly referenced reader fragment is missing.
```

The build should then continue to Stage 2.
