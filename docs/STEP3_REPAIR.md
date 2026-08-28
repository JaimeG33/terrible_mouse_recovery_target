# Step 3 Repair — 403 Asset Responses

## What failed

The original Step 3 downloader used Node's standalone `fetch()`.

The McGraw Hill EPUB CDN returned HTTP 403 for the textbook CSS and images, while the reader-hosted iframe stylesheet returned HTTP 200. This shows that direct Node requests do not have the same request context as the signed-in reader.

## Repair approach

This repair does not make direct requests to the protected asset URLs.

Instead, it attaches to the same dedicated Chrome session already used by the reader and listens for resource responses that Chrome itself receives while you navigate normally.

Only URLs already present in the Chapter asset inventory are saved.

When an inventoried stylesheet is captured, `url(...)` dependencies inside that stylesheet are added to the watch list so fonts or background images can also be preserved when Chrome requests them.

## Test

Keep the dedicated Chrome window open and signed in.

Start from Chapter 1 and run:

```powershell
npm run assets:capture
```

Then, in the dedicated Chrome reader:

1. Navigate back to the beginning of Chapter 1.
2. Move through all of Chapter 1 normally.
3. Scroll through each displayed section so lazy-loaded images have a chance to load.
4. Continue until Chapter 2 begins.
5. Return to Chapter 1 once and move through it again if the capture reports new CSS dependencies near the end of the first pass.
6. Stop the watcher with `Ctrl+C`.

Then run:

```powershell
npm run assets:validate
```

A healthy result is:

```text
Missing: 0
```

The inventory may contain more than the original 10 assets after CSS dependencies are discovered.

## If some assets remain missing

Run `npm run assets:capture` again, revisit Chapter 1, and reload or scroll the relevant sections.

Do not use `npm run assets:download` as the success criterion for protected EPUB assets; it remains useful diagnostically, but the browser-response capture is the intended recovery path for 403-protected resources.

## Local files

The cached resources remain under:

```text
assets/chapter01/cache/
```

The long hash filenames are intentional. `inventory.json` maps every original resource URL to its local hashed filename.

The cache remains excluded from GitHub.
