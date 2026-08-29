# Multiple Books

Version 0.6 stores runtime data per book.

## Registry

List local books:

```powershell
npm run books
```

The registry is local and Git-ignored.

Files:

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

Normal users do not need to select a book manually.

When you run:

```powershell
.\scripts\chapter.ps1 -Chapter 1 -Action record
```

the tool examines the McGraw Hill book currently open in the dedicated Chrome reader and selects/registers it before recording.

Manual command:

```powershell
npm run book:use-current
```

## Two books can both have Chapter 1

They are isolated:

```text
books/sn_book_a/captures/chapter01/
books/sn_book_b/captures/chapter01/
```

so they cannot overwrite each other.

## Existing pre-0.6 data

The Step 5.2 installer migrates the old root-level:

```text
captures/
assets/
structure/
staging/
output/
```

into the local multi-book store when possible.

The migration does not upload book data anywhere.
