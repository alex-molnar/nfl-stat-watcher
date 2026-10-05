# UI components

## Header (pinned)
The header is pinned to the top of every page (Players, Vs Mode, Leagues, Settings), on screens wider than 760px and taller than 30em. A phone wraps it to several rows and a very short window would lose most of its height to it (WCAG 1.4.10), so there it scrolls away like any content. `Header` publishes its measured height as `--header-h`; the Vs score bar sticks at that offset directly under it, the settings left menu likewise, and `scroll-padding-top` includes it (and the score bar on Vs), so a focused card is never hidden behind either.

Props: `actions?: ReactNode` (extra buttons, for example "Add player").
Shows the football icon (inline, the same drawing as the tab icon) and the app name on the left, then the page's own `actions`, then the Players, Vs Mode, Leagues and Settings links (current page marked with `aria-current`) and the theme toggle pinned to the right edge (`.top-end`), so the tabs and toggle stay at the same position on every page however many buttons a page adds.

## ThemeToggle
No props. A switch with a sun on the left and a crescent on the right and a thumb that slides over the active theme. It has no visible text; its accessible name is "Dark mode" in the light theme and "Light mode" in the dark theme. The name names the action and follows the effective theme (stored choice, else the OS preference, including OS changes while open), so it never goes stale. Stores the choice in `nflsw:v1:theme`.

## MainPage
No props. Shows only your own entries; opponent entries (vs mode) never appear here, in cards or in the empty state. States: empty (nothing of yours followed), grouped (Live now, Later, Final, Bye week), schedule unavailable (one "Followed" group, cards say "Game status unavailable"), scoreboard error with older data (note under the header), loading games ("Loading games"). Page-level notes (loading, paused, retry) share one `role="status"` element that stays mounted and only changes its text.

Pause live updates: a header button (`PauseButton`, shared with the vs page) with `aria-pressed`, labelled "Pause live updates" or "Resume live updates". While paused, scoreboard and live summary polling and window-focus refetching stop, loaded data stays visible and the status line says "Live updates are paused. The numbers shown may be out of date." Resuming refetches the scoreboard and loaded summaries immediately. The choice lives in an in-memory store (`src/storage/pause.ts`): it survives navigation within the session but is never stored. Card retry notes are hidden while paused, and window-focus and reconnect refetching stop too. `EntryCard` takes an optional `paused` prop and `onMove` and `onRemove` callbacks (the page owns focus handling).

## VsPage
Route `/vs`, no props. Title "Matchup · Stat Watch" and a visually hidden "Matchup" `h2` (`data-page-title`). A native select labelled "Matchup league" picks the matchup; it starts on the first league, offers "All" first when more than one league exists (every league's cards on both sides, each scored with its own league and tagged with its league chip, totals summed; Add player opens the dialog with a league select and the side in its title, Sync starters and Sync all starters go through every imported league as described under ImportStartersDialog; only the imported-limits warning is hidden), and the choice lives in React state only, never in storage. The header holds the shared PauseButton. One `role="status"` paragraph carries one string, the page note (loading, paused, retry) and a visually hidden leader phrase ("You lead", "Opponent leads", "Tied"), joined with a sentence break, or a single space when the note already ends with a period. The phrase changes only when the lead changes hands, stays empty until the scoreboard and every needed summary have finished loading for the picked league (latched per league, so adding a card never blanks it) and while both sides are empty. A layout effect with a ResizeObserver publishes the score bar's measured height as `--score-bar-h` on the root element. Below it the sticky ScoreBar, then two `.vs-col` sections, each with an `h2` ("Your players", "Opponent players"), an "Add player" button named "Add player to your side" or "Add player to opponent side", and one list of cards ordered live, final, later, bye (no group headings). Columns sit side by side from 720px and stack below, mine first. Cards on this page have no league select (`movable={false}`): moving a card between leagues stays on the Players page, because a select that changes on an arrow key would pull the card out of the matchup mid-keypress. Remove focuses the next card, else the previous, else the column Add button, after the removal has rendered (`flushSync`), then calls `scrollIntoView({ block: 'nearest' })` so the focus clears the sticky bar; the dialog close does the same for the Add button.
States: empty side ("No players on your side yet", "No opponent players yet"; the column Add button stays), both empty (0.00 against 0.00, "Tied"), loading games (columns wait for the schedule), a card whose game failed shows the retry note and counts 0.00 while the other side keeps scoring, paused.

## PauseButton
No props. The `aria-pressed` "Pause live updates" / "Resume live updates" button described under MainPage. The same file exports `usePaused()` (the session-only flag from `src/storage/pause.ts`) and `pageNote(loading, paused, scoreboard)`, the shared page status text.

## EntryCard
The card name is an `h3`.
Props: `entry: FollowedEntry`, `game: GameInfo | null`, `profiles: Profile[]`, `hasSchedule: boolean`, `paused?: boolean` (stops live polling), `movable?: boolean` (default true; the League select, named "League for {name}", renders only when movable and not an opponent card), `onMove?(entry, toProfileId)` (used by the select), `onRemove(entry, button)`.
States: live (wide, mini field, situation and last play), live in the red zone (orange outline and "Red zone" label, only for offensive players of the team with the ball), final (result line), scheduled (kickoff time, "No stats until kickoff"), bye, no stats, breakdown open, retry note.

Opponent variant: an entry with `side: 'opponent'` renders the same content without the league select (opponent cards never move between leagues), and its Remove button is named "Remove {name} from opponent side, {league}". Cards are keyed by `entryKey` from `src/storage/followed.ts` (`kind:espnId:profileId`, plus `:opponent` for opponent entries).

## MiniField
Props: `game: GameInfo`, `situation: Situation`.
The `role="img"` label is "KC has the ball, 25 yards from the end zone" (the down and distance text is already in the card). The offense always attacks to the right. Endzones use team colors with contrast-checked text. The ball glides within a possession and jumps on a change of possession.

## Bump
Props: `value: string`. Highlights the value for 900ms when it changes. No animation under reduced motion.

## ScoreBar
Props: `mine: number`, `opponent: number` (totals from `useMatchup`), optional `ref` to the bar element, optional `settled` (default true; false shows "Loading" in place of the lead text). One element with the text "You 84.20 You lead by 12.40 Opponent 71.80": both labels spelled out, totals with two decimals, and the status "You lead by X.XX", "Opponent leads by X.XX" or "Tied". The lead is compared in whole cents, so float noise never shows "You lead by 0.00". The bar has no live region of its own; the page announces `LEADER_TEXT` ("You lead", "Opponent leads", "Tied"), which changes only when the lead changes hands.

`useMatchup(profileId, paused)` (src/hooks/useMatchup.ts; `ALL_LEAGUES` as the id means every league, flagged by `all`) returns the selected league's profile, the rows per side (ordered live, final, later, bye), each row's points, the totals and `settled` (false while the scoreboard or any needed summary is loading). It reads one `['summary', eventId]` query per game through `summaryQuery()`, the same cache entries the cards use, so the totals add no requests.

## AddDialog
Props: `open: boolean`, `onClose: () => void`, `side?: 'mine' | 'opponent'` (default mine), `profileId?: string` (a fixed league). On the Players page neither is passed: the title is "Add a player or defense" and a League select chooses the league. With `profileId` (vs mode) the League select is hidden and the title names side and league: "Add to your side, My league" or "Add to opponent side, My league". "Added" checks the same side and league, so a player already on the other side can still be added. Opponent entries are stored with `side: 'opponent'`; my entries never carry the key.
States: hint (fewer than 2 letters), loading team for a result, results (team defenses first, then players), added, free agent (lookup succeeded with no team, cannot be added), details unavailable (the athlete lookup failed, cannot be added), no matches, search unavailable (player search failed; team defenses still show, with a note), team defenses unavailable (only the team list failed; player results still show, with a note). Result counts and messages share one `role="status"` line. The Add buttons for Added and free-agent results use `aria-disabled`, not `disabled`, so focus stays on the button.

## LeaguesPage
No props, route `/leagues`. Profile list plus the selected profile's form: name, preset (a select plus an "Apply preset" button; only the button asks for confirmation, and it is disabled while the select reads Custom or the profile's current preset), value groups Offense, Kicker, IDP and Team defense, plus Offense bonuses, Offense volume and Team defense yards allowed. Every rule has an On/Off checkbox (accessible name "Count <rule>"); off rules are disabled, keep their weight and score nothing, and rules the live feed cannot supply carry a "never scores" note. Imported profiles with non-standard D/ST points-allowed ranges show editable min/max/points rows; manual profiles keep the seven fixed tiers. Applying a preset clears imported ranges. Imported profiles show ESPN source, season, last refresh and compatibility notices, with Refresh and Disconnect actions. Disconnect removes source metadata while keeping current scoring values. The profile list is a plain list under a visually hidden "Profiles" heading (no `nav`); the selected button has `aria-current`. Delete is disabled for the last profile and asks where to move followed cards; when the confirm shows a question, the Cancel button is described by it. The move count counts only your own cards. A league's opponent cards (vs mode) are removed with it, never moved; when there are any, the confirm says "Also removes 2 opponent cards." and that sentence describes the select (or Cancel, when nothing of yours moves).

## SettingsPage
No props, route `/settings`. App-wide preferences, edited like a league: changes wait in a working copy and only **Save** writes them, with Save and Cancel (the shared `SaveActions`, exported from `LeaguesPage`) at the bottom of the page while there is an unsaved change (there is no side menu). Closing or reloading the tab with unsaved changes triggers the browser's own warning.
- **Name display mode**: a radio group, Full (default), Initial or Formal, with a one-line explanation above it and an "e.g." example beside each option (linked with `aria-describedby`, outside the label so the radio's name stays the mode). For David Montgomery: Full is "David Montgomery", Initial "D. Montgomery", Formal "Montgomery, David". Stored as `"full" | "initial" | "formal"` under `nflsw:v1:nameDisplay` (`nameDisplayStore`, `src/storage/nameDisplay.ts`). `displayName` (`src/ui/format.ts`) applies it wherever a player's name is shown: the card title and its button labels, the highlights dialog title, the Add dialog results and the Sync starters lists. Names stay stored in full, so changing the mode needs no migration. Suffixes (Jr., II) and particles (St., Van) stay with the last name; one-word names and team defenses are never changed. An unknown stored value falls back to Full.
- **DAZN game links** (proof of concept, nothing uses the result yet; the legend carries a blue "Experimental, untested" tag, deliberately not a warning colour, and while the box is ticked, even before saving, a `role="note"` warning above the button says games are synced anyway but opening one relies on being logged in to DAZN): a checkbox "Expose DAZN games" (`daznEnabledStore`, off by default, saved with Save like the name mode) and a button "Sync game links with DAZN" that works at once. Both go through this site's own origin: `/dazn/` is forwarded to `www.dazn.com` by `nginx.conf` (and by the Vite dev server), because DAZN sends no CORS headers. The proxy sends the user agent `StatWatch/1.0` on purpose: DAZN gives browser-like agents a client-rendered shell without the schedule, and other agents the full page. `syncDaznLinks` (`src/dazn/links.ts`) reads the "Live and Coming Up" row of the NFL Game Pass schedule for region `en-NL`, keeps tiles titled exactly "<away nickname> @ <home nickname>" (so the Spanish broadcast, Prime Vision, Manningcast and preview variants never match), matches them to the scoreboard's games and saves ESPN event id to DAZN path in `daznLinksStore` (`nflsw:v1:daznLinks`). Only live and upcoming games are in that row, so finished games stay unlinked. With the setting on, `DaznAutoSync` (mounted in `AppRoutes`) syncs once per page load, never periodically; a failure is only logged there, while the button shows it in the status line. The page says when it last synced and how many games were linked.
- **Clear my data** (danger button): opens a modal `dialog` warning that followed players, leagues, scoring and settings are deleted from this browser and it cannot be undone. **Keep my data** is the first, filled (primary) button and takes the initial focus; **Clear my data** is the red outlined one. Confirming runs `localStorage.clear()` and `reloadAllStores()`, so every store returns to its defaults (one fresh "My league", no followed players) without a page reload, and drops any unsaved change. Escape or a click on the backdrop keeps the data. If storage is blocked the page says so instead.

## ImportLeaguesDialog
Props: `open`, `onClose`, `onImported(message)`, optional `refreshProfileId`. Accepts one or more ESPN football links/decimal league IDs and requires an explicit season. Loads up to three settings requests concurrently, keeps successful entries when another entry fails, previews lineup/scoring, and requires acknowledgement when normalization reports compatibility issues. Each result card and repeated control names identify their league. The user chooses whether to create, replace a manual profile or refresh a linked profile. A refresh with local scoring edits requires an explicit preserve-or-replace decision. The import button reports whether browser storage saved the profiles. Private requests first try anonymous settings; on access denial the configured Chrome companion may open/reuse an ESPN tab and return sanitized settings. If ESPN denies access, the user checks the active account/membership and retries. This route has not been verified end to end. Escape, Cancel and Close abort pending loads. States include loading, partial/full results, per-league error, warning acknowledgement, local-edit conflict, save success/session-only save and cancellation.

Field messages (WCAG 3.3.1): an invalid or empty number field reverts on blur and says "Enter a number. Restored 4."; an empty or duplicate profile name says "Name was empty. Using Untitled league." or "That name is taken. Using Dynasty 2." Each message is a `role="status"` sibling of the label (so it never becomes part of the field's name), linked with `aria-describedby` and cleared on the next edit.

## Focus management
- After a link navigation (not on first load, not on redirects) focus moves to the page heading (`data-page-title`, `tabindex="-1"`): the visually hidden "Players" `h2` on the main page, the visually hidden "Matchup" `h2` on the vs page, "Scoring profiles" on leagues, "Settings" on settings.
- On the vs page, Remove focuses the next card's points button in the same column, else the previous one, else that column's Add player button. Closing the add dialog returns focus to the Add player button that opened it.
- Remove on a card focuses the next card's points button, else the previous card's, else the header "Add player" button.
- Changing the league on a card keeps focus on that card's league select (the card remounts under its new key).
- Deleting a profile in leagues focuses the newly selected profile's list button.

## Visual notes
- Ghost buttons (`.btn`, `.add`) use `--field-border` (6.3:1 light, 7.3:1 dark on the panel; the `.add` button sits on `--bg`: 5.4:1 light, 8.1:1 dark). Disabled buttons use the muted text color (6.3:1 and 7.3:1) instead of fading; a disabled `.add` uses muted text and a dashed border. Empty status regions are visually hidden rather than `display: none`, so announcements stay reliable. After cancelling the Apply preset confirm the select returns to the profile's current preset.
- MiniField: endzone labels are vertical so three-letter names fit the 20px endzone at 320px; the line of scrimmage is white (4.3:1 on light turf, 4.9:1 on the alternate stripe, 8.2:1 or more in dark); the red zone hatch is pale orange (3.2:1 light, 6.2:1 dark).
- The card Remove link is at least 24px by 24px.
- Forced colors: the field, endzones, line of scrimmage, ball, red zone card outline and the selected profile use borders and system colors (CanvasText, Highlight).
- Press scale does not apply to `aria-disabled` buttons.
- Score bar: sticky at the top, panel background, a 2px `--field-border` bottom border (5.4:1 light, 8.1:1 dark against the page background). The leader is stated in text, never by color. Below 720px it is two lines (both totals, then the status), one line above. On viewports shorter than 30em it stops sticking. `html:has(.score-bar)` sets `scroll-padding-top` to `var(--score-bar-h)` plus 8px, with 112px (below 720px) and 72px fallbacks until the measurement runs, so a focused card never hides under it (WCAG 2.4.11), including with text zoom or text spacing. Forced colors: Canvas background, CanvasText text and border.


## ImportStartersDialog ("Sync starters")

Props: `open`, `onClose`, `side` (`mine`, `opponent` or `both`, default `mine`), `profileId` (optional, fixes the league; vs mode passes it). Lists imported leagues, plus "All" (the loop below), in a League select when no `profileId` is given. Loads the league's rosters, shows a "Your team in this league" select (saved on the profile as `source.teamId`), previews what the import would do as three lists (green "To be added", red "To be removed", neutral "Unchanged", each with a sign and word as well as colour) and applies it. A checkbox, "Remove every non starter player" (saved per league as `source.removeNonStarters`, so it is the default next time), also removes cards already followed in that league and on that side who are not in the lineup; without it nothing is removed. `planStarterImport` (`src/leagues/starterPlan.ts`) decides the three lists for both the preview and the button: only cards of the same league and side are ever candidates for removal, and a lineup with no starters removes nothing. Access denied shows the paste guide for the roster data. With `side="both"` (the Vs screen's "Sync all starters" button, on the same line as the Matchup league select) the dialog shows one panel per side next to each other (stacked on a narrow screen), each with its own three lists, a single removal checkbox that applies to both, a "Cancel" button and a "Sync all starters" button that applies both plans in one go; on a bye only your side is shown. With `profileId={ALL_LEAGUES}` (Vs screen under "All") the dialog goes through the imported leagues in turn: a public league loads by itself, a private one shows the paste guide and, as soon as valid JSON is pasted, the loop moves to the next league ("League 2 of 3: NAME"; "Skip NAME" leaves one out). The confirm button stays disabled until the loop is done, then one preview aggregates all leagues per side, with each entry shown as NAME · POSITION followed by the league as a chip in the league's colour, a team select per league, and the single removal checkbox setting every league. The button inside the dialog, "Sync starters", applies the plan and closes the dialog; the result is announced through a `role="status"` region outside the dialog so it survives the close. Errors use `role="alert"`.


## Vs page grouping

Each column (your players, opponent players) groups its cards like the Players screen: **Live now** first with the larger live card (field strip, big points), then **Later**, **Final** and **Bye week** with the compact card, each under an `h3.group-title` and its own list. Empty groups are not rendered. On wide screens the two columns share one grid row per group (CSS subgrid), so a group starts at the same height on both sides and the shorter side leaves empty space. Compact groups fit two cards per row where there is room; cards narrower than 340px use tighter type via a container query. The order and titles live in `src/ui/gameGroups.ts`, shared with the Players screen.


## Live card order

Inside the **Live now** group, on both the Players and Vs screens, cards are ordered by `liveRank` (`src/stats/liveOrder.ts`): red zone first, then players whose side has the ball (offense with possession, defense and team defenses without it), then everyone else. Within a bucket: RB, WR, TE and FLEX, then QB, then kickers, then team defenses and IDP; equal cards keep the order they were added in. Other groups keep their order.

The rank is recomputed from the latest game data on every refresh (`useLiveOrder`, which shares the cards' summary cache and adds no requests), so cards re-sort when the ball changes hands. A card whose game has no situation yet sits after the ranked ones until it arrives. Each Vs column is ordered on its own.


## Live card styling

`EntryCard` marks a live card by the side of the ball (`onRightSide` in `src/stats/liveOrder.ts`): no class on the wrong side (the plain card), `on-field` on the right side (an accent bar on the left edge and a faint accent tint, plus screen reader text "Offense on the field" or "Defense on the field"), and `is-rz` in the red zone (the orange border and a pulsing glow instead of the on-field look, never both). The glow is a `::before` layer whose opacity pulses over 2.4 seconds, so nothing repaints or moves. It is static when the page's Pause button is on (the card gets `still`, WCAG 2.2.2), when the user prefers reduced motion, and absent in forced colors, where the thicker border carries the state.


## Drive end detection

`normalizeSummary` marks the live situation `driveOver` as soon as the offense is done, instead of waiting for the next team to run a play. A drive is over when ESPN's drive `result` is set, or when the last real play is a score, kick, turnover, conversion attempt or kickoff. Timeouts, period breaks and the two minute warning are looked past, because ESPN appends them to a drive right after a touchdown or field goal. While `driveOver` is set, nobody counts as being in the red zone or on the right side of the ball, so cards lose that styling and drop in the order until the next offense starts. Turnovers on downs and some fumbles have an ordinary last play, so they only clear once ESPN sets the drive result.


## Scoring play highlight

A live card celebrates a play in one of three tiers, decided by the single `TIERS` table in `src/stats/events.ts` (move a play by editing one line):

- **Big** (touchdown, field goal, interception, fumble recovery, safety): `EntryCard` takes over the whole card. It floods from the centre in the play's colour (gold for scores, the theme accent for turnovers), the play name pops in across it at a size taken from the card width, and a touchdown throws sparks. Touchdowns and field goals last about 2.6 seconds, the other big plays 1.8. It then clears to a small tag on the card's top edge.
- **Small** (extra point, 2-point conversion, sack, blocked kick, a single 10+ yard run or catch, a single 20+ yard pass): one ring from the card edge and a tag on the corner, with the label ("Sack", "14-yard catch"). Gold for kicks, the accent for defense, blue for long gains.
- **None**: shorter gains, tackles and anything else.

Every play also has a tone, `good` or `bad`, and bad plays use the same two tiers in one red palette (the `tone-bad` class; no sparks):

- **Big, bad**: an interception thrown, a fumble lost, a missed field goal, a touchdown allowed (a defense's points allowed jumping by six or more).
- **Small, bad**: being sacked, a missed extra point, a field goal allowed (points allowed rising by exactly three).
- **None**: a point after a touchdown, a safety against, and the rest.

Fumbles lost and interceptions thrown are read for offensive players only. A long gain counts only when exactly one carry, catch or completion arrived in the refresh, so several plays bundled into one refresh are never reported as one big play. A big play wins over a small one in the same refresh. The tag goes after about four seconds. Nothing loops, and a screen reader hears "<name>: <play>" through a polite live region on the card.

`scoringEvent` (`src/stats/events.ts`) compares two refreshes of the same game and reports the highest tier play whose count grew or whose single-play gain met the threshold. `useCelebration` calls it when new data arrives for a live game. The first data a card sees is only a baseline, so a reload never replays old plays, and games that are not live never animate. With reduced motion there is no sweep, pop, sparks or ring: the colour and the word simply appear and fade out, and small plays show just the tag. In forced colors the overlay uses system colors and a highlight border.


## Injury designations

Designations come from two ESPN sources. The game summary carries an injury report per team, but ESPN cuts it to five players per team, so most injured players are missing from it. The league-wide injury report (`/nfl/injuries`, about 350 KB over the wire) is complete, so `useLeagueInjuries` fetches it once and refreshes it every five minutes (not while paused); `parseLeagueInjuries` keys it by athlete id (taken from the player card link) and drops "Active" players. A card uses the game's own entry when it has one, because that updates every ten seconds during a game, and the league report otherwise (`injuryOf`), so a player out before kickoff or ruled out mid-game still shows. The summary's report is also kept as `GameStats.injuries`, keyed by athlete id. Games that have not started are now fetched too (one summary per game, refreshed every ten minutes, stopped by Pause), because designations change before kickoff.

`EntryCard` shows the designation as a chip beside the name ("Out · Ankle", "Questionable · Hamstring"); the word carries the meaning and the colour reinforces it (red for out, orange for doubtful, amber for questionable, neutral otherwise). A player ruled out (`isOut` in `src/stats/injury.ts`: out, injured reserve, suspension, PUP) is ranked last in the Live now group whatever the ball is doing, even before the game situation is known, and never gets the on-field or red zone styling. Questionable and doubtful players keep their normal order. Byes and games ESPN has no report for show no chip.


## Order during and after a celebration

When a refresh shows a celebrated play by a card's own player or defense (`scoringEvent`, any tier), `useLiveOrder` does two things to that card only (`RankHolds` in `src/stats/liveOrder.ts`; every other card moves at once):

- **Hold:** for as long as the celebration lasts (`SHOW_MS`, about four seconds) the card never sits lower than the rank it had before the play. After a touchdown the rest of the offense and the opposing defense slide back immediately while the scorer's card stays put under its animation. A hold only stops a card sliding down; it never delays one moving up.
- **Boost:** for `BOOST_MS` (30 seconds) the card sits at the top of its own group (red zone, on the field, or the rest), keeping position order among boosted cards, but never past the group above it. A quarterback with a 25-yard pass outside the red zone rises above the skill players, and stays below everyone in the red zone. Another play extends the boost. Unranked and ruled-out cards are not boosted. A big bad play (an interception thrown, a fumble lost, a touchdown allowed, a missed field goal) only holds: the card stays put under its red animation, since the possession change moves it down, and then moves down by the normal rules with no lift. Small bad plays (sacked, a missed extra point, a field goal allowed) lift the card like any small play.

A second play during a hold keeps the original held rank and extends it. The hook sets a timer for the next hold or boost end so the page re-sorts then.


## Highlights

A card for a player shows a small play button with a count on the card's bottom row, leftmost, on the same row as Remove (and the league select on the Players screen) when a highlight clip of the game is tagged with that player. On cards at least 400px wide it reads "Highlights 2"; on narrower ones just "▶ 2", so it fits beside Remove. A dot marks clips not opened yet during this page visit (kept in memory only, so a reload shows them as new again). Team defenses have no player tag and show no button.

Clips come from the `videos` list in the game summary the card already polls (every ten seconds while live), so a new clip appears within about ten seconds of ESPN publishing it, with no extra request. The summary lists clips without player tags, so each clip's tags are fetched once from ESPN's per-clip API (`getClipAthletes`) and cached for the session, shared by every card. Clips are shown newest first.

`HighlightsDialog` is a native `<dialog>`. A clip with a direct `.mp4` file plays inside it (a `video` element with controls); a single clip starts straight away. A clip with only a page opens that page in a new window (`noopener,noreferrer`). Only https links are accepted, and only `.mp4` files are played in the dialog.

The source is ESPN, not `api.nfl.com/content/v1/videos`: that endpoint answers 401 (`x-nfl-jwtstatus: FAILED`) to any request without an NFL-issued token, and a token sent from the browser would be visible to every user.


## Closing dialogs from the backdrop

Every dialog (add player, import leagues, import starters, highlights) also closes when the dimmed area around it is clicked, through the shared `backdropClose` props in `src/ui/backdropClose.ts`. The dialog fills its own box, so a click whose target is the `<dialog>` element itself landed on the backdrop. The press must also have started there, so selecting text inside a dialog and releasing the mouse outside it does not close it. The native `close` event still runs each dialog's own cleanup (aborting a running import, stopping the video, restoring focus).


## Card header layout

The header is a three-column grid. Row 1: the name, as wide as it can go (wrapping only when it must), and the points button, which also spans the row below. Rows 2 and 3: the full-size team circle with the three-letter code, spanning both rows, beside the team, position and opponent line and, under it, the league label. An injury designation is its own optional row beneath (absent for healthy players). Compact (non-live) cards use less padding (12px 14px), and cards narrower than 340px a smaller name and statistic type, so names and stat lines fit on one row more often. The bottom row (highlights, league, Remove) is pinned to the card's bottom edge, so in a row of cards of different heights every Remove button lines up. Compact cards (everything except Live now) also have a minimum height of 266px, the height of the longest possible one (two-line name, injury row, stat line and bottom row, measured on Antoine Winfield Jr.), so rows look even and shorter cards just have empty space above the bottom row. A card with more content (a wrapped stat line, the open points breakdown) still grows past it.

## League colour

Every profile has a colour (`Profile.color`, `#rrggbb`). A new league, made with Add profile or by importing, gets the next unused colour from `LEAGUE_COLORS` (`src/scoring/leagueColor.ts`; once all ten are used it starts over from the least used). Profiles saved before colours existed are given different ones in list order the first time they load. Leagues has a Color field (a native colour input) beside the name with a live preview tag, and the profile list shows the colour as a dot. The league tag on every card uses the colour as its background, with black or white text chosen for contrast (`textOn`). Refreshing a league from ESPN keeps its colour.


## Private league lineups bookmark

`PrivateLeagueHelp` can offer a bookmarklet (`bookmarklet` prop) beside the manual copy steps. It is a draggable `a` whose `javascript:` href is set on the element (React refuses that URL in a prop); clicking it on this site only explains to drag it. The code (`rosterBookmarklet`) is generated for one league and season, validates both as plain numbers, and writes a trimmed copy of ESPN's roster response in ESPN's own shape to the clipboard, so the same parser (`readLineups`) reads it.

The box is a paste target: a `paste` event takes the clipboard text, replaces the box's content with it and runs the import at once, showing any problem (`role="alert"`) under the box and leaving the pasted text visible. Text typed or dropped in instead is imported with the "Import these ..." button, which stays disabled while the box is empty. This applies to both the roster and the settings copy flows.


## Leagues page: selecting, editing and saving

- **No league is selected** when the page opens. The right side says to pick one (or add or import one) and shows no form.
- **Header and left menu stay in view.** The "Scoring profiles" title is the first thing in the left menu and sticks with it, just below the pinned header (see Header).
- **Left menu** (`.settings-side`, sticky above the 760px breakpoint so it stays in view while the long form scrolls): the league list, Add profile, Import leagues, then, once a league is selected, **Delete profile** (the same danger button and the same move-the-cards confirmation as before, moved here from the bottom of the form), then, while there are unsaved changes, **Save** and **Cancel**.
- **Edits go to a working copy**, not to storage. Changing the name, colour, preset, any value, switch, step or points-allowed tier shows Save and Cancel in the left menu and again at the end of the form, with an "Unsaved changes" note. **Save** writes the name, colour, preset and values to the saved profile (a name that is empty or clashes with another league is corrected the same way as on blur) and says "Saved <name>."; **Cancel** puts the saved values back, including in the name box. Apply preset also only changes the working copy.
- **Leaving with unsaved changes** (choosing another league or adding one) asks "Discard the unsaved changes to <name>?"; closing or reloading the tab triggers the browser's own warning. The working copy starts over when the saved league changes underneath it (an import, a refresh), so it never shows stale values.
- Not edits, so they happen at once: Delete profile after its confirmation, Refresh settings and Disconnect source (ESPN source section), and the saved team and removal choice of Sync starters.
- The pure edit rules live in `src/scoring/edit.ts` (`withValue`, `withRuleEnabled`, `withPreset` and so on); the store functions in `src/storage/profiles.ts` use the same ones.


## Collapsible league boxes

Every box on the league form (Offense, Offense bonuses, Offense volume, Kicker, IDP, Team defense, Team defense yards allowed, and for imported leagues Stepped rules and Team defense points allowed) is a `Box`: a `fieldset` whose own legend is the toggle, a button with a chevron and `aria-expanded`/`aria-controls`. There is no separate summary above it, and a folded box keeps its border and title. The main boxes start open; the optional ones start open only when the league scores something in them. Folding only hides the fields: edits stay in the working copy and Save still writes them.
