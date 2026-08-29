# Multiple Books

Version 0.6+ stores runtime data separately for each locally registered McGraw Hill book.

## Registry

```powershell
npm run books
```

Layout:

```text
books/
  index.json
  active.json
  <bookId>/
    captures/
    assets/
    staging/
    structure/
    output/
    backups/
```

## Selecting a book

Normal users usually do not select one manually.

`Action record` first selects/registers the McGraw Hill book currently open in dedicated Chrome, then starts the one-pass recorder.

Manual selection:

```powershell
npm run book:use-current
```

## Same chapter numbers across books

Safe:

```text
books/book_a/captures/chapter01/
books/book_b/captures/chapter01/
```

## Runtime health

```powershell
npm run runtime:doctor
```

## Migration

```powershell
npm run runtime:migrate
```

Version 0.6.1+ can repair partially completed migration.

## Friendly title limitation

The registry title is currently derived from observed reader/browser document metadata.

McGraw Hill can expose a section-level title such as `Introduction`, so the friendly title may not equal the full textbook title.

Stable identity uses the local `bookId` and EPUB `bookRoot`.
