# Repository Security Review

Review target: source architecture through version 0.6.2.

## Current protections

`.gitignore` excludes:

```text
.chrome-profile/
books/
backups/

# legacy runtime
captures/
structure/
assets/
staging/
output/
```

and common local auth/debug artifacts:

```text
.env*
*.har
cookie/storage/auth-state exports
*.pem
*.key
*.p12
*.pfx
```

## Sensitive local data

`.chrome-profile/` can contain signed-in browser session state.

`books/` can contain captured textbook XHTML, staged/cached assets, output, runtime metadata, and backups.

Neither should be force-added to Git.

## Security command

```powershell
npm run security:check
git status
git diff
```

## Limitations

The built-in security check is path-based. It is not a forensic Git-history audit or complete arbitrary-secret scanner.
