import type { EspnTeamRef } from '../espn/types';
import { addEntry, followedStore, removeEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { fetchLeagueLineups } from './espn/lineup';
import { planStarterImport, starterEntry } from './starterPlan';

/**
 * Re-syncs the starters of every imported league whose rosters can be read without signing in, for the given sides.
 * Each side is overwritten: starters are added and every other card of that league and side is removed, whatever the
 * league's own "remove non starters" choice. Private leagues (and any league that fails to load) are left as they are,
 * silently: they need the bookmark or a paste, which only the sync dialog offers.
 */
export async function syncPublicLeagues(sides: Side[], nflTeams: EspnTeamRef[], signal: AbortSignal): Promise<void> {
  for (const profile of profilesStore.get()) {
    const source = profile.source;
    if (!source?.teamId) continue;
    let lineups;
    try {
      lineups = await fetchLeagueLineups(source.leagueId, source.season, signal);
    } catch {
      continue;
    }
    if (signal.aborted) return;
    const mine = lineups.teams.some((team) => team.id === source.teamId) ? source.teamId : '';
    for (const side of sides) {
      const team = side === 'mine' ? mine : mine ? lineups.opponentOf[mine] ?? '' : '';
      if (!team) continue;
      const incoming = (lineups.starters[team] ?? []).flatMap((starter) => starterEntry(starter, side, profile.id, nflTeams) ?? []);
      const plan = planStarterImport(incoming, followedStore.get(), profile.id, side, true);
      plan.removed.forEach(removeEntry);
      plan.added.forEach(addEntry);
    }
  }
}
