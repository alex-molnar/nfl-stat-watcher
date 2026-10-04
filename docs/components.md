# UI components

## Header
Props: `actions?: ReactNode` (extra buttons, for example "Add player").
Shows the app name, Players, Vs and Settings links (current page marked with `aria-current`), and the theme toggle.

## ThemeToggle
No props. Shows "Dark mode" in the light theme and "Light mode" in the dark theme. The label names the action and follows the effective theme (stored choice, else the OS preference, including OS changes while open), so it never goes stale. Stores the choice in `nflsw:v1:theme`.

## MainPage
No props. Shows only your own entries; opponent entries (vs mode) never appear here, in cards or in the empty state. States: empty (nothing of yours followed), grouped (Live now, Final, Later, Bye week), schedule unavailable (one "Followed" group, cards say "Game status unavailable"), scoreboard error with older data (note under the header), loading games ("Loading games"). Page-level notes (loading, paused, retry) share one `role="status"` element that stays mounted and only changes its text.

Pause live updates: a header button (`PauseButton`, shared with the vs page) with `aria-pressed`, labelled "Pause live updates" or "Resume live updates". While paused, scoreboard and live summary polling and window-focus refetching stop, loaded data stays visible and the status line says "Live updates are paused. The numbers shown may be out of date." Resuming refetches the scoreboard and loaded summaries immediately. The choice lives in an in-memory store (`src/storage/pause.ts`): it survives navigation within the session but is never stored. Card retry notes are hidden while paused, and window-focus and reconnect refetching stop too. `EntryCard` takes an optional `paused` prop and `onMove` and `onRemove` callbacks (the page owns focus handling).

## VsPage
Route `/vs`, no props. Title "Matchup · Stat Watch" and a visually hidden "Matchup" `h2` (`data-page-title`). A native select labelled "Matchup league" picks the matchup; it starts on the first league and the choice lives in React state only, never in storage. The header holds the shared PauseButton. One `role="status"` paragraph carries one string, the page note (loading, paused, retry) and a visually hidden leader phrase ("You lead", "Opponent leads", "Tied"), joined with a sentence break, or a single space when the note already ends with a period. The phrase changes only when the lead changes hands, stays empty until the scoreboard and every needed summary have finished loading for the picked league (latched per league, so adding a card never blanks it) and while both sides are empty. A layout effect with a ResizeObserver publishes the score bar's measured height as `--score-bar-h` on the root element. Below it the sticky ScoreBar, then two `.vs-col` sections, each with an `h2` ("Your players", "Opponent players"), an "Add player" button named "Add player to your side" or "Add player to opponent side", and one list of cards ordered live, final, later, bye (no group headings). Columns sit side by side from 720px and stack below, mine first. Cards on this page have no league select (`movable={false}`): moving a card between leagues stays on the Players page, because a select that changes on an arrow key would pull the card out of the matchup mid-keypress. Remove focuses the next card, else the previous, else the column Add button, after the removal has rendered (`flushSync`), then calls `scrollIntoView({ block: 'nearest' })` so the focus clears the sticky bar; the dialog close does the same for the Add button.
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

`useMatchup(profileId, paused)` (src/hooks/useMatchup.ts) returns the selected league's profile, the rows per side (ordered live, final, later, bye), each row's points, the totals and `settled` (false while the scoreboard or any needed summary is loading). It reads one `['summary', eventId]` query per game through `summaryQuery()`, the same cache entries the cards use, so the totals add no requests.

## AddDialog
Props: `open: boolean`, `onClose: () => void`, `side?: 'mine' | 'opponent'` (default mine), `profileId?: string` (a fixed league). On the Players page neither is passed: the title is "Add a player or defense" and a League select chooses the league. With `profileId` (vs mode) the League select is hidden and the title names side and league: "Add to your side, My league" or "Add to opponent side, My league". "Added" checks the same side and league, so a player already on the other side can still be added. Opponent entries are stored with `side: 'opponent'`; my entries never carry the key.
States: hint (fewer than 2 letters), loading team for a result, results (team defenses first, then players), added, free agent (lookup succeeded with no team, cannot be added), details unavailable (the athlete lookup failed, cannot be added), no matches, search unavailable (player search failed; team defenses still show, with a note), team defenses unavailable (only the team list failed; player results still show, with a note). Result counts and messages share one `role="status"` line. The Add buttons for Added and free-agent results use `aria-disabled`, not `disabled`, so focus stays on the button.

## SettingsPage
No props. Profile list plus the selected profile's form: name, preset (a select plus an "Apply preset" button; only the button asks for confirmation, and it is disabled while the select reads Custom or the profile's current preset), value groups Offense, Kicker, IDP and Team defense, plus collapsible Offense bonuses, Offense volume and Team defense yards allowed. Every rule has an On/Off checkbox (accessible name "Count <rule>"); off rules are disabled, keep their weight and score nothing, and rules the live feed cannot supply carry a "never scores" note. Imported profiles with non-standard D/ST points-allowed ranges show editable min/max/points rows; manual profiles keep the seven fixed tiers. Applying a preset clears imported ranges. Imported profiles show ESPN source, season, last refresh and compatibility notices, with Refresh and Disconnect actions. Disconnect removes source metadata while keeping current scoring values. The profile list is a plain list under a visually hidden "Profiles" heading (no `nav`); the selected button has `aria-current`. Delete is disabled for the last profile and asks where to move followed cards; when the confirm shows a question, the Cancel button is described by it. The move count counts only your own cards. A league's opponent cards (vs mode) are removed with it, never moved; when there are any, the confirm says "Also removes 2 opponent cards." and that sentence describes the select (or Cancel, when nothing of yours moves).

## ImportLeaguesDialog
Props: `open`, `onClose`, `onImported(message)`, optional `refreshProfileId`. Accepts one or more ESPN football links/decimal league IDs and requires an explicit season. Loads up to three settings requests concurrently, keeps successful entries when another entry fails, previews lineup/scoring, and requires acknowledgement when normalization reports compatibility issues. Each result card and repeated control names identify their league. The user chooses whether to create, replace a manual profile or refresh a linked profile. A refresh with local scoring edits requires an explicit preserve-or-replace decision. The import button reports whether browser storage saved the profiles. Private requests first try anonymous settings; on access denial the configured Chrome companion may open/reuse an ESPN tab and return sanitized settings. If ESPN denies access, the user checks the active account/membership and retries. This route has not been verified end to end. Escape, Cancel and Close abort pending loads. States include loading, partial/full results, per-league error, warning acknowledgement, local-edit conflict, save success/session-only save and cancellation.

Field messages (WCAG 3.3.1): an invalid or empty number field reverts on blur and says "Enter a number. Restored 4."; an empty or duplicate profile name says "Name was empty. Using Untitled league." or "That name is taken. Using Dynasty 2." Each message is a `role="status"` sibling of the label (so it never becomes part of the field's name), linked with `aria-describedby` and cleared on the next edit.

## Focus management
- After a link navigation (not on first load, not on redirects) focus moves to the page heading (`data-page-title`, `tabindex="-1"`): the visually hidden "Players" `h2` on the main page, the visually hidden "Matchup" `h2` on the vs page, "Scoring profiles" on settings.
- On the vs page, Remove focuses the next card's points button in the same column, else the previous one, else that column's Add player button. Closing the add dialog returns focus to the Add player button that opened it.
- Remove on a card focuses the next card's points button, else the previous card's, else the header "Add player" button.
- Changing the league on a card keeps focus on that card's league select (the card remounts under its new key).
- Deleting a profile in settings focuses the newly selected profile's list button.

## Visual notes
- Ghost buttons (`.btn`, `.add`) use `--field-border` (6.3:1 light, 7.3:1 dark on the panel; the `.add` button sits on `--bg`: 5.4:1 light, 8.1:1 dark). Disabled buttons use the muted text color (6.3:1 and 7.3:1) instead of fading; a disabled `.add` uses muted text and a dashed border. Empty status regions are visually hidden rather than `display: none`, so announcements stay reliable. After cancelling the Apply preset confirm the select returns to the profile's current preset.
- MiniField: endzone labels are vertical so three-letter names fit the 20px endzone at 320px; the line of scrimmage is white (4.3:1 on light turf, 4.9:1 on the alternate stripe, 8.2:1 or more in dark); the red zone hatch is pale orange (3.2:1 light, 6.2:1 dark).
- The card Remove link is at least 24px by 24px.
- Forced colors: the field, endzones, line of scrimmage, ball, red zone card outline and the selected profile use borders and system colors (CanvasText, Highlight).
- Press scale does not apply to `aria-disabled` buttons.
- Score bar: sticky at the top, panel background, a 2px `--field-border` bottom border (5.4:1 light, 8.1:1 dark against the page background). The leader is stated in text, never by color. Below 720px it is two lines (both totals, then the status), one line above. On viewports shorter than 30em it stops sticking. `html:has(.score-bar)` sets `scroll-padding-top` to `var(--score-bar-h)` plus 8px, with 112px (below 720px) and 72px fallbacks until the measurement runs, so a focused card never hides under it (WCAG 2.4.11), including with text zoom or text spacing. Forced colors: Canvas background, CanvasText text and border.


## ImportStartersDialog

Props: `open`, `onClose`, `side` (`mine` or `opponent`, default `mine`), `profileId` (optional, fixes the league; vs mode passes it). Lists imported leagues when no `profileId` is given. Loads the league's rosters, shows a "Your team in this league" select (saved on the profile as `source.teamId`), previews the target team's starters and adds them with `addEntry`, skipping ones already followed. Access denied shows the paste guide for the roster data. Status and errors are announced through `role="status"` and `role="alert"` regions.


## Vs page grouping

Each column (your players, opponent players) groups its cards like the Players screen: **Live now** first with the larger live card (field strip, big points), then **Final**, **Later** and **Bye week** with the compact card, each under an `h3.group-title` and its own list. Empty groups are not rendered. On wide screens the two columns share one grid row per group (CSS subgrid), so a group starts at the same height on both sides and the shorter side leaves empty space. Compact groups fit two cards per row where there is room; cards narrower than 340px use tighter type via a container query. The order and titles live in `src/ui/gameGroups.ts`, shared with the Players screen.


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

ESPN's game summary carries an injury report per team (status such as Out, Questionable, Doubtful, plus the injury and return date), which `normalizeSummary` keeps as `GameStats.injuries`, keyed by athlete id. Games that have not started are now fetched too (one summary per game, refreshed every ten minutes, stopped by Pause), because designations change before kickoff.

`EntryCard` shows the designation as a chip beside the name ("Out · Ankle", "Questionable · Hamstring"); the word carries the meaning and the colour reinforces it (red for out, orange for doubtful, amber for questionable, neutral otherwise). A player ruled out (`isOut` in `src/stats/injury.ts`: out, injured reserve, suspension, PUP) is ranked last in the Live now group whatever the ball is doing, even before the game situation is known, and never gets the on-field or red zone styling. Questionable and doubtful players keep their normal order. Byes and games ESPN has no report for show no chip.


## Order during and after a celebration

When a refresh shows a celebrated play by a card's own player or defense (`scoringEvent`, any tier), `useLiveOrder` does two things to that card only (`RankHolds` in `src/stats/liveOrder.ts`; every other card moves at once):

- **Hold:** for as long as the celebration lasts (`SHOW_MS`, about four seconds) the card never sits lower than the rank it had before the play. After a touchdown the rest of the offense and the opposing defense slide back immediately while the scorer's card stays put under its animation. A hold only stops a card sliding down; it never delays one moving up.
- **Boost:** for `BOOST_MS` (30 seconds) the card sits at the top of its own group (red zone, on the field, or the rest), keeping position order among boosted cards, but never past the group above it. A quarterback with a 25-yard pass outside the red zone rises above the skill players, and stays below everyone in the red zone. Another play extends the boost. Unranked and ruled-out cards are not boosted. A big bad play (an interception thrown, a fumble lost, a touchdown allowed, a missed field goal) only holds: the card stays put under its red animation, since the possession change moves it down, and then moves down by the normal rules with no lift. Small bad plays (sacked, a missed extra point, a field goal allowed) lift the card like any small play.

A second play during a hold keeps the original held rank and extends it. The hook sets a timer for the next hold or boost end so the page re-sorts then.
