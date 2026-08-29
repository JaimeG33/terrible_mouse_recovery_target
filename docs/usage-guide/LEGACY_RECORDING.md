# Legacy Recording Workflow

This workflow is retained as a fallback and diagnostic path.

It follows the same overall method that was successfully used while developing the Chapter 1 and Chapter 2 proofs: XHTML is captured during one manual chapter traversal, the resulting XHTML is inventoried, then the browser-response asset watcher runs during a second manual traversal.

It is slower than the recommended one-pass recorder because the user normally traverses the chapter twice.

## Why the old workflow was reliable

The historical long-running tools were independent Node processes:

```text
capture.mjs
assets-capture.mjs
```

Each one:

1. connected to the already-running Chrome instance over CDP;
2. stayed alive while the user manually navigated;
3. stopped after `Ctrl+C`;
4. explicitly terminated its own Node process, dropping the CDP websocket without closing Chrome.

There was no short-lived CDP book-selection process that another command had to wait for.

Version 0.6.3 applies that same lifecycle rule to `book-manager.mjs use-current`.

## Preferred legacy wrapper

### 1. XHTML capture

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action capture
```

The wrapper first selects the currently open McGraw Hill book, then starts the standalone XHTML watcher.

You should see:

```text
Capture watcher started.
```

Manually traverse the entire chapter.

Stop with:

```text
Ctrl+C
```

### 2. Build the asset inventory

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action inventory
```

### 3. Start the standalone asset watcher

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assets
```

You should see:

```text
Browser-response asset capture started.
```

Manually traverse the chapter a second time.

Stop with:

```text
Ctrl+C
```

### 4. Validate

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action validate
```

### 5. Assemble

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action assemble
```

### 6. Render PDF

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action pdf
```

Or after asset capture, use:

```powershell
.\scripts\legacy-chapter.ps1 -Chapter 3 -Action proof
```

to run asset validation, assembly, and PDF rendering.

## Historical-style commands already preserved

The current normal chapter wrapper also retains the old low-level action names:

```powershell
.\scripts\chapter.ps1 -Chapter 3 -Action capture
.\scripts\chapter.ps1 -Chapter 3 -Action inventory
.\scripts\chapter.ps1 -Chapter 3 -Action assets
.\scripts\chapter.ps1 -Chapter 3 -Action validate
.\scripts\chapter.ps1 -Chapter 3 -Action assemble
.\scripts\chapter.ps1 -Chapter 3 -Action pdf
```

For those commands, make sure the intended book is active first:

```powershell
npm run book:use-current
```

The dedicated `legacy-chapter.ps1` wrapper is safer because its `capture` action automatically performs book selection first and invokes the standalone Node tools directly.

## Multi-book difference from the historical version

The old Chapter 1/2 code stored assets directly under the project root.

Version 0.6.3 keeps the **behavior** of the legacy workflow but uses the current per-book runtime:

```text
books/<bookId>/captures/
books/<bookId>/assets/
books/<bookId>/output/
```

This is intentional. Restoring the old root-level paths exactly would break multi-book isolation.

## When to use legacy mode

Use it when:

- diagnosing the one-pass recorder;
- a future regression affects staged asset capture;
- you want to separate XHTML capture from asset capture to identify which side is failing.

For normal chapters, prefer:

```text
record -> status -> build
```

because it requires only one manual chapter traversal.
