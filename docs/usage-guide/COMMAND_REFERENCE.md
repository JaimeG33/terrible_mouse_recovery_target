# Command Reference

The normal user workflow is:

```text
chrome:start -> record -> status -> build
```

Most other commands are diagnostics, recovery tools, or lower-level development commands.

## Chrome

### `npm run chrome:start`

Starts the dedicated Chrome profile with local Chrome DevTools Protocol (CDP) access.

The profile is stored in:

```text
.chrome-profile/
```

### `npm run chrome:stop`

Closes the dedicated Chrome session reachable at the configured CDP URL.

## Normal chapter workflow

### `.\scripts\chapter.ps1 -Chapter N -Action record`

Recommended recording command.

The wrapper:

1. runs `src/book-manager.mjs use-current` directly with Node;
2. waits for successful book selection;
3. launches `src/record.mjs` directly in a second Node process.

The separate second process matters because `src/config.mjs` must load after `books/active.json` has been written.

Version 0.6.2 deliberately avoids chaining these two steps through generic `npm` from inside PowerShell, because Windows may resolve `npm` to `npm.ps1`; that shim's exit behavior can prematurely terminate a larger `.ps1` workflow.

Successful startup must reach:

```text
ONE-PASS CHAPTER RECORDING READY
```

After that, manually traverse the chapter and stop with `Ctrl+C`.

The recorder simultaneously:

- saves rendered XHTML;
- preserves scoped auxiliary XHTML;
- stages eligible browser-loaded assets.

### `.\scripts\chapter.ps1 -Chapter N -Action build`

Recommended processing command.

Default mode is `auto`.

The build runs:

```text
1. chapter:validate
2. assets:inventory
3. assets:promote
4. assets:validate
5. assemble
6. pdf
```

PowerShell orchestration uses `npm.cmd` explicitly so the Windows npm PowerShell shim cannot interrupt the multi-stage script.

### Build modes

Automatic:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

Normal:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode normal
```

Safe:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode safe
```

Plain:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode plain
```

Known missing XHTML/text blocks all modes.

### `.\scripts\chapter.ps1 -Chapter N -Action reset`

Interactive reset/retry menu with automatic backups.

## Book management

### `npm run books`

Lists the local book registry.

### `npm run book:use-current`

Selects/registers the McGraw Hill book currently open in dedicated Chrome.

Normal users rarely need this manually because `Action record` performs the same selection step directly.

### `npm run runtime:doctor`

Verifies that the active book resolves to a valid per-book runtime/capture manifest.

### `npm run runtime:migrate`

Repairs/completes migration from older root-level runtime folders into `books/<bookId>/`.

## Reader / structure

### `npm run inspect`

Reads the current reader without saving it.

### `npm run toc`

Reads the current book's TOC into its per-book structure directory.

### `npm run structure`

Compares TOC/navigation information with captures.

### `npm run status`

Displays chapter capture progress.

Important fields:

- `readers`
- `auxiliary`
- `numericGaps`
- `knownMissing`
- `pageMarkers`

`knownMissing` is the blocking signal.

## Validation

### `npm run chapter:validate`

Checks the selected chapter for explicitly referenced uncaptured reader fragments.

### `npm run validate`

Broader manifest validation.

### `.\scripts\chapter.ps1 -Chapter N -Action validate`

Runs targeted chapter validation followed by direct asset validation.

## Assets

### `npm run assets:inventory`

Builds the selected chapter's asset inventory from captured XHTML.

### `npm run assets:promote`

Matches required URLs to the one-pass staging cache.

### `npm run assets:validate`

Checks direct required assets and separately reports supplemental CSS dependencies.

### `npm run assets:capture`

Low-level/legacy asset-only watcher. Prefer `Action record`.

### `npm run assets:download`

Low-level standalone HTTP downloader; protected resources may return HTTP 403.

### `npm run assets:validate:raw`

Older strict diagnostic validator.

## Reconstruction

### `npm run assemble`

Assembles selected chapter using `MHE_RENDER_MODE`.

### `npm run pdf`

Renders assembled HTML to PDF through dedicated Chrome.

### `npm run proof`

Legacy chain:

```text
assets:validate -> assemble -> pdf
```

Prefer `Action build` for normal use.

## Low-level wrapper actions

```text
record
build
reset
capture
inventory
assets
validate
assemble
pdf
proof
status
```

## Security

### `npm run security:check`

Checks known runtime/auth-sensitive tracked paths and core ignore rules.
