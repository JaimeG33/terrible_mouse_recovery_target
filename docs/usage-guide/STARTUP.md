# Startup Guide

## Requirements

Install:

1. Google Chrome
2. VS Code
3. Node.js 20 or newer
4. Git if cloning the repository

Recommended VS Code extension:

- PowerShell by Microsoft

No browser extension is required.

## Install dependencies

```powershell
npm install
```

`playwright-core` is the only project dependency.

## Start dedicated Chrome

```powershell
npm run chrome:start
```

This uses a separate project-local profile:

```text
.chrome-profile/
```

Sign into your existing McGraw Hill account and open the book.

## Verify the reader

```powershell
npm run inspect
```

A supported normal reader fragment should resemble:

```text
.../OPS/.../chapter01/reader_1.xhtml
```

## Book registration / runtime

Normal `Action record` automatically selects the current book.

Diagnostics:

```powershell
npm run book:use-current
npm run books
npm run runtime:doctor
```

Runtime data is isolated per book under:

```text
books/<bookId>/
```

## TOC for a new book

After selecting the intended book:

```powershell
npm run toc
npm run structure
```

Usually this is needed once per book, not once per chapter.

## Record/build

```powershell
.\scripts\chapter.ps1 -Chapter 1 -Action record
```

Wait for:

```text
ONE-PASS CHAPTER RECORDING READY
```

before navigating.

Then manually traverse the chapter and press `Ctrl+C`.

Build:

```powershell
.\scripts\chapter.ps1 -Chapter 1 -Action build
```

Keep dedicated Chrome running through PDF rendering.

## Important Windows PowerShell note

Version 0.6.2 avoids using generic `npm` for multi-step PowerShell orchestration.

Windows can resolve `npm` to `npm.ps1`, and that shim's `exit` behavior can terminate a parent `.ps1` workflow after the first npm command.

The chapter recorder therefore runs its two Node stages directly, while the build orchestrator uses `npm.cmd`.

If `Action record` returns immediately after `Active book selected` without ever printing `ONE-PASS CHAPTER RECORDING READY`, update to 0.6.2 or newer.

## Migration

For older installations:

```powershell
npm run runtime:migrate
npm run runtime:doctor
```

## Before publishing

```powershell
npm run security:check
git status
```

Do not force-add `.chrome-profile/`, `books/`, `backups/`, or legacy runtime folders.
