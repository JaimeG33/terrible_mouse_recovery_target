# Step 5.2.3 - Recorder Lifecycle Fix / Legacy Fallback

## Observed failure

The 0.6.2 Chapter 3 command printed:

```text
Active book selected
```

but never reached:

```text
Launching one-pass chapter recorder...
ONE-PASS CHAPTER RECORDING READY
```

The PowerShell wrapper was waiting for:

```text
node src/book-manager.mjs use-current
```

to exit.

## Comparison to the working Chapter 1/2 workflow

The Chapter 1/2-era standalone watchers explicitly ended their own Node process after use:

```text
capture.mjs        -> process.exit(...)
assets-capture.mjs -> process.exit(...)
```

Therefore their Playwright CDP websocket could not keep Node alive after the user stopped the command.

`book-manager.mjs` was introduced later. It connected over CDP but had no equivalent lifecycle termination.

## Fix

After all book registry/scope writes are awaited, `book-manager.mjs use-current` now explicitly exits its own Node process.

It deliberately does not call:

```text
browser.close()
```

because that browser represents the user's already-running dedicated Chrome instance.

## Legacy fallback

A new:

```text
scripts/legacy-chapter.ps1
```

provides the independent historical sequence.

The original low-level action names remain available on `scripts/chapter.ps1` as well.

## Multi-book asset correction

The standalone `assets-capture.mjs` still contained the pre-0.6 root-level asset path.

It now uses:

```text
ASSET_ROOT
```

so legacy asset capture stays inside:

```text
books/<activeBookId>/assets/
```
