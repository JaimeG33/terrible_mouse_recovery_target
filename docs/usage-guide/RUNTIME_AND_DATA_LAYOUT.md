# Runtime and Data Layout

## Top-level local state

```text
.chrome-profile/
books/
```

`.chrome-profile/` contains the dedicated Chrome profile and may include signed-in session data.

`books/` contains the local multi-book registry and per-book recovery data.

Both are Git-ignored.

## Registry

```text
books/index.json
books/active.json
```

Check indirectly with:

```powershell
npm run books
npm run runtime:doctor
```

## Per-book layout

```text
books/<bookId>/
  captures/
  assets/
  staging/
  structure/
  output/
  backups/
```

### `captures/`

Primary captured XHTML plus `manifest.json`.

This is the most important recovery data.

Use the reset command rather than manually deleting manifest entries.

### `staging/`

Browser asset responses observed during one-pass `record`.

Intermediate data.

### `assets/`

Asset inventory/cache plus validation/promotion reports.

Derived from captured XHTML and staged browser responses.

### `structure/`

TOC/structure analysis.

Usually regeneratable with:

```powershell
npm run toc
npm run structure
```

### `output/`

Generated HTML/PDF/build reports.

Fully derived and safest to rebuild.

### `backups/`

Timestamped recovery copies made by reset operations.

## Importance order

```text
captures/        highest importance
staging/assets/  rebuildable/re-observable
structure/       regeneratable
output/          fully derived
```

## Migration

Older root runtime folders can be repaired/migrated with:

```powershell
npm run runtime:migrate
npm run runtime:doctor
```

A legacy root `output/` can remain if Windows holds a file open.

## Moving/renaming the project

Paths are derived from the current code location.

After moving/renaming:

```powershell
npm run runtime:doctor
npm run books
npm run status
```

The project folder name and GitHub repo name do not determine book identity.
