# ESPN league import: research and implementation plan

**Status:** Implementation is coded and locally verified; independent code review and static WCAG review found no remaining actionable findings. Private authenticated browser proof and final release criteria remain open.
**Research date:** 2026-10-04.
**Goal:** Import ESPN fantasy football league scoring settings into Stat Watch instead of entering values manually.
**Priority:** ESPN, with both public and private leagues supported in the initial release. Users never select or identify their league's visibility.
**Architecture:** A single import coordinator first attempts anonymous access, then uses an existing ESPN connection or guides account connection when access requires it. Public and authenticated snapshots pass through the same validation, normalization, preview and persistence pipeline. Prefer a browser companion that reads private settings in the user's ESPN session and returns only sanitized settings to Stat Watch.
**Stack:** Existing React, TypeScript, TanStack Query, Vitest and browser storage, plus a browser companion for authenticated access. A backend is conditional on public CORS or a separately reviewed alternative connector design.
**Scope:** Follow the implementation tasks below. Do not claim both access modes are supported until Task 1's authenticated browser proof and the release criteria are satisfied. No commit, push or deployment was requested.

**Implementation progress (2026-10-04):** Added the validated ESPN adapter, scoring normalizer, custom defense bands, persistence/refresh path, import dialog and Chrome connector source. Public ESPN settings were fetched and exercised in the browser; the private league returned 401 from the app origin. The connector has not been installed, so private API access, sign-in/retry and extension delivery remain unverified. Independent Sol review and static WCAG 2.2 AA review found no remaining actionable code/UI findings; real assistive technology behavior remains unverified. Current local verification: 237 tests pass, `npm run build` passes, and the extension output passes Node syntax checks. See [league import guide](../league-import.md), [access research](../research/espn-settings-access.md), and [connector ADR](../adr/0001-espn-private-settings-connector.md).

## 1. Research findings

| Provider | Settings and access | Fit |
| --- | --- | --- |
| ESPN | The maintained `espn-api` integration uses `mSettings`, `mTeam`, `mRoster` and `mMatchup` views. Public league initialization needs a league ID/year; private access uses `espn_s2` and `SWID` cookies. No official supported fantasy developer contract was found in this investigation. | First provider because the user uses ESPN; prove access before choosing transport. |
| Sleeper | Official read-only API exposes scoring settings, roster slots, rosters and weekly matchups, with no token. Username discovery can find several leagues. | Straightforward later adapter; does not solve the user's ESPN setup. |
| Yahoo | Official Fantasy Sports API exposes settings and scoring modifiers through registered-app OAuth 2.0. | Later adapter with backend token exchange and protected sessions. |

Sources:

- [ESPN request source](https://github.com/cwendt94/espn-api/blob/master/espn_api/requests/espn_requests.py), [endpoint constants](https://github.com/cwendt94/espn-api/blob/master/espn_api/requests/constant.py), and [public/private usage](https://github.com/cwendt94/espn-api/wiki). These are primary sources for that integration, not official ESPN API guarantees.
- [ESPN settings parser](https://github.com/cwendt94/espn-api/blob/master/espn_api/football/settings.py) and [stat map](https://github.com/cwendt94/espn-api/blob/master/espn_api/football/constant.py): scoring items, numeric IDs and overrides.
- [ESPN league types](https://support.espn.com/hc/en-us/articles/115003927611-League-Types): custom League Manager scoring exists. Public joinability and anonymous API visibility are separate questions.
- [Sleeper API documentation](https://docs.sleeper.com/): authentication, discovery, settings and caching. Documented free use is non-commercial; commercial use requires a licensing discussion.
- [Yahoo Fantasy Sports documentation](https://sports.yahoo.com/developer/docs/) and [authorization-code flow](https://developer.yahoo.com/oauth2/guide/openid_connect/): settings and confidential OAuth exchange.

### Evidence and limits

- Inspected current project source at `1b5fe60` on `feat/vs-mode`; working tree was clean before this document.
- Downloaded and inspected current ESPN integration request, endpoint, settings and stat-map source. Its fantasy API base is `https://lm-api-reads.fantasy.espn.com/apis/v3/games/`.
- A sample anonymous ESPN request for league `1245`, season `2026`, `view=mSettings` returned 404. This was not a verified current league; it does not establish the user's settings access or browser CORS behavior.
- User-supplied league `1900128084` (Tapai Csoves Liga), season 2026: anonymous `mSettings` and `mRoster` both returned HTTP 200; settings reports `isPublic: true`, 47 scoring items, and the roster view returns 10 teams.
- User-supplied league `409479118`, season 2026: both anonymous views returned HTTP 401 with `AUTH_LEAGUE_NOT_VISIBLE`. This confirms authenticated access is needed; successful access by the user's account has not been exercised.
- Both supplied leagues' responses included `Access-Control-Allow-Origin: http://localhost:5173` when that Origin was sent. Actual browser access and the deployed site's origin still require verification.
- ESPN's stat labels show defense points-allowed boundaries different from the app's fixed seven tiers. Copying weights into the existing array would mis-score some games.
- Sleeper NFL state and its documented archived league example returned HTTP 200 with `Access-Control-Allow-Origin: *`. The example contained real custom scoring. This verifies its response shape/HTTP access, not the user's ESPN access.
- Yahoo official documentation was retrievable through indexed results; direct page retrieval failed. No Yahoo OAuth or private ESPN login was exercised.
- Context7 retrieved Sleeper and `/cwendt94/espn-api` documentation; raw integration source supplied the specific ESPN mapping evidence.
- No application tests or browser interactions ran: this task changes only a planning document.

## 2. Current site integration points

- `src/ui/SettingsPage.tsx`: league profiles and manual scoring editor; add **Import leagues** beside **Add profile**.
- `src/scoring/types.ts`: `Profile` has local ID/name/preset/values; no provider identity. `pointsAllowed` uses seven fixed tiers.
- `src/scoring/score.ts`: computes points from local coefficients and combines several categories, including all two-point conversions.
- `src/stats/types.ts` and `src/stats/normalize.ts`: available ESPN game stats. Forced fumbles are absent; D/ST points allowed uses the opponent's entire score, which can differ from fantasy definitions.
- `src/storage/profiles.ts`: profile persistence/repair; missing coefficients get PPR defaults, so imports must supply complete explicit values.
- `src/storage/store.ts`: failed writes retain values in memory but return no persistence result. Import must report saved versus session-only results.
- `src/storage/followed.ts` and `src/storage/types.ts`: ESPN IDs, league links and mine/opponent identity.
- `src/hooks/useMatchup.ts`: totals every followed entry; no starter/bench distinction.
- `Dockerfile` and `nginx.conf`: static hosting; no authenticated application backend.

## 3. Unified public/private access strategy

**Start with league links/IDs and a visible season.** Do not promise username-based account discovery for ESPN: that capability was not verified. Support several pasted links for multi-league import.

Candidate settings request, based on the integration source:

```text
GET https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{leagueId}?view=mSettings
```

The supplied leagues establish both anonymous success and authentication-required cases. Task 1 must check public CORS in a browser and prove authenticated reads of the private league. Probe settings separately from roster access; access is detected per operation. Being signed into ESPN in another tab does not establish cross-origin API access from this site.

| Route | Benefit | Gate |
| --- | --- | --- |
| Direct browser request | Preserves static hosting. | Settings must be readable and CORS must permit the request. |
| Fixed-host backend proxy | Can handle missing CORS. | Adds hosting; proxying alone does not solve authorization. |
| Browser companion using the user's ESPN session | Private reads without manual cookie copying; website receives only sanitized league settings. | Prove authenticated requests, host permissions, session handling and a secure companion/site bridge in the supported browser. First-time installation/sign-in may be necessary. |
| Authenticated backend | Alternative if a browser companion cannot provide the required experience. | Needs its own validated connection mechanism and protected credentials/session lifecycle. A proxy alone is insufficient. |
| Exported settings JSON | Optional recovery/import route using the same parser. | Does not fulfill the required seamless private-league flow; no built-in ESPN export is assumed. |

**Recommendation:** direct anonymous access for readable settings, with a browser companion for authenticated access. Both are required release paths. Keep session cookies in the browser; return only the requested settings, not account credentials, through the companion bridge. The companion is a proposed implementation, not an already proven ESPN connection. If its feasibility fails, resolve an authenticated alternative before claiming support for both modes.

### Import coordinator and connection lifecycle

1. Parse links/IDs and try an anonymous settings request for each league.
2. Successful responses advance directly to preview. An explicit ESPN authorization-required response advances to `connection-required`. Network/CORS failures, rate limits and not-found results have their own states; they do not classify a league as private.
3. If an ESPN connection already exists, retry denied leagues through it without asking the user to choose a mode. Otherwise show **Connect ESPN to import this league** within the same dialog.
4. Guide companion installation if needed and open ESPN sign-in in an ESPN-owned tab if no usable session exists. Stat Watch never asks for the ESPN password. Preserve inputs, selected leagues and completed public results during connection.
5. After connection, automatically retry the pending private leagues and resume the same preview. Signing in does not prove membership: a still-denied league gets a per-league **This ESPN account cannot access this league** result.
6. Reuse connection on refresh. If it expires, show **Reconnect ESPN**, retain existing profiles/settings, and resume the pending refresh after reconnection. No repeated sign-in per league.

Recommended states: `loading`, `connection-required`, `connecting`, `retrying`, `ready`, `access-denied`, `not-found`, `network-error`, `rate-limited`. Mixed batches keep successful public results while private access completes; cancelling connection lets the user explicitly import the ready subset.

Do not ask the user whether a league is public, request a visibility change, or require DevTools/cookie copying. One-time connection can require installation/sign-in; seamless means automatic routing and continuation, not bypassing ESPN authentication. Do not promise an official OAuth connection: none was verified in this research.

The companion must authorize each Stat Watch origin explicitly, restrict ESPN host access, bind replies to the initiating origin/request nonce and exact league/season, and return a size-limited validated settings payload. Do not use wildcard message targets. Disconnection revokes companion/site permission, clears pending requests and retains imported local profiles; it does not sign the user out of ESPN. Session credentials never enter Stat Watch, its localStorage, exports or logs. Document actual browser/platform support; unsupported browsers must be identified before the user starts connecting.

If a backend alternative is chosen, document its validated credential acquisition, protected storage, session ownership, expiry, deletion and redacted logs in an ADR before implementation. Private support remains a release requirement.

## 4. Import experience

1. **Import leagues** opens a native dialog with labeled inputs, initial focus, Escape and Cancel.
2. Choose ESPN; paste league links/IDs and choose a visible season. Do not silently infer the fantasy season from the local calendar.
3. **Load leagues** detects access automatically. Public leagues load immediately; authentication-required leagues use the existing ESPN connection or show **Connect ESPN**. After connection, retry automatically in the same dialog. Do not show a public/private selector.
4. Select one or more leagues and preview scoring values, unsupported rules and changes to an existing profile.
5. New imports create custom profiles. Existing `(provider, league ID, season)` identities refresh the same local profile after preview. Updating a manual profile requires an explicit target selection.
6. Unsupported enabled rules require explicit per-league acknowledgement to import approximate scoring; malformed settings cannot be imported. Retain compatibility warnings after saving.
7. **Import selected leagues** commits the validated batch. Select an imported profile, announce saved/session-only results and restore focus predictably.
8. Settings shows source, season, last import, compatibility and **Refresh settings**. Refresh automatically uses the required access route and prompts **Reconnect ESPN** only when needed. Local edits show **Modified locally** and are never silently overwritten. Optional file recovery is secondary.

**Disconnect source** keeps profile values and IDs. Search, preview and Cancel do not save anything. A new season is a separate profile unless explicitly targeted to an existing profile.

Initial scope: scoring settings and league metadata. Roster/opponent import and continuous synchronization follow separately.

## 5. Scoring normalization

Read `settings.scoringSettings.scoringItems` and retain numeric `statId`, `points`, position overrides and relevant scoring metadata. Use `rosterSettings.lineupSlotCounts` for a descriptive roster summary. Maintain a versioned stat map verified against fixtures and ESPN's visible rules.

| Candidate IDs from the integration map | Meaning | Verification needed |
| --- | --- | --- |
| 3, 4, 20 | Passing yards, TD, interception thrown | Units, fractional/interval behavior, overrides. |
| 24, 25 | Rushing yards and TD | Direct versus interval awards. |
| 42, 43, 53 | Receiving yards, TD, each reception | Do not substitute stat 41 for 53 without verified semantics. |
| 19, 26, 44, 62 | Two-point categories and total | Compose overlapping rules; single local coefficient only when effective weights agree. |
| 72 | Total fumbles lost | Check overlaps with category-specific fumbles lost. |
| 74, 77, 80, 83, 85, 86, 88 | FG distance bands, total FG made/missed, PAT made/missed | Compose base/band awards; flag unequal distance penalties until modeled. |
| 89–92, 121–125; D/ST-specific 188–196 | Points-allowed bands | Check position applicability and overlapping sets; do not blindly add both. |

Rules:

- Initialize all coefficients and tiers to zero; populate only verified mappings. Never inherit PPR defaults for absent categories.
- Preserve explicit zero and negative weights; use nullish presence checks for overrides. A zero override is meaningful. Do not copy the inspected parser's truthy override fallback.
- Treat `pointsOverrides` as position-specific until proven otherwise; do not collapse distinct overrides into one coefficient.
- Every enabled rule must be consumed by a verified mapping or shown as unsupported. Recognize disabled rules separately.
- Flag unknown IDs, thresholds, bonuses, per-carry, IDP, forced fumbles, blocked kicks, returns and yards allowed until their stats and semantics are supported.
- Verify fractional scoring before converting interval awards to per-yard coefficients: some rules may truncate.
- For an unrepresentable grouped rule, omit its contribution in an acknowledged approximate profile and explain the omission; never arbitrarily choose a weight.
- Keep rule coverage distinct from stat-source accuracy. Importing coefficients does not fix unavailable stats, corrections or commissioner overrides. Preserve warnings in Settings and alongside affected scores.

### Required change: configurable defense ranges

The app has `0`, `1–6`, `7–13`, `14–20`, `21–27`, `28–34`, `35+`. The inspected ESPN map includes `14–17`, `18–21`, `22–27`, `35–45`, `46+`.

Add optional `pointsAllowedBands` to `ScoringValues`: ordered `{ min, max: number | null, points }` ranges. Imported ESPN profiles use verified provider ranges; old/manual profiles retain the existing array and results. Validate nonnegative integer boundaries, complete coverage, no overlap, finite weights and a final open range. Settings edits these explicit bands when present; applying a preset clears them deliberately.

Correct ranges still do not fix the site's full-opponent-score input versus fantasy D/ST definitions. Keep that stat limitation visible. Extending additional scoring categories belongs in a targeted follow-up when required by actual league settings.

## 6. Import contract and persistence

Add validated optional metadata to `Profile`:

```ts
type ImportIssue = {
  code: 'unknown-rule' | 'unrepresentable-rule' | 'stat-limitation';
  providerKeys: string[];
  message: string;
};
type LeagueSource = {
  provider: 'espn';
  leagueId: string;
  season: string;
  transport: 'public-api' | 'browser-session' | 'settings-file';
  importedAt: string;
  mappingVersion: number;
  rawSettings: Record<string, unknown>;
  baselineValues: ScoringValues;
  lineupSlotCounts: Record<string, number>;
  issues: ImportIssue[];
};
type LeagueImportDraft = {
  source: LeagueSource;
  name: string;
  values: ScoringValues;
};
```

`ScoringValues` is the current type plus optional explicit bands. `rawSettings` stores a validated allowlist of scoring/roster configuration, excluding members, rosters, tokens, account identifiers and cookies. Transport is provenance, not identity: public-to-private access changes must not create another profile. Connection state is separate from profile metadata and contains no ESPN credentials.

External identity is `(provider, leagueId, season)`; retain profile UUIDs so followed entries remain attached. Display-name collisions get visible suffixes and are never used as identity. `baselineValues` detects local modifications independently of the preset label.

Validate a batch before one profiles-store write. Return imported IDs and persistence status; failed localStorage writes remain usable in memory with **Imported for this session; browser storage could not save it**. Ignore invalid source metadata without losing otherwise valid manual values. Imported profiles supply complete coefficients to avoid PPR repair fallback.

Settings files use `{ schemaVersion: 1, provider: 'espn', leagueId, season, settings }`, capped at 1 MB. Validate JSON/envelope/required settings and copy only allowlisted fields. The verified export method must emit this envelope without credentials.

## 7. Implementation tasks

When implementation is authorized, use a task branch from the approved then-current baseline. Run existing tests first, add focused tests before changes and run the full suite/build before delivery.

### Task 1 — Validate both access paths and design the connector

**Create:** `docs/research/espn-settings-access.md`, sanitized `src/test/fixtures/espn-fantasy/` fixtures.

- [ ] Use `1900128084` as the public and `409479118` as the authentication-required acceptance cases for 2026; compare actual authenticated settings with the user's visible league rules without logging credentials. Refresh these classifications at implementation time.
- [ ] Check CORS in a real browser separately from command-line HTTP. Probe settings independently of roster access.
- [ ] Record raw scoring/override shapes, response codes and origins. Pin the integration commit used for stat-ID evidence.
- [ ] Prove the companion's authenticated settings request in a supported browser. Establish exact host permissions, sign-in/session detection and bridge mechanism; do not assume cross-origin credentials work automatically.
- [ ] Write a connector ADR and scoped companion plan, including installation/distribution, supported browsers, allowed site origins, nonce-bound replies, expiry and disconnect. Use a fixed-host proxy only if public CORS requires it.
- [ ] If the companion cannot work, resolve a validated authenticated alternative. Optional settings-file import is recovery, not a substitute for private support.

**Exit criterion:** verified public and authenticated private routes obtain real settings without manual rule/cookie entry. Both must be demonstrated before claiming the release supports both modes. Account-wide discovery remains unclaimed until separately verified.

### Task 1A — Implement browser connection and automatic routing

**Create:** companion sources in `extensions/espn-connector/`, `src/leagues/espn/connection.ts`, `src/leagues/espn/access.ts`, their tests, and connector documentation. Companion filenames and manifest permissions are fixed by Task 1's validated mechanism.

- [ ] Implement companion discovery, guided installation/sign-in, origin authorization, settings reads and disconnect. Pass only sanitized settings to the site; keep ESPN session credentials inside the browser.
- [ ] Implement the coordinator states above, anonymous-first lookup and authenticated retry. Public/private routing never requires a user mode selection.
- [ ] Reuse one connection for multiple leagues; preserve the entire import draft while connecting and automatically resume pending requests.
- [ ] Handle expired sessions, wrong account/no league membership, connection cancellation, changed league visibility and stale replies without clearing existing profiles.
- [ ] Test origin/nonce validation, replayed or unsolicited messages, wrong league/season, oversized payloads, credential exclusion and cancellation as well as routing success.

**Deliverable:** one website import API transparently obtains public and private snapshots, asking only for necessary account connection.

### Task 2 — Validated ESPN adapter

**Create:** `src/leagues/types.ts`, `src/leagues/espn/client.ts`, `src/leagues/espn/parse.ts`, their tests.

- [ ] Implement `loadEspnLeagueSettings(leagueId, season, signal)` through Task 1A's access coordinator and optional `parseEspnSettingsFile(text)`, returning the same validated provider object for every route.
- [ ] Recognize ESPN football links or decimal IDs; construct only fixed-host URLs. Validate identity/season, settings, finite weights, overrides and slots at runtime.
- [ ] Support AbortSignal and 15-second timeout; distinguish denied, not found, malformed, offline, 429 and server failures. A 404 alone does not prove privacy.
- [ ] Deduplicate with TanStack Query, cap concurrent loads at three and use bounded retries; do not poll settings at live-game frequency.
- [ ] Test links, wrong hosts, mixed public/private batches, partial failures, automatic authenticated retry, expired connection, denied membership, stale/cancelled requests and malformed/oversized payloads/files.

**Deliverable:** validated provider snapshots without saved-profile changes.

### Task 3 — Configurable points-allowed bands

**Modify:** `src/scoring/types.ts`, `src/scoring/score.ts`, `src/scoring/presets.ts`, `src/storage/profiles.ts`, `src/ui/SettingsPage.tsx` and existing tests.

- [ ] Add validated optional explicit ranges; preserve old storage/preset behavior.
- [ ] Test ESPN boundaries 17/18, 20/21/22, 27/28, 34/35 and 45/46 with distinct weights; retain existing tier regressions.
- [ ] Score one applicable range, expose imported range editing and clear custom ranges when applying presets.
- [ ] Document the field and editor state in `docs/components.md`.

**Deliverable:** ESPN ranges are representable without changing manual-profile results.

### Task 4 — Normalization and compatibility

**Create:** `src/leagues/espn/statMap.ts`, `src/leagues/espn/scoring.ts`, `src/leagues/espn/scoring.test.ts`.

- [ ] Implement pure `normalizeEspnLeague(league): LeagueImportDraft`, complete zero-initialized values and source metadata.
- [ ] Verify supported stat mappings against Task 1 fixtures/visible rules; track consumed IDs, overrides and overlapping awards.
- [ ] Implement verified direct weights, FG composition and explicit bands; issue warnings for unrepresentable rules and unavailable stats.
- [ ] Test zero overrides, negatives, absent rules, bonuses, unknown IDs, grouped weights, fractional/interval behavior and invalid settings.
- [ ] Score synthetic stats to catch unit/sign mistakes; compare actual totals only with like-for-like stats and report differences.

**Deliverable:** deterministic drafts with explicit accuracy limits.

### Task 5 — Persistence and refresh

**Modify:** `src/scoring/types.ts`, `src/storage/profiles.ts`, `src/storage/store.ts`, `src/storage/storage.test.ts`.
**Create:** `src/leagues/import.ts`, `src/leagues/import.test.ts`.

- [ ] Add validated optional source metadata preserving old keys/manual profiles.
- [ ] Implement `commitLeagueImports` with explicit create/update targets, full-batch validation, one write and persistence result.
- [ ] Preserve UUIDs, resolve duplicates/names, store custom profiles/baselines/issues and detect local edits.
- [ ] Require reviewed refresh decisions; disconnect source keeps values.
- [ ] Test reload, reimport, multi-import, manual targets, conflicts, quota failures, invalid metadata and followed-entry identity.

**Deliverable:** idempotent import and reviewable refresh.

### Task 6 — Import dialog and source UI

**Create:** `src/ui/ImportLeaguesDialog.tsx`, its tests, `src/hooks/useLeagueImport.ts`.
**Modify:** `src/ui/SettingsPage.tsx`, its tests, `src/styles.css`, `src/ui/EntryCard.tsx`, `src/ui/VsPage.tsx` and related compatibility-message tests.

- [ ] Build section 4's single flow with automatic access detection, inline Connect/Reconnect ESPN, preserved public results and continuation after sign-in; separate draft/query state from saved values.
- [ ] Handle stale requests, cancellation, retained input, per-league errors and approximate-import acknowledgement.
- [ ] Display source/season/time/local changes, refresh/reimport, disconnect and accurate persistence feedback.
- [ ] Keep scoring issues visible in Settings and affected Players/Vs scores.
- [ ] Test public-only, private-only and mixed multi-import with no visibility selector, first connection/reconnection, automatic continuation, denied membership, duplicate/target choices, errors/retry, conflicts, refresh, cancel, focus, Escape and announcements.

**Deliverable:** usable import of actual ESPN settings.

### Task 7 — Verification and documentation

**Modify:** `README.md`, `docs/components.md`.
**Create:** `docs/league-import.md`; backend OpenAPI/ADR if server work is selected.

- [ ] Run `rtk npm test`, `rtk npm run build` and `rtk git diff --check` on the final implementation.
- [ ] Exercise both supplied leagues in a real browser: anonymous public load, initial private connection, automatic retry, mixed preview/import, reload, connection reuse, expired-session reconnection, local edit/refresh and cancellation. Record failed membership separately from successful private access.
- [ ] Verify Players/Vs use imported weights/ranges and preserve followed identities. Record unresolved stat differences.
- [ ] Perform independent WCAG 2.2 AA review: names/semantics, focus, keyboard, contrast, status, targets and zoom/reflow; report untested assistive technology.
- [ ] Review fixed hosts, untrusted names/JSON, limits and credential exclusion; review actual backend/helper permissions separately if selected.
- [ ] Document supported rules, limitations, snapshot/refresh policy, component props/states and verified export instructions.
- [ ] Commit/push/PR only within the implementation delivery boundary authorized at that time.

**Release criteria:** both public and private ESPN rules import through the same button without visibility questions or manual rule/cookie entry; mixed batches resume after one connection; reconnect preserves saved data; denied membership is explained; reimport preserves IDs even after visibility changes; configurable bands are correct; unsupported rules remain visible; persistence failure is reported; refresh previews edits; actual tests/build/browser/accessibility evidence is recorded. A public-only implementation or file-only private fallback does not satisfy this release.

## 8. Follow-up scope

**Rosters and opponents:** use verified `mTeam`, `mRoster` and `mMatchup` data after settings work. Ask which fantasy team belongs to the user; commissioner status does not identify it. Verify fantasy IDs against existing athlete IDs and explicitly map defenses. Track starters/bench/IR separately and exclude bench from Vs totals. Preserve manual entries using provenance; handle byes/missing opponents without guessing. Plan consistent profile/entry writes before modifying both stores.

**Other providers:** Sleeper supports username discovery and direct read-only access; Yahoo requires confidential OAuth, protected sessions and token expiration/disconnect handling. Both need independently verified scoring maps.

**Automatic synchronization:** decide local override and stale-data behavior first. Provider totals, corrections and commissioner overrides should be distinguished from locally computed estimates.

## 9. Decisions remaining

1. ESPN priority and support for both public/private modes are settled. Anonymous access has been verified for `1900128084`; `409479118` requires authentication. The product detects access automatically.
2. Prove the companion's authenticated request and finalize supported browsers/distribution. If infeasible, resolve an authenticated alternative before release; this is a feasibility gate, not optional private support.
3. Proposed initial scope imports scoring/metadata; roster/opponent import follows separately.
4. Proposed approximate imports require acknowledgement and persistent warnings. Strict score parity requires additional scoring/stat work before affected leagues can be imported.

These are explicit proposal choices and feasibility gates, not silently approved implementation requirements.
