# Repository Security Review

Review target: current `main` branch during Step 5 preparation.

## Current result

No dedicated Chrome profile, textbook captures, cached assets, structure output, or generated chapter PDFs were present as tracked files in the reviewed branch.

The existing `.gitignore` already excluded the main runtime locations:

```text
.chrome-profile/
captures/
structure/
assets/
output/
```

The Step 5 patch expands protection for common `.env`, HAR, cookie/storage-state export, and private-key file patterns.

A repository code search did not reveal an obvious hard-coded API key/password/token credential.

## Important limitation

This review is of the currently accessible repository state and common secret patterns. It is not a forensic audit of every historical Git object or every possible secret format.

Always review:

```powershell
git status
git diff
npm run security:check
```

before pushing.

## Sensitive local data

The most sensitive local directory is:

```text
.chrome-profile/
```

It can contain McGraw Hill login/session state. Never force-add it to Git.

The capture and output directories can contain copyrighted book material and are also intentionally local-only.
