import { isOffense } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameStats } from './types';

/** How loudly a play is celebrated: the whole card, or a ring and tag on the corner. Plays in neither tier get nothing. */
export type PlayTier = 'big' | 'small';

/** Whether the play helps or hurts the card's player or defense; bad plays get their own colour. */
export type PlayTone = 'good' | 'bad';

export interface PlayEvent {
  kind: 'td' | 'fg' | 'int' | 'fumble' | 'safety' | 'xp' | 'twopoint' | 'block' | 'sack' | 'pass' | 'run' | 'catch'
    | 'intthrown' | 'fumblelost' | 'missfg' | 'tdallowed' | 'sacked' | 'missxp' | 'fgallowed';
  label: string;
  tier: PlayTier;
  tone: PlayTone;
}

/** Plays at or beyond these gains (in yards, on a single play) get the small celebration. */
export const LONG_PASS = 20;
export const LONG_RUN = 10;
export const LONG_CATCH = 10;

/**
 * The one place that decides which tier a play is in. To move a play, change it here. Order inside a tier is
 * the priority when several happen in the same refresh.
 */
const TIERS: Record<PlayEvent['kind'], { tier: PlayTier; tone: PlayTone; label: string }> = {
  td: { tier: 'big', tone: 'good', label: 'Touchdown' },
  fg: { tier: 'big', tone: 'good', label: 'Field goal' },
  int: { tier: 'big', tone: 'good', label: 'Interception' },
  fumble: { tier: 'big', tone: 'good', label: 'Fumble recovery' },
  safety: { tier: 'big', tone: 'good', label: 'Safety' },
  block: { tier: 'small', tone: 'good', label: 'Blocked kick' },
  sack: { tier: 'small', tone: 'good', label: 'Sack' },
  xp: { tier: 'small', tone: 'good', label: 'Extra point' },
  twopoint: { tier: 'small', tone: 'good', label: '2-point conversion' },
  pass: { tier: 'small', tone: 'good', label: 'Long pass' },
  run: { tier: 'small', tone: 'good', label: 'Long run' },
  catch: { tier: 'small', tone: 'good', label: 'Long catch' },
  // Bad plays, in the same two tiers.
  intthrown: { tier: 'big', tone: 'bad', label: 'Interception thrown' },
  fumblelost: { tier: 'big', tone: 'bad', label: 'Fumble lost' },
  missfg: { tier: 'big', tone: 'bad', label: 'Missed field goal' },
  tdallowed: { tier: 'big', tone: 'bad', label: 'Touchdown allowed' },
  sacked: { tier: 'small', tone: 'bad', label: 'Sacked' },
  missxp: { tier: 'small', tone: 'bad', label: 'Missed extra point' },
  fgallowed: { tier: 'small', tone: 'bad', label: 'Field goal allowed' },
};

const grew = (before: number | undefined, after: number | undefined) => (after ?? 0) > (before ?? 0);
const change = (before: number | undefined, after: number | undefined) => (after ?? 0) - (before ?? 0);

const make = (kind: PlayEvent['kind'], label?: string): PlayEvent => ({ kind, label: label ?? TIERS[kind].label, tier: TIERS[kind].tier, tone: TIERS[kind].tone });

/**
 * The biggest celebrated play a card's player or defense just made or suffered, by comparing two refreshes of the
 * same game. Good, big: touchdowns, made field goals, interceptions, fumble recoveries, safeties. Good, small: extra
 * points, 2-point conversions, sacks, blocked kicks, and single plays of 20+ passing yards or 10+ rushing or
 * receiving yards. Bad, big: an interception thrown, a fumble lost, a missed field goal, a touchdown allowed. Bad,
 * small: being sacked, a missed extra point, a field goal allowed. Everything else (shorter gains, tackles) is null. A long gain counts only when exactly one carry, catch or
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
    // Points allowed is the opponent's score, so a jump of a touchdown or more, or exactly a field goal, is a score against.
    const against = change(a?.pointsAllowed, b.pointsAllowed);
    add(against >= 6, 'tdallowed');
    add(against === 3, 'fgallowed');
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
    // Bad plays for an offensive player.
    const misses = (k: GameStats['players'][string]['kicking'], kind: 'fg' | 'xp') => (k ? (kind === 'fg' ? k.fgAttempts - k.fgMade : k.xpAttempts - k.xpMade) : 0);
    add(!defender && grew(a?.passing?.interceptions, b.passing?.interceptions), 'intthrown');
    add(!defender && grew(a?.fumbles?.lost, b.fumbles?.lost), 'fumblelost');
    add(grew(misses(a?.kicking, 'fg'), misses(b.kicking, 'fg')), 'missfg');
    add(grew(a?.passing?.sacked, b.passing?.sacked), 'sacked');
    add(grew(misses(a?.kicking, 'xp'), misses(b.kicking, 'xp')), 'missxp');
  }
  // Big plays outrank small ones; within a tier the order above is the priority, good plays before bad ones.
  return found.find((event) => event.tier === 'big') ?? found[0] ?? null;
}
