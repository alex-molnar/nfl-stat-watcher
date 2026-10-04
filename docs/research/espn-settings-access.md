# ESPN settings access validation

**Checked:** 2026-10-04  
**App origin tested:** `http://localhost:5173`  
**Fixture:** `src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json`

## Results

| League | View | Browser request | Result |
| --- | --- | --- | --- |
| `1900128084`, 2026 | `mSettings`, anonymous | `fetch` from the running app origin | 200; browser read succeeded; 47 scoring items |
| `1900128084`, 2026 | `mRoster`, anonymous | `fetch` from the running app origin | 200; browser read succeeded; 10 teams |
| `409479118`, 2026 | `mSettings`, anonymous | `fetch` from the running app origin | 401; `AUTH_LEAGUE_NOT_VISIBLE` |
| `409479118`, 2026 | `mSettings`, `credentials: include` | `fetch` from the running app origin while Chrome had an active ESPN login | 401 |
| `409479118`, 2026 | `mRoster`, `credentials: include` | `fetch` from the running app origin while Chrome had an active ESPN login | 401 |

The signed-in ESPN page for `409479118` independently rendered League Settings with **Make League Viewable to Public: No**, its scoring rules and roster settings. This confirms the current account can view the rules in ESPN's own site. It does **not** prove that a companion can retrieve the `mSettings` API response. No credentials, cookies, members or rosters were copied into the fixture.

The browser probe ran against the actual Vite origin, not a command-line HTTP client. Successful public `fetch` calls prove browser CORS for this development origin and these two views. The app cannot read the private settings through a direct cross-origin request, even with `credentials: include`. ESPN page settings could be read in the signed-in page, but a separate extension/content-script request to `mSettings` has not yet been verified. CORS and authenticated access on the deployed app origin also remain unverified.

## Payload shape

The public settings response contained `settings.scoringSettings.scoringItems` and `settings.rosterSettings.lineupSlotCounts`. A scoring item included `statId`, numeric `points`, and sometimes `pointsOverrides`. On the acceptance league, an explicit zero base value coexisted with a nonzero D/ST override. The importer must preserve that zero and apply the override only to its applicable position. The sanitized fixture retains only league/season identity and allowlisted scoring and lineup fields.

The current integration stat-map evidence is pinned to [`cwendt94/espn-api` commit `825ee9a75aa6ec836c6d4a1df78356e378588719`](https://github.com/cwendt94/espn-api/tree/825ee9a75aa6ec836c6d4a1df78356e378588719). It is community integration evidence, not an ESPN API contract. In particular, stat `53` is mapped as receptions by that integration, while stat `41` remains unresolved there; do not treat those IDs as interchangeable.

## Connector gate

Public access is proven for the development origin. Private API access is still a release gate. Chrome documents that content-script cross-origin fetches remain subject to page CORS, while service-worker fetches can use declared host permissions. The current candidate therefore sends the fixed settings request from its extension service worker with `credentials: include`, after opening or reusing an ESPN tab. It requests exact app-origin messaging and exact ESPN site/API host access. It does not add the `cookies` permission or copy cookie values. The response is allowlist-sanitized before returning to the app, which validates it again. The credentialed extension request has not been installed or tested in Chrome; browser cookie policy may still affect whether ESPN session credentials are sent.

The API's anonymous 401 response says only that the requester is not authorized to view the league. It does not distinguish a signed-out browser from an account without membership. The UI reports access denial and allows retry after the user checks the active account/league membership; no claim is made that 401 identifies a missing login.

The private path must be demonstrated in a real browser before it is described as supported. This repo currently has no distributed companion ID or extension distribution channel, and the test extension has not been installed. The current result therefore justifies preparing and reviewing the connector experiment, but not claiming the private route works.
