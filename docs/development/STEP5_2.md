# Step 5.2 - Usability Architecture

Version 0.6 changes the normal user workflow from several low-level commands to:

```text
record -> build
```

## One-pass record

`src/record.mjs` combines:

- event-driven/polling XHTML observation;
- same-book browser response staging.

The response staging is intentionally passive. It saves eligible images/styles/fonts/media that Chrome naturally receives during the user's manual chapter traversal.

At build time, only URLs referenced by the captured chapter inventory are promoted into the chapter asset cache.

## Build pipeline

`scripts/build-chapter.ps1` runs:

1. targeted chapter capture health;
2. asset inventory;
3. staged-asset promotion;
4. asset health;
5. assembly;
6. PDF rendering.

Known missing reader XHTML is a hard stop.

Missing formatting/assets can offer explicit Safe/Plain fallback.

## Fallback render modes

`MHE_RENDER_MODE`:

- `normal`
- `safe`
- `plain`

Normal uses captured publisher CSS where available.

Safe removes publisher classes/inline style and applies simple built-in semantic formatting.

Plain extracts text-first HTML and minimizes formatting dependencies.

## Reset/retry

`scripts/reset-chapter.ps1` and `src/reset-chapter.mjs` back up affected runtime files before reset.

Supported levels:

- output
- assets
- recording
- fragment

## Multi-book runtime

`src/config.mjs` now resolves runtime roots through:

```text
books/active.json
```

Book records live in the Git-ignored `books/index.json`.

`src/book-manager.mjs use-current` identifies the current EPUB root and selects/creates a local book ID.

The installer runs `src/migrate-runtime.mjs` once to move legacy root runtime folders into the book store.

## Project rename

The installer attempts to rename the local project folder to:

```text
to_spite_ghislaine_maxwell
```

before applying version 0.6.

The NPM package name becomes:

```text
to-spite-ghislaine-maxwell
```

This does not automatically rename the GitHub repository.
