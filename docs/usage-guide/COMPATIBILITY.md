# Compatibility

The application is not hardcoded to one textbook title, but it is not guaranteed to support every McGraw Hill product.

## Current reader assumptions

The current adapter expects conventions similar to:

- a known McGraw Hill reader UI;
- `iframe#clo-iframe`;
- normal resources resembling:

```text
/chapter01/reader_1.xhtml
```

- a readable McGraw Hill TOC tree.

## Chapter count

There is no hardcoded 13-chapter limit.

Compatible books can have different chapter counts.

## Non-standard XHTML

Same-book XHTML that does not match the normal reader filename can be preserved as an auxiliary fragment during scoped manual recording.

## Potential incompatibilities

Development changes may be required for:

- legacy McGraw Hill readers;
- PDF-only products;
- redesigned iframe/DOM structure;
- unrelated chapter resource naming;
- TOCs without recognizable chapter labels;
- highly interactive/script-dependent material.

## Identification

The application isolates books by EPUB root/local book ID.

It does not currently identify books from an ISBN/catalog service.

The registry's friendly title may be a page/section title rather than the full textbook title.

## Completeness

A successful build proves that the locally captured material could be validated and rendered.

It does not by itself prove the user manually visited every intended section.

Use:

```powershell
npm run status
npm run structure
```

and visually spot-check finished output.
