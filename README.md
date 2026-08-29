# to_spite_ghislaine_maxwell

A local accessibility/recovery helper for supported McGraw Hill eBook reader books.

The normal workflow records content you manually navigate to in dedicated Chrome, then reconstructs the local capture into continuous HTML/PDF.

## Recommended workflow

Start Chrome:

```powershell
npm run chrome:start
```

Record one chapter:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

A successful start must reach:

```text
ONE-PASS CHAPTER RECORDING READY
```

Then manually traverse the chapter and press `Ctrl+C` when you reach the next chapter.

Check:

```powershell
npm run status
```

Build:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

## Legacy two-pass workflow

The older Chapter 1/2 workflow remains available as a fallback:

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action capture
# manually traverse Chapter 3, then Ctrl+C

.\scripts\legacy-chapter.ps1 -Chapter 3 -Action inventory

.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assets
# manually traverse Chapter 3 again, then Ctrl+C

.\scripts\legacy-chapter.ps1 -Chapter 3 -Action validate
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assemble
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action pdf
```

See:

```text
docs/usage-guide/LEGACY_RECORDING.md
```

for the historical workflow and why it is retained.

## Recovery / books / diagnostics

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset

npm run books
npm run runtime:doctor
npm run structure
npm run security:check
```

Runtime book data is isolated under:

```text
books/<bookId>/
```

## Documentation

Start with:

- `docs/usage-guide/STARTUP.md`
- `docs/usage-guide/TYPICAL_USAGE.md`
- `docs/usage-guide/COMMAND_REFERENCE.md`
- `docs/usage-guide/LEGACY_RECORDING.md`
- `docs/usage-guide/RECOVERY_AND_FALLBACKS.md`
- `docs/usage-guide/MULTI_BOOK.md`
- `docs/usage-guide/RUNTIME_AND_DATA_LAYOUT.md`
- `docs/usage-guide/COMPATIBILITY.md`
