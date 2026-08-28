# Step 3 — Referenced Asset Preservation

Step 3 begins with Chapter 1 only.

The goal is to preserve the images, stylesheets, fonts, and other file assets directly referenced by XHTML fragments that Step 1 already captured. The script does not guess asset names or crawl unrelated book paths.

## Why Chapter 1 is enough for this step

The complete TOC tree has already been mapped, including all 13 chapters. We do not need to manually traverse the whole book before testing the asset layer.

Chapter 1 currently has `reader_1.xhtml` through `reader_6.xhtml` captured and no missing `reader_N.xhtml` links known from those captured fragments. That makes it a useful proof-of-concept dataset, but it still does **not** prove every possible Chapter 1 spine item has been captured.

## Structure report correction

Step 3 also corrects Chapter 13's inferred TOC boundary. Its end is now inferred from the next top-level TOC item (`Index`) instead of requiring a nonexistent Chapter 14.

Run:

```powershell
npm run structure
```

The output now includes `tocEnd`.

## 1. Inventory Chapter 1 assets

```powershell
npm run assets:inventory
```

Expected output:

```text
Chapter: 1
Captured XHTML fragments scanned: 6
Referenced assets found: <number>
```

The inventory is written to:

```text
assets/chapter01/inventory.json
```

## 2. Download only those referenced assets

```powershell
npm run assets:download
```

This downloads URLs explicitly referenced by the already-captured XHTML. For stylesheets, it also follows `url(...)` dependencies inside the downloaded CSS so fonts/background images required by those styles can be preserved.

Files are stored as hashed cache files under:

```text
assets/chapter01/cache/
```

Failures are recorded in the inventory rather than silently ignored.

## 3. Validate

```powershell
npm run assets:validate
```

Ideal result:

```text
Missing: 0
```

If anything is missing, send the validation output and the `Failed:` count from `assets:download`.

## Another chapter

Step 3 defaults to Chapter 1.

To test another captured chapter later:

```powershell
$env:MHE_CHAPTER = "3"
npm run assets:inventory
npm run assets:download
npm run assets:validate
Remove-Item Env:MHE_CHAPTER
```

## GitHub

`assets/` remains ignored by Git because it contains local copies of textbook resources.

Push the Step 3 source code and docs, not the cached textbook assets.

## Next step

Once Chapter 1's asset validation is healthy, Step 4 can rewrite the captured XHTML to point at the local asset cache and render a Chapter 1 PDF proof of concept.
