# Stat Watch PoC: design

Date: 2026-10-04
Status: approved in conversation, awaiting written review

## 1. Goal

A personal web app that follows a hand-picked set of NFL players and team defenses from all of the user's fantasy leagues in one place, showing real stats and fantasy points that update live during games.

This PoC proves the data and scoring path end to end. Later iterations add red-zone alerts, highlights and stream links; the design keeps room for them but builds none of it.

## 2. Scope

### In scope

- Search NFL players and team defenses and follow them.
- Followed entries are shown on the main screen.
- Followed entries are stored in localStorage and survive a reload.
- Live real stats and fantasy points per followed entry, updating while games are played.
- A settings page with fantasy scoring profiles, stored in localStorage.
- Light and dark theme.
- A Dockerfile that packages the app as an image.
- A Kubernetes manifest that can deploy that image.

### Out of scope

- Authentication, users, a database or any server-side persistence.
- Highlights, stream links, push notifications.
- Actually deploying to the cluster.
- An Ingress (the user assigns the address on their own cluster).

### Supported positions

- Offense: QB, RB, WR, TE.
- Kickers.
- Individual defensive players (IDP): any defensive position.
- Team defenses (D/ST).

## 3. Decisions made during brainstorming

| Topic | Decision |
| --- | --- |
| Card when the team is not playing | Always show the current week's game: live stats while it is played, final stats afterwards, kickoff time before it starts. Bye weeks say so. |
| Fantasy configuration | Multiple named scoring profiles. Each profile starts from a preset (Standard, Half PPR, PPR) and every value is editable. |
| Same player in two leagues | Follow the player twice, once per profile. Two cards. |
| Architecture | Static single-page app. The browser calls ESPN directly. No backend. |
| Visual direction | "Field", chosen from three prototypes. Reference: `prototypes/main-screen.html` (removed after the design was chosen, history in git, commit 50261f3) (variant 3). |

## 4. Data source

ESPN's public, unofficial JSON API. Verified on 2026-10-04:

- It sends `access-control-allow-origin: *`, so a browser can call it from any origin.
- No API key is needed.
- It is undocumented and can change without notice. This is accepted for a personal PoC.

| Need | Endpoint |
| --- | --- |
| Player search | `https://site.web.api.espn.com/apis/common/v3/search?query={q}&limit=10&type=player`, then keep items where `league === "nfl"` |
| Player details (current team, position) | `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{id}` |
| Teams (for D/ST search) | `https://site.api.espn.com/apis/v2/sports/football/nfl/standings` (ESPN's `/teams` sends no CORS headers, standings does, and one fetch returns all 32 teams) |
| Current week's games | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` |
| One game's stats and plays | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={eventId}` |

The game summary contains, per team, box score categories `passing`, `rushing`, `receiving`, `fumbles`, `defensive`, `interceptions`, `kickReturns`, `puntReturns`, `kicking`; team totals; and the play-by-play (`drives`), where each play has `text`, `start.yardsToEndzone`, `start.team`, `scoringPlay` and `wallclock`.

The exact response shapes are pinned down by saved JSON fixtures during implementation (see section 11). Where this spec and a real response disagree, the response wins and the spec is updated.

Known gaps:

- Forced fumbles are not in the box score, so IDP scoring has no forced-fumble category.
- Field goal distances and 2-point conversions are not in the box score; they are parsed from play text (for example `C.Boswell 31 yard field goal is GOOD`).
- Safeties are parsed from play text.

## 5. Architecture

```
Browser
  React app (Vite build, served as static files by nginx)
    UI (pages, components)
      |
    hooks (TanStack Query: polling, caching, de-duplication)
      |
    espn/client  ->  ESPN public API
      |
    stats/normalize  (ESPN JSON -> our types)
      |
    scoring/score    (stats + profile -> points)
      |
    storage          (localStorage, validated)
```

### Stack

- React with TypeScript, built with Vite.
- React Router for the two routes, `/` and `/settings`.
- TanStack Query for fetching. It replaces hand-written polling, retry, caching and request de-duplication, and is the only data library.
- Plain CSS with custom properties for the theme tokens, copied from the Field prototype. No CSS framework.
- Vitest and React Testing Library for tests.
- Fonts: Anybody (display) and Hanken Grotesk (text) from Google Fonts.

### Units

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `src/espn/client.ts` | Thin `fetch` wrappers for the endpoints in section 4. Throws a typed error on non-2xx responses. | nothing |
| `src/espn/types.ts` | The subset of ESPN response types the app reads. | nothing |
| `src/stats/normalize.ts` | Turns a game summary into `GameStats`: per-athlete stats, per-team defense stats, game state. Parses play text for FG distances, 2-point conversions and safeties. | `espn/types` |
| `src/stats/types.ts` | `PlayerStats`, `DefenseStats`, `GameState`, `GameStats`. | nothing |
| `src/scoring/presets.ts` | Default values and the three presets. | `scoring/types` |
| `src/scoring/score.ts` | Pure `score(entry, gameStats, profile)` returning `{ total, breakdown: { label, points }[] }`. | `stats/types`, `scoring/types` |
| `src/storage/*` | Load, validate and save followed entries, profiles and theme. | `scoring/presets` |
| `src/hooks/*` | `useScoreboard`, `useGameSummary(eventId, status)`, `usePlayerSearch(q)`, `useFollowed`, `useProfiles`. | client, normalize, storage |
| `src/ui/*` | Pages and components. | hooks, scoring |

Every unit below `ui` is plain TypeScript with no React, so it can be tested without rendering.

## 6. Data flow and polling

1. On load, read followed entries and profiles from localStorage.
2. For each followed player, fetch player details once per session to refresh the current team and position (handles trades). Team defenses need no refresh.
3. Fetch the scoreboard. Refetch every 60 seconds while any game is live, otherwise every 10 minutes.
4. Map each followed entry's team to its game in the scoreboard. A team with no game this week is on bye.
5. For each game that has a followed entry:
   - live: fetch the summary every 10 seconds;
   - final: fetch once and keep it (no refetch);
   - scheduled: do not fetch; the card shows the kickoff time from the scoreboard.
6. Normalize the summary, score each entry with its own profile, render.

Several entries in the same game share one summary request (TanStack Query de-duplicates by key `['summary', eventId]`).

Polling pauses while the tab is hidden (TanStack Query default `refetchIntervalInBackground: false`).

## 7. Data model

### localStorage keys

All keys are versioned so a later schema change can migrate or reset cleanly.

`nflsw:v1:followed`

```ts
type FollowedEntry = {
  kind: 'player' | 'defense';
  espnId: string;        // athlete id for players, team id for defenses
  name: string;
  teamId: string;        // refreshed on load for players
  teamAbbr: string;
  position: string;      // 'QB', 'LB', 'K', ... or 'D/ST'
  jersey?: string;
  profileId: string;
};
```

The identity of an entry is `espnId + profileId`. The same player may appear once per profile.

`nflsw:v1:profiles`

```ts
type Profile = { id: string; name: string; preset: 'standard' | 'half' | 'ppr' | 'custom'; values: ScoringValues };
```

At least one profile always exists. On first run the app creates "My league" from the PPR preset. Editing any value after applying a preset sets `preset` to `'custom'`.

`nflsw:v1:theme`: `'light' | 'dark'`. Absent means follow the system setting.

### Validation

Each key is parsed and validated by hand-written type guards on read. Invalid or unparseable data for a key is replaced by that key's default and a `console.warn` is logged. A followed entry pointing at a deleted profile is moved to the first profile.

## 8. Scoring

### ScoringValues

| Group | Field | Standard | Half PPR | PPR |
| --- | --- | --- | --- | --- |
| Offense | passYards (per yard) | 0.04 | 0.04 | 0.04 |
| | passTd | 4 | 4 | 4 |
| | interception | -2 | -2 | -2 |
| | rushYards (per yard) | 0.1 | 0.1 | 0.1 |
| | rushTd | 6 | 6 | 6 |
| | reception | 0 | 0.5 | 1 |
| | recYards (per yard) | 0.1 | 0.1 | 0.1 |
| | recTd | 6 | 6 | 6 |
| | twoPoint | 2 | 2 | 2 |
| | fumbleLost | -2 | -2 | -2 |
| | returnTd | 6 | 6 | 6 |
| Kicker | fg0to39 | 3 | 3 | 3 |
| | fg40to49 | 4 | 4 | 4 |
| | fg50plus | 5 | 5 | 5 |
| | fgMissed | -1 | -1 | -1 |
| | xpMade | 1 | 1 | 1 |
| | xpMissed | -1 | -1 | -1 |
| IDP | soloTackle | 1 | 1 | 1 |
| | assistedTackle | 0.5 | 0.5 | 0.5 |
| | sack | 2 | 2 | 2 |
| | tackleForLoss | 1 | 1 | 1 |
| | qbHit | 0.5 | 0.5 | 0.5 |
| | passDefended | 1 | 1 | 1 |
| | idpInterception | 3 | 3 | 3 |
| | fumbleRecovery | 2 | 2 | 2 |
| | defensiveTd | 6 | 6 | 6 |
| | safety | 2 | 2 | 2 |
| Team defense | dstSack | 1 | 1 | 1 |
| | dstInterception | 2 | 2 | 2 |
| | dstFumbleRecovery | 2 | 2 | 2 |
| | dstSafety | 2 | 2 | 2 |
| | dstTd | 6 | 6 | 6 |
| | pointsAllowed (tiers 0, 1-6, 7-13, 14-20, 21-27, 28-34, 35+) | 10, 7, 4, 1, 0, -1, -4 | same | same |

The presets differ only in `reception`. Every value is editable; tier ranges are fixed, tier points are editable.

### Rules

- Assisted tackles = total tackles minus solo tackles.
- Team defense TDs = defensive TDs plus kick and punt return TDs of that team.
- Points allowed = the opponent's score. Simplification: it includes points the defense did not give up (for example a pick six thrown by its own offense). Documented, not corrected, in the PoC.
- Kicker FG points use the distance parsed from each made field goal's play text.
- Fantasy totals are shown with two decimals.

## 9. UI

Visual reference: `prototypes/main-screen.html` (removed after the design was chosen, history in git, commit 50261f3), variant "Field". The implementation copies its tokens (colors for light and dark, fonts, radii) and layout.

### Main screen (`/`)

- Header: app name, theme toggle, link to Settings, "Add player" button.
- Groups in order: "Live now", "Final", "Later", "Bye week". Empty groups are hidden.
- Live cards use a wider grid and show the mini field: endzones in team colors, the red zone from the defending team's 20 hatched, the ball at the line of scrimmage. The ball glides to its new spot within a possession and jumps on a change of possession. The card shows quarter, clock, score, down and distance, and the last play text.
- Other cards are compact: final score with result, or kickoff time.
- Every card: team badge, name, position, opponent, league chip, fantasy points (click to show the breakdown), position-specific stat line, a league picker to move the card to another profile, and Remove.
- Offensive entries whose team has the ball inside the opponent's 20 get the red-zone treatment (orange card outline, "Red zone" label). This is the hook for later alerts.
- Changed numbers briefly highlight (900ms background fade), disabled under `prefers-reduced-motion`.
- Empty state: a sentence and the "Add player" button.

Stat line per position:

| Position | Stats shown |
| --- | --- |
| QB | completions/attempts, pass yards, pass TD, INT, rush yards |
| RB | carries, rush yards, catches, receiving yards, total TD |
| WR, TE | catches/targets, receiving yards, TD |
| K | FG made/attempted, longest FG, XP made/attempted |
| IDP | tackles, sacks, TFL, passes defended, INT |
| D/ST | sacks, INT, fumble recoveries, points allowed |

### Add dialog

- Native `<dialog>` opened with `showModal()`.
- Search input, debounced 300ms, minimum 2 characters. Players come from ESPN search (NFL only). Team defenses come from the cached team list, matched on name, location or abbreviation.
- League dropdown, defaulting to the first profile.
- Each result has an "Add" button, disabled and labelled "Added" if that entry already exists in the selected league. The dialog stays open after adding.
- Error state: "Search is unavailable right now. Try again in a moment."

### Settings page (`/settings`)

- Profile list (left column on desktop, stacked on mobile): select, add, rename, delete. Deleting is blocked for the last profile. Deleting a profile used by followed entries asks which profile to move them to.
- Selected profile form: name, preset dropdown (applying a preset overwrites all values after a confirmation), and number inputs grouped as Offense, Kicker, IDP and Team defense.
- Changes save to localStorage as they are made. No save button.
- Main screen points reflect the change immediately (shared state through the storage hooks).

### Theme

- Default follows `prefers-color-scheme`.
- The header toggle sets light or dark and stores it. The choice is applied as `data-theme` on `<html>` before first paint (small inline script in `index.html`) to avoid a flash of the wrong theme.

### Accessibility floor

- All controls are native buttons, inputs, selects and dialogs with visible focus.
- The mini field has an `aria-label` describing the situation, for example "SF ball at DEN 12, 2nd and 6".
- Text contrast meets WCAG 2.2 AA in both themes.
- Layout works at 390px wide with no horizontal scroll.

## 10. Error handling

| Situation | Behavior |
| --- | --- |
| Scoreboard or summary request fails | Keep the last data. The card or header shows "Updated 14:32, retrying". TanStack Query retries with exponential backoff. |
| Player details request fails | Keep the stored team and position. |
| Search request fails | Error message in the dialog (section 9). |
| Team on bye | Card in "Bye week" group. |
| Player not in this week's box score (inactive, injured) | Card shows the game state and "No stats". |
| Invalid localStorage data | Reset that key to defaults, warn in the console (section 7). |

## 11. Testing

- **Fixtures:** real ESPN responses saved under `src/test/fixtures/`: `summary-pit-cle.json` (a final game summary, covering a QB, RB, WR, TE, K, IDP player and a team defense) and `standings.json` (all 32 teams). The scoreboard is built by hand in `src/test/data.ts`. The search and athlete response shapes were verified only by the browser end-to-end run.
- **Unit tests (Vitest):**
  - `normalize`: every stat category for every position type, FG distance parsing, 2-point and safety parsing, game state (live, final, scheduled, red zone).
  - `score`: every scoring field, every points-allowed tier boundary, preset values.
  - `storage`: valid data round-trips, invalid data falls back to defaults, orphaned profile references are reassigned.
- **Component tests (React Testing Library, `fetch` mocked with fixtures):**
  - Search, add, and the entry appears on the main screen.
  - Followed entries and profiles survive a remount (reload).
  - Changing a profile value changes the points on the card.
  - Remove, and moving a card to another profile.
- **End-to-end check:** run the built image locally and drive it in a real browser through the flows above, in both themes and at phone width. Then an accessibility review.

## 12. Packaging

### Dockerfile

- Stage 1, `node:22-alpine`: `npm ci`, `npm run build`.
- Stage 2, `nginxinc/nginx-unprivileged:alpine`: copy `dist/` and an `nginx.conf` that
  - listens on 8080,
  - falls back to `index.html` for unknown paths so `/settings` survives a reload,
  - serves hashed assets with long cache headers and `index.html` with `no-cache`.
- Runs as a non-root user.

### Kubernetes (`k8s/deployment.yaml`)

- Deployment `stat-watch`: 1 replica, container port 8080, readiness and liveness probes on `GET /`, CPU and memory requests and limits, `runAsNonRoot`, `readOnlyRootFilesystem: true` with an `emptyDir` for nginx's temp paths, no privilege escalation.
- Service `stat-watch`: ClusterIP, port 80 to target port 8080.
- The image reference is a single value in the manifest for the user to set.

## 13. Repository

- `git init` in the project folder. This spec is committed on `main`.
- Implementation happens on a branch and is pushed only after the test suite passes.

## 14. Risks

| Risk | Impact | Mitigation in the PoC |
| --- | --- | --- |
| ESPN changes or closes the unofficial API | App stops updating | All ESPN knowledge is isolated in `espn/` and `stats/normalize.ts`; fixtures make breakage visible in tests. |
| ESPN closes CORS | Browser calls fail | Move fetching behind a small proxy later. Out of scope now. |
| Play text format changes | FG distances or 2-point conversions missed | Parsing is isolated and covered by fixture tests. |
| Polling load with many open tabs | Rate limiting | Personal use only; polling only for live games, paused in hidden tabs. |
