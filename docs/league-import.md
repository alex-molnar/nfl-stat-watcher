# ESPN league scoring import

Stat Watch can import ESPN fantasy football scoring settings into a local scoring profile. This imports scoring rules and lineup-slot counts only; it does not import fantasy rosters, matchups, or player ownership.

## Import a league

In **Settings**, choose **Import leagues**, paste one ESPN football league URL or decimal league ID per line, and enter the fantasy season. Stat Watch tries the public settings endpoint first. It previews each league independently, so a private league failure does not discard successful public results. Select the profiles to save and acknowledge any compatibility notes before importing.

Each profile keeps its ESPN league ID, season, import time, settings snapshot and scoring-map version. Refreshing an imported profile shows source changes; when the profile's scoring values were edited locally, choose whether to preserve those values or replace them with ESPN's current settings. Disconnect removes the source link and keeps the current values. If browser storage is full, imported profiles stay available for the current session and the UI says they were not saved.

## Private league access

A private league's settings need your own ESPN session, which Stat Watch never sees. When ESPN denies a league, its card shows a short guide that needs no install:

1. Stay signed in to ESPN in the same browser and open the league's settings data link shown on the card (it is ESPN's `mSettings` URL for that league and season).
2. Select everything on that page, copy it and paste it into the card, then choose **Use pasted settings**.

Only scoring and lineup settings are kept; teams, members and rosters in the pasted text are discarded in your browser. The pasted league ID and season must match the card, and the profile records its source as "Settings file".

The optional Chrome companion in `extensions/espn-connector/` still exists for a one-click path. The **Connect ESPN and retry** button only appears when the build has `VITE_ESPN_CONNECTOR_ID` set to an installed companion; without one, use the paste guide above. See `docs/adr/0001-espn-private-settings-connector.md` and the companion README for its status.

## Scoring rules and switches

Every ESPN scoring rule the importer recognizes becomes a rule on the profile with its own weight and an On/Off switch (**Settings**, then the profile's groups). Turning a rule off scores nothing for it but keeps its weight, so turning it back on restores it. An imported profile starts with only the rules that league scores switched on, so a league without long-touchdown bonuses has those off and a league with them has them on.

Groups: Offense, Offense bonuses (40+ and 50+ yard touchdowns, 100/200 yard and 300/400 yard games), Offense volume, Kicker (made and missed by 0-39, 40-49, 50-59 and 60+ yards, plus aggregate missed), IDP, Team defense and Team defense yards allowed, alongside the points-allowed ranges.

How ESPN rules map:

- Several ESPN stats can score the same thing (for example stat 3 per yard and stat 8 "every 25 passing yards"); ESPN adds them, and so does the importer. "Every N" rules are kept as whole steps, because ESPN floors them: 1 point per 25 passing yards gives 1 point at 40 yards and 2 at 50, not 1.6. They appear under **Stepped rules**.
- Total field goals (83) and 50+ yard field goals (74) are spread over the distance buckets they cover.
- Total tackles (109) counts as both a solo and an assisted tackle. ESPN "stuffs" (112) are treated as tackles for loss.
- Defensive, interception return, fumble return, blocked kick return and kick or punt return touchdowns each score once per touchdown. When a league scores them differently the site keeps the highest value and warns.
- Rules that scale by position, period, offset or distance are listed as warnings instead of being guessed.

Times sacked and kickoff and punt return yards come from the box score. Rules the live feed cannot supply (fumble recovered for TD, forced fumbles, blocked kicks, 2-point returns, 1-point safeties) are imported and kept on the profile, labelled "Not tracked in the live game feed", and never score. Touchdown lengths come from play-by-play text, field goal distances (made and missed) from play text, game yardage bonuses from the box score and yards allowed from the opponent's total yards. Stat IDs come from the community `cwendt94/espn-api` constants; ESPN publishes no contract, so an unknown ID is shown as a warning. Profiles imported before this mapping show a notice to refresh them.

## Scoring compatibility

Supported rules are listed in `src/leagues/espn/statMap.ts`. The importer does not silently claim parity: it lists rules it cannot represent and retains the warnings on the profile. D/ST points-allowed bands are stored as explicit ranges and score only the applicable range; ESPN can exclude special teams or defensive scores from points allowed, which the site cannot. Manual profiles keep the existing fixed tiers.

Imports are snapshots, not live synchronization. Refresh when you want to pick up commissioner changes. Stat Watch stores profiles and settings locally in the browser; it does not send them to an application server.
