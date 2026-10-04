# UI components

## Header
Props: `actions?: ReactNode` (extra buttons, for example "Add player").
Shows the app name, Players and Settings links (current page marked with `aria-current`), and the theme toggle.

## ThemeToggle
No props. Shows "Dark mode" in the light theme and "Light mode" in the dark theme. The label names the action and follows the effective theme (stored choice, else the OS preference, including OS changes while open), so it never goes stale. Stores the choice in `nflsw:v1:theme`.

## MainPage
No props. States: empty (nothing followed), grouped (Live now, Final, Later, Bye week), schedule unavailable (one "Followed" group, cards say "Game status unavailable"), scoreboard error with older data (note under the header), loading games ("Loading games"). Page-level notes (loading, paused, retry) share one `role="status"` element that stays mounted and only changes its text.

Pause live updates: a header button with `aria-pressed`, labelled "Pause live updates" or "Resume live updates". While paused, scoreboard and live summary polling and window-focus refetching stop, loaded data stays visible and the status line says "Live updates are paused. The numbers shown may be out of date." Resuming refetches the scoreboard and loaded summaries immediately. The choice lives in component state only (session, never stored). `EntryCard` takes an optional `paused` prop and `onMove` and `onRemove` callbacks (the page owns focus handling).

## EntryCard
The card name is an `h3`.
Props: `entry: FollowedEntry`, `game: GameInfo | null`, `profiles: Profile[]`, `hasSchedule: boolean`, `paused?: boolean` (stops live polling), `onMove(entry, toProfileId)`, `onRemove(entry, button)`.
States: live (wide, mini field, situation and last play), live in the red zone (orange outline and "Red zone" label, only for offensive players of the team with the ball), final (result line), scheduled (kickoff time, "No stats until kickoff"), bye, no stats, breakdown open, retry note.

## MiniField
Props: `game: GameInfo`, `situation: Situation`.
The `role="img"` label is "KC has the ball, 25 yards from the end zone" (the down and distance text is already in the card). The offense always attacks to the right. Endzones use team colors with contrast-checked text. The ball glides within a possession and jumps on a change of possession.

## Bump
Props: `value: string`. Highlights the value for 900ms when it changes. No animation under reduced motion.

## AddDialog
Props: `open: boolean`, `onClose: () => void`.
States: hint (fewer than 2 letters), loading team for a result, results (team defenses first, then players), added, free agent (lookup succeeded with no team, cannot be added), details unavailable (the athlete lookup failed, cannot be added), no matches, search unavailable (player search failed; team defenses still show, with a note), team defenses unavailable (only the team list failed; player results still show, with a note). Result counts and messages share one `role="status"` line. The Add buttons for Added and free-agent results use `aria-disabled`, not `disabled`, so focus stays on the button.

## SettingsPage
No props. Profile list plus the selected profile's form: name, preset (a select plus an "Apply preset" button; only the button asks for confirmation, and it is disabled while the select reads Custom), value groups Offense, Kicker, IDP and Team defense (with points-allowed tiers). The profile list is a plain list under a visually hidden "Profiles" heading (no `nav`); the selected button has `aria-current`. Delete is disabled for the last profile and asks where to move followed cards; when the confirm shows a question, the Cancel button is described by it.

Field messages (WCAG 3.3.1): an invalid or empty number field reverts on blur and says "Enter a number. Restored 4."; an empty or duplicate profile name says "Name was empty. Using Untitled league." or "That name is taken. Using Dynasty 2." Each message is a `role="status"` element linked with `aria-describedby` and cleared on the next edit.

## Focus management
- After a link navigation (not on first load, not on redirects) focus moves to the page heading (`data-page-title`, `tabindex="-1"`): the visually hidden "Players" `h2` on the main page, "Scoring profiles" on settings.
- Remove on a card focuses the next card's points button, else the previous card's, else the header "Add player" button.
- Changing the league on a card keeps focus on that card's league select (the card remounts under its new key).
- Deleting a profile in settings focuses the newly selected profile's list button.
