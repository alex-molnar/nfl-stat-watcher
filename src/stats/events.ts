import { isOffense } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameStats } from './types';

/** How loudly a play is celebrated: the whole card, or a ring and tag on the corner. Plays in neither tier get nothing. */
export type PlayTier = 'big' | 'small';

export interface PlayEvent {
  kind: 'td' | 'fg' | 'int' | 'fumble' | 'safety' | 'xp' | 'twopoint' | 'block' | 'sack' | 'pass' | 'run' | 'catch';
  label: string;
  tier: PlayTier;
}

/** Plays at or beyond these gains (in yards, on a single play) get the small celebration. */
export const LONG_PASS = 20;
export const LONG_RUN = 10;
export const LONG_CATCH = 10;

/**
 * The one place that decides which tier a play is in. To move a play, change it here. Order inside a tier is
 * the priority when several happen in the same refresh.
 */
const TIERS: Record<PlayEvent['kind'], { tier: PlayTier; label: string }> = {
  td: { tier: 'big', label: 'Touchdown' },
  fg: { tier: 'big', label: 'Field goal' },
  int: { tier: 'big', label: 'Interception' },
  fumble: { tier: 'big', label: 'Fumble recovery' },
  safety: { tier: 'big', label: 'Safety' },
  block: { tier: 'small', label: 'Blocked kick' },
  sack: { tier: 'small', label: 'Sack' },
  xp: { tier: 'small', label: 'Extra point' },
  twopoint: { tier: 'small', label: '2-point conversion' },
  pass: { tier: 'small', label: 'Long pass' },
  run: { tier: 'small', label: 'Long run' },
  catch: { tier: 'small', label: 'Long catch' },
};

const grew = (before: number | undefined, after: number | undefined) => (after ?? 0) > (before ?? 0);
const change = (before: number | undefined, after: number | undefined) => (after ?? 0) - (before ?? 0);

const make = (kind: PlayEvent['kind'], label?: string): PlayEvent => ({ kind, label: label ?? TIERS[kind].label, tier: TIERS[kind].tier });

/**
 * The biggest celebrated play a card's player or defense just made, by comparing two refreshes of the same game.
 * Big: touchdowns, made field goals, interceptions, fumble recoveries, safeties. Small: extra points, 2-point
 * conversions, sacks, blocked kicks, and single plays of 20+ passing yards or 10+ rushing or receiving yards.
 * Everything else (shorter gains, tackles) is null. A long gain counts only when exactly one carry, catch or
 * completion arrived, so a refresh that bundled several plays never reports an average as one big play.
 */
export function scoringEvent(entry: FollowedEntry, before: GameStats, after: GameStats): PlayEvent | null {
  const found: PlayEvent[] = [];
  const add = (happened: boolean, kind: PlayEvent['kind'], label?: string) => { if (happened) found.push(make(kind, label)); };

  if (entry.kind === 'defense') {
    const a = before.defenses[entry.teamId];
    const b = after.defenses[entry.teamId];
    if (!b) return null;
    add(grew(a?.touchdowns, b.touchdowns), 'td');
    add(grew(a?.interceptions, b.interceptions), 'int');
    add(grew(a?.fumbleRecoveries, b.fumbleRecoveries), 'fumble');
    add(grew(a?.safeties, b.safeties), 'safety');
    add(grew(a?.blockedKicks, b.blockedKicks), 'block');
    add(grew(a?.sacks, b.sacks), 'sack');
  } else {
    const a = before.players[entry.espnId];
    const b = after.players[entry.espnId];
    if (!b) return null;
    const defender = !isOffense(entry.position);
    add(grew(a?.passing?.touchdowns, b.passing?.touchdowns) || grew(a?.rushing?.touchdowns, b.rushing?.touchdowns)
      || grew(a?.receiving?.touchdowns, b.receiving?.touchdowns) || grew(a?.returns?.touchdowns, b.returns?.touchdowns)
      || grew(a?.defense?.touchdowns, b.defense?.touchdowns) || grew(a?.interceptions?.touchdowns, b.interceptions?.touchdowns), 'td');
    add(grew(a?.kicking?.fgMade, b.kicking?.fgMade), 'fg');
    add(defender && grew(a?.interceptions?.interceptions, b.interceptions?.interceptions), 'int');
    add(defender && grew(a?.fumbles?.recovered, b.fumbles?.recovered), 'fumble');
    add(defender && grew(a?.safeties, b.safeties), 'safety');
    add(defender && grew(a?.blockedKicks, b.blockedKicks), 'block');
    add(defender && grew(a?.defense?.sacks, b.defense?.sacks), 'sack');
    add(grew(a?.kicking?.xpMade, b.kicking?.xpMade), 'xp');
    add(!defender && grew(a?.twoPointConversions, b.twoPointConversions), 'twopoint');
    const pass = change(a?.passing?.yards, b.passing?.yards);
    const run = change(a?.rushing?.yards, b.rushing?.yards);
    const catchYards = change(a?.receiving?.yards, b.receiving?.yards);
    add(change(a?.passing?.completions, b.passing?.completions) === 1 && pass >= LONG_PASS, 'pass', `${pass}-yard pass`);
    add(change(a?.rushing?.attempts, b.rushing?.attempts) === 1 && run >= LONG_RUN, 'run', `${run}-yard run`);
    add(change(a?.receiving?.receptions, b.receiving?.receptions) === 1 && catchYards >= LONG_CATCH, 'catch', `${catchYards}-yard catch`);
  }
  // Big plays outrank small ones; within a tier the order above is the priority.
  return found.find((event) => event.tier === 'big') ?? found[0] ?? null;
}
