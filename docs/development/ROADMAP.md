# Development Roadmap

## Completed

### Steps 1-4

Reader inspection/capture, TOC/structure analysis, asset recovery, continuous HTML, and PDF proof.

### Step 5 / 5.1

Chapter scoping, auxiliary XHTML, event-driven capture, ordering fixes, status, security, and documentation.

### Step 5.2 / 5.2.1

One-pass recording, build pipeline, fallback modes, reset/retry, multi-book storage, staged asset promotion, and runtime migration repair.

### Step 5.2.2

Removed ambiguous Windows `npm.ps1` chaining from record/build orchestration.

### Step 5.2.3

Fixed the short-lived book-manager CDP lifecycle and restored a documented legacy two-pass fallback.

### Step 5.2.4

Fixed PowerShell build-stage result handling. Npm stdout is no longer accidentally captured together with the integer exit code, so successful stages no longer appear to fail and their diagnostics remain visible.

## Current operational stage

Validate Chapter 3 with:

```text
record -> status -> build
```

Keep the legacy two-pass workflow as a diagnostic fallback.

## Next

Batch local processing of already-recorded chapters.

## Final

Master PDF assembly and final QA.
