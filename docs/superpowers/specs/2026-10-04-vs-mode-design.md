# Stat Watch: vs mode design

Date: 2026-10-04. Builds on `2026-10-04-stat-watch-poc-design.md` (the PoC spec). Where this document is silent, the PoC spec and the shipped code apply.

## 1. Goal

Add a "vs mode": a split screen that shows a fantasy matchup. Your players for a league are on the left, your league opponent's players are on the right, each side has a running fantasy total, and a score bar shows who leads. Opponent players are added separately from your own.

## 2. Decisions made during brainstorming

| Question | Decision |
| --- | --- |
| What is vs mode for? | A fantasy matchup, your lineup against a league opponent's lineup, with a total per side and who is ahead. |
| How does it relate to leagues? | One matchup per league. Each league (profile) has its own opponent list. Vs mode shows one league at a time with a league picker. |
| Narrow screens | Stacked: your side on top, opponent below, with a sticky score bar. Side by side from tablet width up. |
| Scoring | Both sides use the selected league's scoring profile, so the comparison is fair. |
| Data model | Extend `FollowedEntry` with an optional `side`, reuse the `followed` store. No new store, no new localStorage key. |

Non-goals: weekly history, importing an opponent's roster, several matchups per league, per-side scoring profiles, projections.

## 3. Data model

`FollowedEntry` (src/storage/types.ts) gains one optional field:

```ts
side?: 'opponent'; // absent means "mine"
```

- Absent `side` is mine. All existing stored data stays valid with no migration.
- `isEntry` in src/storage/followed.ts accepts `side` when it is undefined or exactly `'opponent'`; any other value makes the entry invalid (the store falls back as it does today for corrupt data).
- Identity: `sameEntry`, `entryKey` and the `EntryKey` pick type include side, so the same real player may be on both sides of the same league. The key is `kind:espnId:profileId` for mine (unchanged, so existing keys and focus logic keep working) and `kind:espnId:profileId:opponent` for opponent entries. A shared helper `sideOf(entry)` returns `'mine' | 'opponent'`.
- `dedupe`, `addEntry`, `removeEntry`, `moveEntry` use the new `sameEntry`.
- `moveEntry` is for my entries only. Opponent entries never move between leagues; nothing in the UI exposes it.
- `updateEntryTeam` already updates every entry for an `espnId` (trades), so it needs no change and covers both sides.

### Profile lifecycle

- Deleting a profile moves my followed entries to the chosen target (existing behavior) and DELETES that league's opponent entries. An opponent list belongs to its league; merging two leagues' opponents would be wrong. The delete confirmation text states how many opponent entries are removed when there are any.
- `withValidProfiles` (orphan repair) keeps its behavior for my entries and drops opponent entries whose profile no longer exists. The startup repair in src/storage/profiles.ts uses the same function, so storage ends consistent.
- `usedBy` in Settings (the "Move N followed cards" count) counts only my entries.

## 4. Screens

### Route and navigation

- New route `/vs`, page component `VsPage` in src/ui/VsPage.tsx. Unknown routes still redirect to `/`.
- The header gets a third link "Vs" (NavLink to `/vs`) between Players and Settings. The existing focus-on-navigation behavior applies (the page needs a `data-page-title` heading, "Matchup"); the page title is "Matchup · Stat Watch".
- The Players page (MainPage) shows only my entries (`side` absent). Opponent entries never appear there, in counts or in the empty state.

### Layout

```
 League: [My league v]                         [Pause live updates] [Add player]
 +---------------------- score bar (sticky) ------------------------+
 |  YOU  84.20           leading by 12.40           OPP  71.80      |
 +------------------------------+-----------------------------------+
 | Your players       [+ Add]   | Opponent players       [+ Add]    |
 |  card  card  card            |  card  card  card                 |
 +------------------------------+-----------------------------------+
```

- A league picker (native select, labelled "League") chooses the matchup. It defaults to the first league and the choice is kept in memory only (React state, not persisted).
- Two columns (`.vs-col`) from 720px width up, each its own list. Below 720px the columns stack, mine first, and the score bar stays sticky at the top (`position: sticky`, token colors, a bottom border that meets 3:1).
- Each column header has its own Add button; the page header also exposes the shared Pause toggle (reused from the Players page).
- Cards reuse `EntryCard`. Opponent cards render the same content but WITHOUT the league select (they cannot move). Remove works on both sides and deletes only that entry.
- Within a column cards are ordered by the game groups already used (live first, then final, later, bye), flattened into one list per side with a small status per card already present in the card. No group headings inside columns (columns are narrow); the score bar and column headings carry the structure.
- Empty states: an empty side shows a short message and its Add button ("No players on your side yet" / "No opponent players yet"). With both sides empty the score bar still renders with 0.00 vs 0.00 and "Tied".

### Score bar

- Totals are the sum of the cards' scores for that side, scored with the selected league's profile (`scoreEntry` with that profile's values). Each total is rendered with `toFixed(2)`.
- Status text: "You lead by X.XX", "Opponent leads by X.XX" or "Tied", where X.XX is the absolute difference, `toFixed(2)`. Difference comparisons use values rounded to two decimals to avoid float noise.
- The score bar is one element: the visible text is the accessible text (labels "You" and "Opponent" spelled out, not just icons). Announcement: a separate visually hidden `role="status"` paragraph that changes only when the leader or the tie state changes, not on every score change (no per-poll chatter).
- Totals are computed in one hook, `useMatchup(profileId, paused)`, that returns the rows and totals; the page and the score bar read the same data. Each card still owns its own summary subscription (the existing `useGameSummary`), so totals come from the same query cache entries, not extra requests. Implementation note for the plan: summing across cards needs each card's score at the page level, so the score must be computed in the hook from the same `useQueries` results the cards use (shared query keys `['summary', eventId]`), not read back from the DOM.

### Add dialog

- `AddDialog` gets a `side: 'mine' | 'opponent'` prop and an optional fixed `profileId`. On `/vs` it is opened with the picker's league and the chosen side, and its own league select is hidden (the side and league are shown in the dialog title: "Add to your side" / "Add to opponent side, My league").
- On the Players page nothing changes (side mine, league select shown).
- `isFollowed` checks the same `side` and `profileId`, so a player already on the other side can still be added.
- Added entries carry `side: 'opponent'` when side is opponent (the key is absent for mine).

## 5. Shared pause and polling

The Pause toggle (src/storage/pause.ts, session only) applies to the vs page as well. Polling cadence, retry notes and the page note are unchanged; the vs page shows the same status paragraph (`role="status"`) as the Players page, merged into one status element so announcements do not double up with the score bar.

## 6. Accessibility

- WCAG 2.2 AA is the floor, same as the PoC. New patterns to verify: sticky bar does not obscure focus (2.4.11) and works at 320px reflow (1.4.10); score bar contrast and not color-only (leader stated in text); column structure uses headings (h2 per column) and lists; the league select and both Add buttons are labelled; focus after Remove follows the existing next, previous, header button rule within the vs page; focus after dialog close returns to the Add button that opened it; `aria-current` on the Vs nav link.
- Forced colors and reduced motion: no new motion; the score bar uses system colors in forced-colors mode.

## 7. Testing

- Storage: `side` validation (accepts undefined and 'opponent', rejects others); same player on both sides of one league is two entries; add, remove and dedupe per side; profile delete removes that league's opponent entries and moves mine; orphan repair drops orphaned opponent entries and still moves mine; existing data without `side` loads unchanged.
- Hook: `useMatchup` totals per side with the selected profile, ties, empty sides, paused state, one query per game shared between sides.
- Components: Players page hides opponent entries; Vs page renders both sides, opponent cards have no league select, Remove works per side, league picker switches the matchup, Add dialog adds to the right side and league, score bar text for lead, opponent lead and tie, status announcement only on leader change, header link and page title and focus, narrow layout stacks (CSS class presence; real layout checked in the browser).
- A real-browser check at 320, 390 and 1280px in both themes with an end-to-end add on both sides, a reload (persistence), and a profile delete with opponents.

## 8. Repository and docs

- New files: `src/ui/VsPage.tsx`, `src/ui/ScoreBar.tsx`, `src/hooks/useMatchup.ts`, plus tests next to the code. Modified: types, followed store, profiles startup repair (unchanged call, new behavior), AddDialog, EntryCard (hide league select for opponent), MainPage (filter), Header, App, SettingsPage (delete text and `usedBy`), styles.css.
- Docs: `docs/components.md` documents VsPage, ScoreBar, the AddDialog props and the EntryCard opponent variant; README gets a short "Vs mode" paragraph. This spec stays in `docs/superpowers/specs/`.
- No new runtime dependency. All ESPN calls still live in `src/espn/client.ts`.
