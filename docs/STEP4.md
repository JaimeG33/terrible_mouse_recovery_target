# Step 4 - Chapter 1 Reconstruction and PDF Proof

Step 4 turns the already-captured Chapter 1 XHTML fragments into one continuous local HTML document and one PDF proof.

It does **not** navigate the textbook, discover hidden chapter URLs, or fetch uncaptured book pages.

## Step 3 status

The missing Chapter 1 opening image `des00673_co01.png` has now been captured through the signed-in browser response.

The old raw validator counted every font and icon declared inside McGraw Hill's generic stylesheet as mandatory. That inflated the result to more than one hundred missing resources.

Step 4 changes the normal `assets:validate` command so:

- assets referenced directly by captured XHTML are required;
- generic CSS-declared resources are reported separately;
- missing generic stylesheet dependencies do not block the reconstruction proof.

The old behavior remains available as:

```powershell
npm run assets:validate:raw
```

## 1. Validate the direct Chapter 1 resources

```powershell
npm run assets:validate
```

Expected:

```text
Direct XHTML assets (required for reconstruction)
  Present: 10
  Missing: 0
  Total:   10

PASS
```

The supplemental CSS section may still report many missing/unobserved resources. That is expected for the generic publisher stylesheet.

## 2. Assemble the continuous HTML

```powershell
npm run assemble
```

This reads the six locally captured Chapter 1 XHTML fragments, preserves their semantic HTML, headings, alt text, and page content, removes active scripts/iframes, and rewrites cached images/stylesheets to local file URLs.

Output:

```text
output/chapter01/chapter01.html
```

Open this file in Chrome first. It should display Chapter 1 continuously instead of one reader fragment at a time.

HTML is also useful as an accessibility fallback because it can reflow and remains selectable/searchable.

## 3. Render the PDF

Keep the dedicated Chrome instance open because the project uses its CDP connection as the Chromium renderer.

Run:

```powershell
npm run pdf
```

Output:

```text
output/chapter01/chapter01.pdf
```

The PDF renderer requests background graphics and tagged PDF output.

## One-command proof

After the patch is installed you can run:

```powershell
npm run proof
```

That performs:

1. direct asset validation;
2. Chapter 1 HTML assembly;
3. Chapter 1 PDF rendering.

## Inspect before scaling up

Do not capture the rest of the textbook yet.

First compare `chapter01.html` and `chapter01.pdf` against the reader. Check:

- beginning of Chapter 1;
- all important figures;
- headings and learning-objective boxes;
- tables/callouts;
- the point where reader_01 becomes reader_02;
- later reader-fragment transitions;
- final page of Chapter 1.

If content is complete but typography differs slightly, that most likely comes from publisher fonts declared in the generic CSS but not cached. We can decide after viewing the proof whether those fonts are worth capturing.

If content is missing, duplicated, clipped, or in the wrong order, stop before capturing the remaining chapters and fix the assembler first.

## Later output layout

The eventual structure will be:

```text
output/
  chapter01/
    chapter01.html
    chapter01.pdf
  chapter02/
    chapter02.html
    chapter02.pdf
  ...
  chapters/
    chapter01.pdf
    chapter02.pdf
    ...
  Strategic_Management_Complete.pdf
```

The combined master PDF is a later step after each chapter has passed the reconstruction proof.
