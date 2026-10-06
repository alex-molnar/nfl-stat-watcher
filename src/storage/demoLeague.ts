import { addEntry } from './followed';
import { addProfile, profilesStore } from './profiles';
import type { FollowedEntry } from './types';

export const DEMO_LEAGUE = 'Demo league';

// Real ESPN ids, so the cards show live points straight away.
const DEMO_PLAYERS: Omit<FollowedEntry, 'profileId'>[] = [
  { kind: 'player', espnId: '3139477', name: 'Patrick Mahomes', teamId: '12', teamAbbr: 'KC', position: 'QB', jersey: '15' },
  { kind: 'player', espnId: '4569987', name: 'Jaylen Warren', teamId: '23', teamAbbr: 'PIT', position: 'RB', jersey: '30' },
  { kind: 'defense', espnId: '23', name: 'Pittsburgh Steelers', teamId: '23', teamAbbr: 'PIT', position: 'D/ST' },
];

/**
 * A ready-made league with three followed players, so a new user sees the app working without an ESPN import. It is an ordinary league:
 * delete it like any other. There is only ever one: asking again while it exists does nothing.
 */
export function addDemoLeague() {
  if (profilesStore.get().some((p) => p.name.trim().toLowerCase() === DEMO_LEAGUE.toLowerCase())) return;
  const id = addProfile(DEMO_LEAGUE);
  DEMO_PLAYERS.forEach((p) => addEntry({ ...p, profileId: id }));
}
