# Technical Overview

## Current architecture

Recommended workflow:

```text
manual Chrome navigation
        |
        v
one-pass record.mjs
   |            |
   v            v
captures/     staging/
   |            |
   +-----+------+
         |
         v
      build
```

All runtime paths are resolved under the active:

```text
books/<bookId>/
```

## Why the Chapter 1/2 workflow worked

The historical standalone watchers (`capture.mjs` and `assets-capture.mjs`) each owned their complete Node process lifecycle.

They connected to Chrome over CDP, remained alive during manual navigation, then explicitly called `process.exit(...)` after `Ctrl+C`.

That dropped their CDP websocket and returned control to PowerShell.

## Why the new wrapper stalled

`book-manager.mjs use-current` became a new short-lived pre-recording CDP client.

It connected using `chromium.connectOverCDP`, performed the registry writes, printed `Active book selected`, but did not close or otherwise release the CDP client.

Calling `browser.close()` was not appropriate because it could close the user's dedicated Chrome process.

Version 0.6.3 instead follows the old standalone lifecycle pattern: after all writes are awaited, it explicitly exits only the Node client process.

## PowerShell orchestration

The project also avoids ambiguous `npm` in multi-stage `.ps1` orchestration because Windows may resolve it to `npm.ps1`.

Where npm orchestration is needed, `npm.cmd` is used explicitly.

For the critical record startup sequence, the wrapper launches two direct Node processes:

```text
node book-manager.mjs use-current
node record.mjs
```

## Legacy path

`scripts/legacy-chapter.ps1` preserves the older independent pipeline:

```text
capture
inventory
assets
validate
assemble
pdf
```

The workflow behavior is historical, but runtime paths remain modern/per-book.

## Asset path correction

The old asset watcher used:

```text
<project>/assets/chapterXX
```

which was correct before multi-book support.

After version 0.6, that became obsolete. Version 0.6.3 updates it to use `ASSET_ROOT`, keeping legacy asset capture inside the active book runtime.

## Development rule

Any short-lived tool that calls `connectOverCDP` must either:

- remain intentionally long-running until user cancellation; or
- explicitly terminate/disconnect its own client lifecycle after awaited work.

Do not call `browser.close()` merely to release a CDP client attached to user-owned dedicated Chrome.
