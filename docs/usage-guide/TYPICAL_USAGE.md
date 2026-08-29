# Typical Usage

This is the normal workflow for turning a chapter that you can access in the McGraw Hill reader into a local continuous HTML file and PDF.

The workflow intentionally requires you to navigate the book yourself.

## 1. Start Chrome

```powershell
npm run chrome:start
```

Use the dedicated Chrome window, sign in, and open the correct book.

## 2. Record one chapter's XHTML

Example for Chapter 2:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action capture
```

Then manually:

1. go to the start of Chapter 2;
2. move through the chapter in normal reader order;
3. allow each reader section to render;
4. continue until you reach the beginning of Chapter 3;
5. return to the PowerShell terminal and press `Ctrl+C`.

The chapter wrapper sets `MHE_CHAPTER=2` only for that command. If you accidentally enter Chapter 1 or Chapter 3, the content watcher reports `outside-scope` and does not save that chapter.

Review progress:

```powershell
npm run status
npm run structure
```

## 3. Build the chapter asset inventory

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action inventory
```

This reads the locally captured XHTML and records the images/stylesheets/media it directly references.

## 4. Record the chapter's browser-loaded assets

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action assets
```

While that command is running, manually traverse/scroll Chapter 2 again.

This watcher saves matching resource responses that the signed-in Chrome reader naturally receives. It does not copy your cookies or authentication tokens into the project.

Stop with `Ctrl+C`.

## 5. Validate required assets

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action validate
```

The important result is:

```text
Direct XHTML assets (required for reconstruction)
  Missing: 0
```

Generic fonts/icons declared by a publisher stylesheet may remain listed as supplemental/unobserved. Slight font substitution is acceptable if the resulting chapter remains usable.

## 6. Assemble the continuous HTML

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action assemble
```

Output:

```text
output/chapter02/chapter02.html
```

Open the HTML and spot-check the beginning, figures, tables/callouts, reader-fragment transitions, and the end.

## 7. Build the PDF

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action pdf
```

Output:

```text
output/chapter02/chapter02.pdf
```

Repeat the same workflow for Chapter 3, Chapter 4, and so on.

## 8. Shut down the dedicated browser

Closing the dedicated Chrome window normally is fine.

If you specifically want the project to close the debugging browser and ensure that session is no longer running:

```powershell
npm run chrome:stop
```

The `.chrome-profile` directory remains on disk so the next launch can reuse site login/session state until McGraw Hill expires it or you sign out.
