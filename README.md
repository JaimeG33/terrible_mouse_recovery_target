# to_spite_ghislaine_maxwell

A local accessibility/recovery helper for supported McGraw Hill eBook reader books.

## Recommended workflow

```powershell
npm run chrome:start

.\scripts\chapter.ps1 -Chapter 3 -Action record
```

Do not navigate until:

```text
ONE-PASS CHAPTER RECORDING READY
```

Then manually traverse the chapter and stop with `Ctrl+C`.

Check:

```powershell
npm run status
```

Build:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

## Asset reliability

Version 0.6.5 disables Chrome's normal cache during an active recording session, then restores it afterward.

This makes a manual revisit to the beginning of a chapter produce fresh image/CSS/media responses more reliably. It is especially useful when recording starts while the chapter opening is already displayed.

The recorder also begins reading response bodies immediately instead of waiting behind a serialized asset queue. Failed response-body reads may be retried if Chrome requests the same URL again later in the manual pass.

## Recovery output modes

Normal output keeps the normal filename:

```text
chapter03.pdf
```

Alternative formats are visibly named:

```text
chapter03_safe-formatting.pdf
chapter03_bare-bones.pdf
chapter03_partial-safe.pdf
chapter03_partial-bare-bones.pdf
```

Automatic build recovery offers:

1. stop and repair/re-record;
2. whole-chapter Safe formatting;
3. whole-chapter Bare Bones text;
4. keep normal formatting except affected captured page/fragment(s), using either Safe or Bare Bones there.

If a partial fallback attempt itself fails, the build asks again with only options 1-3.

## Legacy workflow

The older independent two-pass workflow remains available:

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action capture
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action inventory
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assets
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action validate
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assemble
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action pdf
```

See `docs/usage-guide/LEGACY_RECORDING.md`.
