# Recovery and Fallbacks

## Missing opening image after an otherwise successful one-pass recording

A direct image can be listed as:

```text
not-seen-during-recording
```

when its XHTML was captured but Chrome never emitted an observable resource response after the recorder attached.

This is most likely when the image was already loaded/cached before recording began.

Version 0.6.5 improves this in two ways:

1. Chrome cache is disabled only while `record` is active, then restored.
2. Asset response bodies are read immediately rather than waiting in a serialized queue.

If recording starts while already inside the target chapter, wait for `ONE-PASS CHAPTER RECORDING READY`, then manually re-enter the beginning through the TOC. With cache disabled, this revisit should generate fresh opening-resource responses.

For an already complete chapter, you can re-run `record`, revisit only the affected opening page/fragment, then press `Ctrl+C`. Existing good XHTML is deduplicated.

## Automatic fallback choices

When direct assets are missing, automatic build mode offers:

```text
[1] Stop and re-record/repair the affected page/fragment
[2] SAFE formatting for the whole chapter
[3] BARE-BONES text for the whole chapter
[4] Normal formatting except affected page/fragment(s)
```

Choice 4 then asks whether the affected fragment should use Safe or Bare Bones formatting.

The affected region is identified from the captured XHTML file(s) that reference the missing asset. A reader XHTML fragment can contain more than one print page, so partial fallback currently operates at captured-fragment granularity rather than promising a single printed page.

## Partial fallback

Possible outputs:

```text
chapter03_partial-safe.pdf
chapter03_partial-bare-bones.pdf
```

All unaffected captured fragments remain in normal publisher-style reconstruction.

Only affected captured fragments have publisher-specific formatting stripped or converted to text.

If the partial attempt fails, the build asks again without option 4.

## Important limitation for missing images

Safe or partial-safe formatting does not recreate an image that was never captured.

For a missing image, fallback inserts/retains a visible missing-image indicator where possible and preserves the rest of the chapter.

For a visually complete copy, re-record the affected page/fragment.

## Whole-chapter alternatives

Safe:

```text
chapter03_safe-formatting.pdf
```

Bare Bones:

```text
chapter03_bare-bones.pdf
```

Normal successful output remains:

```text
chapter03.pdf
```

Known missing XHTML/text remains a hard stop and is never hidden by formatting fallback.
