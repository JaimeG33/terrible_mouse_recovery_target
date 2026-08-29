# Step 5.2.1 - Partial Migration Repair

## Failure that prompted this repair

The first Step 5.2 installer successfully moved:

```text
captures/
assets/
structure/
```

into:

```text
books/sn_481c/
```

but Windows refused to rename the old `output/` directory:

```text
EPERM: operation not permitted
```

Because the original migration wrote `books/active.json` only **after** every directory move succeeded, this left the runtime half-migrated:

```text
books/sn_481c/captures/   present
books/sn_481c/assets/     present
books/sn_481c/structure/  present

books/active.json         not yet written
legacy output/            still at project root
```

Without `active.json`, `src/config.mjs` resolves runtime paths to:

```text
books/_unselected/
```

so the already-moved captures would appear missing to later commands.

## Repair behavior

Version 0.6.1 makes migration idempotent and recovery-friendly.

It:

1. detects a partially migrated book from `books/<bookId>/captures/`;
2. writes/repairs `books/index.json` and `books/active.json` **before** cleanup;
3. merges any remaining legacy runtime directories instead of requiring a completely empty destination;
4. copies missing files rather than relying on a directory-level rename;
5. treats a locked legacy `output/` directory as noncritical;
6. leaves locked legacy files in place with a warning instead of aborting;
7. writes `books/migration-report.json`;
8. adds `npm run runtime:doctor`.

## Why `output/` is noncritical

`output/` contains generated HTML/PDF files.

The authoritative recovery inputs are the captured XHTML and required assets. Existing output can be regenerated.

Therefore a PDF viewer, Explorer preview, antivirus scanner, or other Windows process holding an old PDF open should not prevent the multi-book runtime from becoming usable.

## Folder rename

The local project directory rename is intentionally deferred.

The prior attempt was launched while the user's parent PowerShell/VS Code environment still had the project directory open. Windows can refuse a directory rename while another process has a working-directory or file handle inside it.

The source code no longer relies on the old folder name, so leaving the local directory as:

```text
terrible_mouse_recovery_target
```

does not prevent version 0.6.x from functioning.

Perform the cosmetic folder rename later, after closing VS Code, dedicated Chrome, PDF viewers, Explorer windows previewing project files, and shells whose current directory is inside the project.
