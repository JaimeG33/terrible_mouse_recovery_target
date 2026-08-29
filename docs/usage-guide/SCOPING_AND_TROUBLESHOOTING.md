# Scoping and Troubleshooting

## The two kinds of scope

### Book scope

A workspace should contain runtime data for one book.

On the first Step 5 capture, the project records the current EPUB book root in:

```text
captures/book-scope.json
```

Future content capture sessions compare the current reader to that root.

If you open a different textbook in the same dedicated Chrome profile, the capture watcher should stop with:

```text
BOOK SCOPE MISMATCH
```

Use a separate project copy/workspace for the second book.

### Chapter scope

Set a chapter before a long recording session so accidentally moving into another chapter does not save it.

Recommended:

```powershell
.\scripts\chapter.ps1 -Chapter 4 -Action capture
```

Alternative:

```powershell
$env:MHE_CHAPTER = "4"
npm run capture
```

If `MHE_CHAPTER` was set manually and you later want unrestricted behavior:

```powershell
Remove-Item Env:MHE_CHAPTER
```

## "Could not connect to Chrome"

Run:

```powershell
npm run chrome:start
```

Then use the Chrome window started by that command.

The app connects to:

```text
http://127.0.0.1:9222
```

unless `MHE_CDP_URL` is changed.

## "No open McGraw Hill reader page"

The dedicated Chrome process is running, but the book reader is not currently open.

In that same dedicated window:

1. open the McGraw Hill bookshelf;
2. sign in;
3. open the eBook;
4. wait for the reader to finish loading;
5. retry `npm run inspect`.

## Capture says `outside-scope`

This is expected when the watcher is scoped to one chapter and the reader is currently in another chapter.

Either navigate to the intended chapter or stop and restart with the correct chapter number.

## `BOOK SCOPE MISMATCH`

The ignored runtime folders already belong to another book.

Do not delete them if you need their captures.

Instead, archive/copy the project or make a separate clone for the other textbook.

## `assets:download` returns HTTP 403

McGraw Hill's EPUB CDN may allow the resource inside the signed-in browser session while rejecting a standalone Node request.

Use:

```powershell
.\scripts\chapter.ps1 -Chapter 2 -Action assets
```

and manually traverse the chapter in the dedicated Chrome window.

## Asset validation shows many missing fonts

Look at the **Direct XHTML assets** section first.

The publisher's global stylesheet can declare many fonts/icons that a particular chapter never uses. These supplemental items do not block the normal proof/build when all directly referenced XHTML assets are present.

## A required opening image is missing

Start the asset watcher while positioned outside the target opening page, then jump into the chapter after the watcher has started. This gives the watcher a chance to observe the image's response.

## PDF fonts differ slightly from the website

Some publisher fonts may not have been cached.

If text, figures, tables, and reading order remain usable, this can be accepted rather than spending time reproducing every publisher font exactly.

## Chrome appears to remain running

Closing the whole dedicated Chrome window is normally sufficient. Step 5 launches it with background mode disabled.

To explicitly close the debugging browser:

```powershell
npm run chrome:stop
```

## The wrong book/chapter was already captured before Step 5

`captures/`, `assets/`, `structure/`, and `output/` are local runtime folders.

Review them before deleting anything.

For a clean second book, the safest method is a separate clone/copy of the project rather than manually mixing and deleting files inside one workspace.
