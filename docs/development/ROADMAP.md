# Development Roadmap

## Completed

### Steps 1-4

Implemented:

- dedicated Chrome/CDP inspection and capture;
- TOC/structure analysis;
- asset inventory/browser-response recovery;
- continuous HTML and PDF proof.

### Step 5 / 5.1

Added:

- chapter scope;
- auxiliary XHTML preservation;
- event-driven capture + polling fallback;
- non-contiguous reader-ID handling;
- status/diagnostic improvements;
- Chrome lifecycle/security/docs cleanup.

### Step 5.2 / 5.2.1

Added:

- one-pass XHTML + asset staging;
- six-stage build pipeline;
- Safe/Plain fallback;
- reset/retry + backups;
- multi-book runtime;
- current-book selection;
- targeted chapter health;
- staged asset promotion;
- runtime migration/doctor;
- partial-migration repair.

### Step 5.2.2

Fixed Windows PowerShell orchestration where the `record` wrapper could stop immediately after `book:use-current` and never launch `record`.

The wrapper now uses direct Node processes for the two recording startup stages and `npm.cmd` for multi-stage npm orchestration.

## Current operational stage

Record/build remaining chapters with:

```text
record -> status -> build
```

The normal workflow requires one manual chapter traversal.

## Next - Batch local chapter processing

Planned:

- build multiple already-recorded chapters locally;
- per-chapter success/failure reports;
- no automatic online navigation to fill missing captures.

## Final - Master document / QA

Planned:

- combine completed chapter PDFs;
- optional front matter/index/accessibility sections;
- bookmarks/metadata where practical;
- sanity checks and visual QA.

## Future compatibility

Potential later work:

- better friendly book titles;
- alternate TOC conventions;
- different reader resource naming;
- changed iframe/DOM selectors;
- compatibility adapters;
- highly interactive/script-dependent content handling.
