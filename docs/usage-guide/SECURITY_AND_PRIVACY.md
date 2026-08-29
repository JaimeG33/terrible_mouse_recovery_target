# Security and Privacy

## Dedicated Chrome profile

The dedicated browser uses:

```text
.chrome-profile/
```

and local CDP access intended for:

```text
127.0.0.1:9222
```

The profile can contain cookies, storage, history, preferences, and Chrome-managed credentials if the user explicitly saves them.

Treat it as sensitive.

## Credential behavior

The application does not export McGraw Hill cookies/auth headers into scripts.

The one-pass recorder observes rendered XHTML and eligible asset responses Chrome naturally receives during manual navigation.

## Per-book runtime

Version 0.6+ stores local runtime under:

```text
books/
```

including captures, staging, assets, structure, output, and backups.

`books/` is Git-ignored.

## Do not commit

```text
.chrome-profile/
books/
backups/

# legacy runtime if present
captures/
assets/
staging/
structure/
output/

.env*
*.har
cookie/auth/storage-state exports
private keys/certificates
```

## Before sharing source changes

```powershell
npm run security:check
git status
git diff
```

The security checker is path-based, not a complete secret scanner.

## Captured/generated book content

Captured XHTML, assets, output, and backups may contain substantial book content.

Share them only as permitted by your access rights and applicable rules.
