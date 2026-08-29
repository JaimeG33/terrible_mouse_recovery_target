# Step 5.2.5 - Asset Reliability / Partial Fallback

## Chapter 3 observation

Chapter 3 XHTML capture completed and asset inventory found seven direct resources.

Six were promoted from one-pass staging.

The missing resource was:

```text
img/chapter03/des00673_co03.png
```

referenced by:

```text
chapter03/reader_01.xhtml
```

The one-pass recording log contained no response-body warning for that URL.

That indicates the recorder never observed a matching resource response after its listener attached. Because recording began while Chapter 3 was already displayed, browser caching is the strongest explanation.

## Recording changes

### Temporary cache disable

During `record`, a CDP session sends:

```text
Network.setCacheDisabled(cacheDisabled=true)
```

and restores cache afterward.

No automatic chapter navigation is added. The user still manually revisits the chapter beginning.

### Immediate body reads

Response bodies now begin reading immediately.

Only file/index writes remain serialized.

Failed body reads are retryable if the URL appears in a later Chrome response.

## Partial fallback

Asset health now records:

```text
problemFragments
```

from direct missing-resource references.

New render modes:

```text
partial-safe
partial-plain
```

Normal styling is retained for unaffected captured XHTML.

Only listed affected fragments use Safe or Bare Bones reconstruction.

If partial assembly/PDF fails during automatic recovery, the next prompt omits the partial option.

## Output naming

```text
normal         chapter03.pdf
safe           chapter03_safe-formatting.pdf
plain          chapter03_bare-bones.pdf
partial-safe   chapter03_partial-safe.pdf
partial-plain  chapter03_partial-bare-bones.pdf
```

The HTML document title receives a matching descriptive suffix.

## Limitation

Partial fallback is fragment-scoped, because the health report knows which captured XHTML resource references the problem.

A single XHTML fragment can span multiple printed page markers.

Missing-image fallback does not recreate the absent image; it preserves surrounding content and uses an explicit missing-image indicator where possible.
