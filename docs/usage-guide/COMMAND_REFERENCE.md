# Command Reference

## Normal workflow

```powershell
npm run chrome:start
.\scripts\chapter.ps1 -Chapter 3 -Action record
npm run status
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

## Build modes

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

Bare Bones:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode plain
```

Partial Safe:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode partial-safe
```

Partial Bare Bones:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode partial-plain
```

Partial modes use affected XHTML fragments reported by the latest chapter asset-health report.

## Alternative output filenames

```text
normal         -> chapter03.pdf
safe           -> chapter03_safe-formatting.pdf
plain          -> chapter03_bare-bones.pdf
partial-safe   -> chapter03_partial-safe.pdf
partial-plain  -> chapter03_partial-bare-bones.pdf
```

The matching HTML and build-report filenames use the same suffix convention.

## Legacy two-pass workflow

See:

```text
docs/usage-guide/LEGACY_RECORDING.md
```

## Diagnostics

```powershell
npm run status
npm run structure
npm run books
npm run runtime:doctor
npm run security:check
```
