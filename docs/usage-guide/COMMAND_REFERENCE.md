# Command Reference

## Recommended workflow

```powershell
npm run chrome:start

.\scripts\chapter.ps1 -Chapter 3 -Action record

npm run status

.\scripts\chapter.ps1 -Chapter 3 -Action build
```

A successful `record` start must reach:

```text
ONE-PASS CHAPTER RECORDING READY
```

## Normal chapter actions

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

`record`, `build`, and `reset` are the preferred user-facing actions.

The other action names are retained for low-level/legacy diagnosis.

## Legacy wrapper

```powershell
.\scripts\legacy-chapter.ps1 -Chapter N -Action <action>
```

Supported:

```text
select
capture
inventory
assets
validate
assemble
pdf
proof
status
```

See `LEGACY_RECORDING.md`.

## Book commands

```powershell
npm run books
npm run book:use-current
npm run runtime:doctor
npm run runtime:migrate
```

`book:use-current` connects to the current reader only long enough to identify/select the book. Version 0.6.3 explicitly terminates that Node CDP client after all registry writes finish, without closing the dedicated Chrome process.

## Reader / structure

```powershell
npm run inspect
npm run toc
npm run structure
npm run status
```

## Asset commands

```powershell
npm run assets:inventory
npm run assets:capture
npm run assets:promote
npm run assets:validate
npm run assets:validate:raw
npm run assets:download
```

`assets:capture` now uses the active per-book `ASSET_ROOT`.

## Reconstruction

```powershell
npm run assemble
npm run pdf
npm run proof
```

## Render modes

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode normal
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode safe
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode plain
```

Known missing XHTML/text remains blocking.

## Security

```powershell
npm run security:check
```
