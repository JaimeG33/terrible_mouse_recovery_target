# Typical Usage

## 1. Start the dedicated Chrome browser

```powershell
npm run chrome:start
```

Sign into McGraw Hill and open the book.

## 2. Record one chapter once

Example:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action record
```

`record` first identifies/selects the book currently open in the reader.

Wait for:

```text
ONE-PASS CHAPTER RECORDING READY
```

Then manually traverse Chapter 3.

The recorder does two jobs simultaneously:

- stores each rendered chapter XHTML fragment;
- passively stages matching book images/styles/media that Chrome naturally loads.

It does not automatically advance textbook pages.

When you reach Chapter 4, press:

```text
Ctrl+C
```

If you were already sitting inside Chapter 3 when recording started, manually use the TOC to re-enter the beginning after the READY message so the opening asset responses can be observed.

## 3. Build

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build
```

The build runs:

```text
chapter validation
  -> asset inventory
  -> staged asset matching
  -> asset validation
  -> HTML assembly
  -> PDF render
```

If everything passes, the PDF is stored under the active book:

```text
books/<bookId>/output/chapter03/chapter03.pdf
```

## Formatting fallback

If text capture is intact but publisher formatting/assets cause a problem, automatic build mode can offer:

1. Stop/re-record.
2. Safe formatting.
3. Plain text formatting.

You can also request a mode directly:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode safe
```

or:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action build -Mode plain
```

Known missing XHTML/text does not silently fall back. The build stops and tells you to revisit the chapter.

## Reset / retry

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action reset
```

The interactive menu safely backs up data before removing derived output, assets, the whole chapter recording, or one reader fragment.
