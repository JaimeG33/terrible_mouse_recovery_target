# terrible_mouse_recovery_target

Step 1 is a local capture harness for the XHTML fragments that the McGraw Hill reader has already rendered in `iframe#clo-iframe`.

## Scope of this step

This version deliberately does **not**:

- guess or crawl `reader_*.xhtml` URLs;
- copy cookies, authorization headers, or account credentials;
- auto-navigate the textbook;
- attempt to bypass access controls;
- build the final PDF yet.

It does:

- connect to a dedicated local Chrome debugging session;
- find the open McGraw Hill reader page;
- inspect `iframe#clo-iframe`;
- capture each unique XHTML fragment as you navigate normally;
- preserve the iframe `<base href>` and XHTML markup;
- record a manifest with chapter/reader numbers, page-break markers, hashes, and discovered reader links.

## 1. Start the dedicated Chrome window

From the VS Code PowerShell terminal:

```powershell
cd "D:\ZeTechProjects\terrible_mouse_recovery_target"
.\scripts\start-chrome.ps1
```

A dedicated Chrome profile opens at the McGraw Hill bookshelf.

Sign in if needed and open the eBook.

The dedicated profile exists because modern Chrome restricts remote debugging against the normal default profile. It is stored under `.chrome-profile/` and is excluded from Git.

## 2. Verify the reader is visible

With the eBook open:

```powershell
npm run inspect
```

Expected output should include values resembling:

```text
chapter            1
readerFragment     1
baseHref           .../chapter01/reader_1.xhtml
pageBreakCount     ...
linkedReaderFragments ...
```

If this succeeds, the collector can see the already-rendered iframe.

## 3. Run the capture watcher

```powershell
npm run capture
```

Leave that terminal running.

Navigate through the McGraw Hill reader manually. When the reader changes to a new XHTML spine fragment, the watcher saves it once.

Example output:

```text
[captured] chapter=1 reader=1 pages=2, 3, 4, 5 -> chapter01/reader_01.xhtml
[captured] chapter=1 reader=2 pages=6, 7, 8 -> chapter01/reader_02.xhtml
```

Stop the watcher with:

```text
Ctrl+C
```

## 4. Validate the current capture set

```powershell
npm run validate
```

This reports which reader fragments have been captured for each chapter and whether there are internal numbering gaps.

It does **not** yet prove that a chapter is complete. In the next step we will compare captures against the reader's actual TOC/navigation metadata.

## Captured data

Runtime content is stored under:

```text
captures/
```

and the manifest is:

```text
captures/manifest.json
```

Both `captures/` and `.chrome-profile/` are intentionally ignored by Git.

Do not remove those `.gitignore` entries before publishing the project. The GitHub repository should contain the capture tooling, not your login profile or textbook content.

## Environment variables

Default Chrome DevTools port:

```text
9222
```

Override it if needed:

```powershell
$env:MHE_CDP_URL = "http://127.0.0.1:9333"
npm run inspect
```

Default capture poll interval is 1000 ms:

```powershell
$env:MHE_POLL_MS = "1500"
npm run capture
```

## Planned next steps

After Chapter 1 capture is verified:

1. Determine the authoritative spine/TOC order.
2. Confirm the final fragment count for every chapter.
3. Capture assets needed for an offline render without harvesting credentials.
4. Normalize the captured XHTML into a continuous document.
5. Render a Chapter 1 proof-of-concept PDF.
6. Validate text, figures, tables, page markers, and reading order.
7. Scale the verified process to Chapters 1–13.
8. Assemble the final local PDF with bookmarks and metadata.
