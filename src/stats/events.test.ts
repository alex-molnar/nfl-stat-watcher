import { describe, expect, it } from 'vitest';
import type { FollowedEntry } from '../storage/types';
import { scoringEvent } from './events';
import type { DefenseStats, GameStats, PlayerStats } from './types';

const player = (over: Partial<FollowedEntry>): FollowedEntry => ({ kind: 'player', espnId: '1', name: 'X', teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1', ...over });
const dst: FollowedEntry = { kind: 'defense', espnId: '7', name: 'DEN', teamId: '7', teamAbbr: 'DEN', position: 'D/ST', profileId: 'p1' };
const stats = (p?: Partial<PlayerStats>, d?: Partial<DefenseStats>): GameStats => ({
  players: { '1': { twoPointConversions: 0, safeties: 0, ...p } },
  defenses: { '7': { sacks: 0, interceptions: 0, fumbleRecoveries: 0, touchdowns: 0, safeties: 0, pointsAllowed: 0, ...d } },
  situation: null,
});

describe('scoringEvent', () => {
  it('flags a touchdown of any kind for a player', () => {
    expect(scoringEvent(player({}), stats({ receiving: { receptions: 1, targets: 1, yards: 9, touchdowns: 0 } }), stats({ receiving: { receptions: 2, targets: 2, yards: 20, touchdowns: 1 } }))?.kind).toBe('td');
    expect(scoringEvent(player({ position: 'QB' }), stats({ passing: { completions: 1, attempts: 1, yards: 5, touchdowns: 0, interceptions: 0 } }), stats({ passing: { completions: 2, attempts: 2, yards: 40, touchdowns: 1, interceptions: 0 } }))?.kind).toBe('td');
    expect(scoringEvent(player({ position: 'RB' }), stats(), stats({ returns: { touchdowns: 1 } }))?.kind).toBe('td');
  });

  it('flags a made field goal, but not a miss', () => {
    const k = (made: number, attempts: number) => stats({ kicking: { fgMade: made, fgAttempts: attempts, longest: 40, xpMade: 0, xpAttempts: 0, madeDistances: [] } });
    expect(scoringEvent(player({ position: 'K' }), k(1, 1), k(2, 2))?.label).toBe('Field goal');
    expect(scoringEvent(player({ position: 'K' }), k(1, 1), k(1, 2))).toBeNull();
  });

  it('flags defensive plays for a defense and for IDP players, biggest first', () => {
    expect(scoringEvent(dst, stats(), stats({}, { sacks: 1 }))?.kind).toBe('sack');
    expect(scoringEvent(dst, stats(), stats({}, { sacks: 1, interceptions: 1 }))?.kind).toBe('int');
    expect(scoringEvent(dst, stats({}, { sacks: 1 }), stats({}, { sacks: 1, touchdowns: 1, interceptions: 1 }))?.kind).toBe('td');
    expect(scoringEvent(dst, stats(), stats({}, { safeties: 1 }))?.label).toBe('Safety');
    const lb = player({ position: 'LB' });
    const d = (sacks: number) => stats({ defense: { totalTackles: 1, soloTackles: 1, sacks, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 } });
    expect(scoringEvent(lb, d(0), d(1))?.label).toBe('Sack');
    expect(scoringEvent(lb, stats({ interceptions: { interceptions: 0, touchdowns: 0 } }), stats({ interceptions: { interceptions: 1, touchdowns: 0 } }))?.label).toBe('Interception');
  });

  it('ignores ordinary stat growth and anything that did not increase', () => {
    expect(scoringEvent(player({}), stats({ receiving: { receptions: 1, targets: 1, yards: 9, touchdowns: 0 } }), stats({ receiving: { receptions: 2, targets: 2, yards: 20, touchdowns: 0 } }))).toBeNull();
    expect(scoringEvent(dst, stats({}, { sacks: 2 }), stats({}, { sacks: 2 }))).toBeNull();
  });

  it('does not credit an offensive player with a sack-like stat', () => {
    const d = (sacks: number) => stats({ defense: { totalTackles: 0, soloTackles: 0, sacks, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 } });
    expect(scoringEvent(player({ position: 'QB' }), d(0), d(1))).toBeNull();
  });
});
