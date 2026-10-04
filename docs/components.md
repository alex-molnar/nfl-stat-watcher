# UI components

## Header
Props: `actions?: ReactNode` (extra buttons, for example "Add player").
Shows the app name, Players and Settings links (current page marked with `aria-current`), and the theme toggle.

## ThemeToggle
No props. Shows "Dark mode" in the light theme and "Light mode" in the dark theme. Stores the choice in `nflsw:v1:theme`.

## MainPage
No props. States: empty (nothing followed), grouped (Live now, Final, Later, Bye week), schedule unavailable (one "Followed" group, cards say "Game status unavailable"), scoreboard error with older data (note under the header), loading games ("Loading games"). Page-level notes (loading and retry) use `role="status"`.

## EntryCard
The card name is an `h3`.
Props: `entry: FollowedEntry`, `game: GameInfo | null`, `profiles: Profile[]`, `hasSchedule: boolean`.
States: live (wide, mini field, situation and last play), live in the red zone (orange outline and "Red zone" label, only for offensive players of the team with the ball), final (result line), scheduled (kickoff time, "No stats until kickoff"), bye, no stats, breakdown open, retry note.

## MiniField
Props: `game: GameInfo`, `situation: Situation`.
The offense always attacks to the right. Endzones use team colors with contrast-checked text. The ball glides within a possession and jumps on a change of possession.

## Bump
Props: `value: string`. Highlights the value for 900ms when it changes. No animation under reduced motion.

## AddDialog
Props: `open: boolean`, `onClose: () => void`.
States: hint (fewer than 2 letters), loading team for a result, results (team defenses first, then players), added, free agent (lookup succeeded with no team, cannot be added), details unavailable (the athlete lookup failed, cannot be added), no matches, search unavailable. Result counts and messages share one `role="status"` line. The Add buttons for Added and free-agent results use `aria-disabled`, not `disabled`, so focus stays on the button.

## SettingsPage
No props. Profile list plus the selected profile's form: name, preset (with confirmation), value groups Offense, Kicker, IDP and Team defense (with points-allowed tiers). Delete is disabled for the last profile and asks where to move followed cards.
