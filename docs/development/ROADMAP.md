# Development Roadmap

## Completed

### Steps 1-4

Reader capture, TOC/structure analysis, asset recovery, continuous HTML, and PDF proof.

### Step 5 / 5.1

Chapter scoping, auxiliary XHTML, event-driven capture, ordering fixes, status, security, and documentation.

### Step 5.2 / 5.2.1

One-pass recording, build pipeline, fallback modes, reset/retry, multi-book storage, staged asset promotion, and runtime migration repair.

### Step 5.2.2

Windows npm orchestration fix.

### Step 5.2.3

Short-lived book-manager CDP lifecycle fix and legacy two-pass fallback.

### Step 5.2.4

PowerShell build-stage output/exit-code handling fix.

### Step 5.2.5

Improved one-pass asset reliability by temporarily disabling Chrome cache during recording, immediately reading resource bodies, and permitting retries after body-read failures.

Added fragment-level partial Safe/Bare Bones recovery and descriptive alternative output filenames.

## Current operational stage

Continue validating the one-pass `record -> status -> build` workflow on additional chapters.

## Next

Batch processing of already-recorded chapters.

## Final

Master PDF assembly and final QA.
