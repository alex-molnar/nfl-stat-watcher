import { isOffense } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameStats } from './types';

export interface PlayEvent {
  kind: 'td' | 'fg' | 'int' | 'fumble' | 'safety' | 'block' | 'sack';
  label: string;
}

const EVENTS: Record<PlayEvent['kind'], PlayEvent> = {
  td: { kind: 'td', label: 'Touchdown' },
  fg: { kind: 'fg', label: 'Field goal' },
  int: { kind: 'int', label: 'Interception' },
  fumble: { kind: 'fumble', label: 'Fumble recovery' },
  safety: { kind: 'safety', label: 'Safety' },
  block: { kind: 'block', label: 'Blocked kick' },
  sack: { kind: 'sack', label: 'Sack' },
};

const grew = (before: number | undefined, after: number | undefined) => (after ?? 0) > (before ?? 0);

/**
 * The biggest scoring-type play a card's player or defense just made, by comparing two refreshes of the same
 * game: a touchdown of any kind, a made field goal, or a defensive interception, fumble recovery, safety,
 * blocked kick or sack. Null when nothing like that happened. Order is biggest first.
 */
export function scoringEvent(entry: FollowedEntry, before: GameStats, after: GameStats): PlayEvent | null {
  const hit = (kinds: [PlayEvent['kind'], boolean][]) => {
    const found = kinds.find(([, happened]) => happened);
    return found ? EVENTS[found[0]] : null;
  };

  if (entry.kind === 'defense') {
    const a = before.defenses[entry.teamId];
    const b = after.defenses[entry.teamId];
    if (!b) return null;
    return hit([
      ['td', grew(a?.touchdowns, b.touchdowns)],
      ['int', grew(a?.interceptions, b.interceptions)],
      ['fumble', grew(a?.fumbleRecoveries, b.fumbleRecoveries)],
      ['safety', grew(a?.safeties, b.safeties)],
      ['block', grew(a?.blockedKicks, b.blockedKicks)],
      ['sack', grew(a?.sacks, b.sacks)],
    ]);
  }

  const a = before.players[entry.espnId];
  const b = after.players[entry.espnId];
  if (!b) return null;
  const defender = !isOffense(entry.position);
  return hit([
    ['td', grew(a?.passing?.touchdowns, b.passing?.touchdowns) || grew(a?.rushing?.touchdowns, b.rushing?.touchdowns)
      || grew(a?.receiving?.touchdowns, b.receiving?.touchdowns) || grew(a?.returns?.touchdowns, b.returns?.touchdowns)
      || grew(a?.defense?.touchdowns, b.defense?.touchdowns) || grew(a?.interceptions?.touchdowns, b.interceptions?.touchdowns)],
    ['fg', grew(a?.kicking?.fgMade, b.kicking?.fgMade)],
    ['int', defender && grew(a?.interceptions?.interceptions, b.interceptions?.interceptions)],
    ['fumble', defender && grew(a?.fumbles?.recovered, b.fumbles?.recovered)],
    ['safety', defender && grew(a?.safeties, b.safeties)],
    ['block', defender && grew(a?.blockedKicks, b.blockedKicks)],
    ['sack', defender && grew(a?.defense?.sacks, b.defense?.sacks)],
  ]);
}
