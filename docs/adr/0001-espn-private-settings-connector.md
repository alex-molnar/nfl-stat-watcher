# ADR 0001: Read private ESPN settings through a browser companion

**Status:** Proposed; authenticated API proof pending. Private leagues now import by pasting the signed-in settings page (see `docs/league-import.md`), so the extension is optional.  
**Date:** 2026-10-04

## Context

Anonymous ESPN `mSettings` and `mRoster` reads work from the local app origin for public league `1900128084`. A private league, `409479118`, returns 401 from both anonymous requests and requests made with `credentials: include`, even while the user is signed into ESPN in Chrome. The same signed-in account can read the private league's settings in ESPN's own page.

The application is statically hosted. It has no backend that can safely acquire, store or refresh ESPN credentials. A proxy would not establish authorization, and asking users to paste ESPN cookies would expose credentials to the app.

## Decision

Continue with a browser companion as the candidate private connector. The app-origin request is denied even with `credentials: include`, and Chrome documents that content-script fetches remain subject to page CORS. The current candidate uses the extension service worker's cross-origin fetch with exact host permissions, opens or reuses an ESPN tab, and sends the app only an allowlisted, size-limited settings snapshot. Anonymous and companion results converge on the same runtime validation, normalization, preview and local persistence pipeline. Whether extension request credentials satisfy ESPN authorization under Chrome's cookie policy remains unverified.

The companion must use exact production and development app-origin allowlists, exact ESPN host access, one-time request nonces and exact league/season binding. It must not request cookie access, transmit account identifiers, or persist session credentials. If a needed permission cannot be avoided, stop and record the permission and user-visible warning before requesting it. Disconnecting an imported profile removes its source metadata and retains local scoring values; disabling the companion itself is managed through Chrome's extension settings because its origin allowlist is fixed in the manifest.

The extension can be treated as a candidate implementation until its authenticated `mSettings` request is proven in a supported browser. A 401/403 is reported as access denial because ESPN's response does not prove whether the user needs to sign in or lacks membership. If the request fails, revisit the connector design before presenting private import as supported.

## Consequences

- Public import remains available without an ESPN connection.
- Private import depends on an installed companion and the user's ESPN session in the supported browser.
- An extension host-permission prompt is a meaningful user choice and must explain the narrow origins and purpose.
- Extension distribution, fixed ID, browser support, expiration behavior and reconnect continuation need validation before release.
- A backend proxy is not a fallback unless its separate authenticated credential lifecycle is designed and reviewed.

## Security references

- [Chrome extension permission guidance](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions): prefer optional, narrowly scoped host permissions.
- [Chrome extension messaging guidance](https://developer.chrome.com/docs/extensions/develop/concepts/messaging): validate and sanitize messages from less-trusted content scripts and pages.
- [Chrome cookies API](https://developer.chrome.com/docs/extensions/reference/cookies): cookie access needs an explicit `cookies` permission; this design does not request it.
