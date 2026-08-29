# Development Roadmap

## Completed

### Steps 1-4

Reader inspection/capture, TOC/structure analysis, asset recovery, continuous HTML, and PDF proof.

### Step 5 / 5.1

Chapter scoping, auxiliary XHTML, event-driven capture, ordering fixes, status, security, and documentation.

### Step 5.2 / 5.2.1

One-pass recording, build pipeline, fallback render modes, reset/retry, multi-book storage, staging promotion, and runtime migration repair.

### Step 5.2.2

Removed ambiguous Windows `npm.ps1` chaining from the record/build PowerShell orchestration.

### Step 5.2.3

Fixed the remaining one-pass startup stall by making the short-lived book-selection CDP process explicitly terminate after registry writes.

Also restored a documented legacy two-pass fallback and corrected the legacy asset watcher for the per-book runtime.

## Current operational stage

Validate Chapter 3 with:

```text
record -> status -> build
```

Keep the legacy two-pass path available as a diagnostic fallback.

## Next

Batch local processing of already-recorded chapters.

## Final

Master PDF assembly and final QA.

## Future compatibility

Reader adapters, friendlier book titles, alternate TOC/path conventions, and interactive-content handling.
