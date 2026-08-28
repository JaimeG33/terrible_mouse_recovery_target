# Step 2 — Reader Structure Discovery

Step 2 maps the reader's already-visible Table of Contents and compares it with the XHTML fragments captured in Step 1.

It does not crawl URLs, fetch unrendered textbook files, extract credentials, or auto-navigate the book.

## Goal

We need two different maps:

1. The reader's official TOC/spine map.
2. The `chapterNN/reader_N.xhtml` fragments that have actually been observed or referenced by already-captured XHTML.

These are related but not necessarily one-to-one.

## Run

Keep the dedicated Chrome profile open with the McGraw Hill eBook loaded.

### Capture the TOC

```powershell
npm run toc
```

The script attempts to open the Contents drawer and expand its tree. If it cannot find the Contents button automatically, open the Contents panel manually, select the Table of Contents tab, then rerun the command.

Output:

```text
structure/toc.json
```

The file records:

- TOC labels
- hierarchy levels
- `data-spine-pos`
- node IDs
- hashes
- current-location metadata

### Analyze captured fragments against the TOC

```powershell
npm run structure
```

Output:

```text
structure/discovery-report.json
```

The terminal table shows:

- chapter number
- TOC start spine position
- reader fragments already captured
- reader fragments referenced by captured XHTML
- referenced fragments that have not yet been captured

Example:

```text
chapter  captured    discovered       missingKnown
1        1,2,3,4     1,2,3,4,5,6      5,6
```

That means the local capture proves links to `reader_5.xhtml` and `reader_6.xhtml` exist, but those two fragments have not yet been observed by the capture watcher.

## Test procedure for Step 2

1. Leave the dedicated Chrome profile open and signed in.
2. Open the eBook.
3. Run:

```powershell
npm run toc
```

4. Confirm the top-level table includes Chapters 1 through 13.
5. Run:

```powershell
npm run structure
```

6. Save the terminal output.
7. Start the existing capture watcher:

```powershell
npm run capture
```

8. Manually continue through Chapter 1 until you enter Chapter 2.
9. Stop the watcher with `Ctrl+C`.
10. Run:

```powershell
npm run structure
```

again.

For a successful test, the Chapter 1 `missingKnown` list should shrink as referenced fragments are captured.

## Files and GitHub

`structure/` is local analysis output and is ignored by Git.

The code and documentation can be pushed to GitHub. Keep these local-only paths out of the repository:

```text
.chrome-profile/
captures/
structure/
output/
```
