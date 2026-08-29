# Security and Privacy

## Dedicated Chrome profile

The special Chrome window is launched with:

- a project-local `--user-data-dir=.chrome-profile`;
- Chrome DevTools Protocol on a local loopback address;
- a separate profile from normal Chrome.

That profile can contain browser cookies, local/session storage, site preferences, history, and other browser-profile data. If you choose to save credentials in that Chrome profile, it can also contain Chrome-managed credential information.

Treat `.chrome-profile/` as sensitive local data.

It is Git-ignored.

## Does the application copy login credentials?

The capture code does not call Chrome APIs to export cookies or authentication headers.

The browser-response asset workflow listens to resource responses that the signed-in browser naturally receives while you navigate.

## Remote debugging risk

While the dedicated debugging browser is running, local software that can access its CDP endpoint may be able to control that browser profile.

The startup script binds the intended debugging address to:

```text
127.0.0.1
```

Do not expose the debugging port to another machine or run untrusted local programs while using the dedicated signed-in profile.

## Files that should never be committed

Keep these local:

```text
.chrome-profile/
captures/
structure/
assets/
output/
.env*
*.har
cookie/auth/storage-state exports
private keys/certificates
```

The repository's `.gitignore` covers these common cases.

Before sharing changes:

```powershell
npm run security:check
git status
```

The security check is deliberately conservative and path-based. It is not a replacement for reviewing a diff before publishing it.

## Textbook content

`captures/`, `assets/`, and `output/` can contain substantial book content. They are excluded from the source repository.

Share generated content only in ways permitted by your access rights and applicable rules.
