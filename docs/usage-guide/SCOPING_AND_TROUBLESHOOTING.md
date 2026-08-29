# Scoping and Troubleshooting

## Missing image from `reader_01.xhtml`

If XHTML capture succeeds but asset promotion reports a direct image as `not-seen-during-recording`, the image existed in the captured HTML but no usable matching Chrome response was staged.

This can happen when recording begins while that image is already loaded in browser cache.

Version 0.6.5 disables cache during active recording. If you start inside the chapter, manually re-enter its beginning after `READY`.

You do not need to erase the whole chapter to repair one opening asset. Re-run `record`, revisit the affected opening page/fragment, then stop.

## Asset response body warnings

The old one-pass recorder serialized response-body reads. Fast navigation could make later response bodies unavailable before their turn.

Version 0.6.5 reads bodies immediately and only serializes disk/index writes. A failed URL is not permanently marked as seen, so a later manual reload can retry it.

## Partial fallback granularity

Asset health records the captured XHTML file(s) that reference a missing resource.

Partial fallback is applied to those captured fragments.

Because one `reader_N.xhtml` can contain several printed page markers, the current implementation should be described as fragment-level recovery, not guaranteed single-print-page recovery.

## `knownMissing`

Known missing XHTML/text remains blocking.

## Legacy fallback

Use `LEGACY_RECORDING.md` if you want XHTML and assets captured in separate manual passes.
