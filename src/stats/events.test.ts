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

  it('flags a made field goal as good and a miss as bad', () => {
    const k = (made: number, attempts: number) => stats({ kicking: { fgMade: made, fgAttempts: attempts, longest: 40, xpMade: 0, xpAttempts: 0, madeDistances: [] } });
    expect(scoringEvent(player({ position: 'K' }), k(1, 1), k(2, 2))).toMatchObject({ label: 'Field goal', tone: 'good' });
    expect(scoringEvent(player({ position: 'K' }), k(1, 1), k(1, 2))).toMatchObject({ label: 'Missed field goal', tone: 'bad', tier: 'big' });
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
    expect(scoringEvent(player({}), stats({ receiving: { receptions: 1, targets: 1, yards: 9, touchdowns: 0 } }), stats({ receiving: { receptions: 2, targets: 2, yards: 18, touchdowns: 0 } }))).toBeNull();
    expect(scoringEvent(dst, stats({}, { sacks: 2 }), stats({}, { sacks: 2 }))).toBeNull();
  });

  it('does not credit an offensive player with a sack-like stat', () => {
    const d = (sacks: number) => stats({ defense: { totalTackles: 0, soloTackles: 0, sacks, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 } });
    expect(scoringEvent(player({ position: 'QB' }), d(0), d(1))).toBeNull();
  });

  describe('tiers', () => {
    const rec = (receptions: number, yards: number) => stats({ receiving: { receptions, targets: receptions, yards, touchdowns: 0 } });
    const rush = (attempts: number, yards: number) => stats({ rushing: { attempts, yards, touchdowns: 0 } });
    const pass = (completions: number, yards: number) => stats({ passing: { completions, attempts: completions, yards, touchdowns: 0, interceptions: 0 } });
    const kick = (xp: number) => stats({ kicking: { fgMade: 0, fgAttempts: 0, longest: 0, xpMade: xp, xpAttempts: xp, madeDistances: [] } });

    it('puts touchdowns, field goals, interceptions, fumble recoveries and safeties in the big tier', () => {
      expect(scoringEvent(dst, stats(), stats({}, { interceptions: 1 }))).toMatchObject({ kind: 'int', tier: 'big' });
      expect(scoringEvent(dst, stats(), stats({}, { fumbleRecoveries: 1 }))).toMatchObject({ tier: 'big' });
      expect(scoringEvent(dst, stats(), stats({}, { safeties: 1 }))).toMatchObject({ tier: 'big' });
      expect(scoringEvent(player({}), rec(0, 0), stats({ receiving: { receptions: 1, targets: 1, yards: 30, touchdowns: 1 } }))).toMatchObject({ kind: 'td', tier: 'big' });
    });

    it('puts extra points, sacks, blocked kicks and long gains in the small tier', () => {
      expect(scoringEvent(player({ position: 'K' }), kick(0), kick(1))).toMatchObject({ kind: 'xp', tier: 'small', label: 'Extra point' });
      expect(scoringEvent(dst, stats(), stats({}, { sacks: 1 }))).toMatchObject({ kind: 'sack', tier: 'small' });
      expect(scoringEvent(dst, stats(), stats({}, { blockedKicks: 1 }))).toMatchObject({ kind: 'block', tier: 'small' });
      expect(scoringEvent(player({ position: 'WR' }), rec(2, 20), rec(3, 30))).toMatchObject({ kind: 'catch', tier: 'small', label: '10-yard catch' });
      expect(scoringEvent(player({ position: 'RB' }), rush(5, 20), rush(6, 34))).toMatchObject({ kind: 'run', tier: 'small', label: '14-yard run' });
      expect(scoringEvent(player({ position: 'QB' }), pass(5, 50), pass(6, 75))).toMatchObject({ kind: 'pass', tier: 'small', label: '25-yard pass' });
    });

    it('gives nothing for a short gain, a 19-yard pass or a 9-yard carry', () => {
      expect(scoringEvent(player({ position: 'WR' }), rec(2, 20), rec(3, 29))).toBeNull();
      expect(scoringEvent(player({ position: 'RB' }), rush(5, 20), rush(6, 29))).toBeNull();
      expect(scoringEvent(player({ position: 'QB' }), pass(5, 50), pass(6, 69))).toBeNull();
    });

    it('does not read several plays bundled in one refresh as one long gain', () => {
      expect(scoringEvent(player({ position: 'WR' }), rec(2, 20), rec(4, 45))).toBeNull(); // two catches, 25 yards between refreshes
      expect(scoringEvent(player({ position: 'QB' }), pass(5, 50), pass(8, 140))).toBeNull();
    });

    it('lets a big play win over a small one in the same refresh', () => {
      const before = stats({ receiving: { receptions: 1, targets: 1, yards: 10, touchdowns: 0 } });
      const after = stats({ receiving: { receptions: 2, targets: 2, yards: 40, touchdowns: 1 } });
      expect(scoringEvent(player({}), before, after)).toMatchObject({ kind: 'td', tier: 'big' });
      expect(scoringEvent(dst, stats(), stats({}, { sacks: 1, interceptions: 1 }))?.kind).toBe('int');
    });
  });

  describe('bad plays', () => {
    const qbStats = (over: Partial<NonNullable<PlayerStats['passing']>>, fumbles?: PlayerStats['fumbles']) =>
      stats({ passing: { completions: 5, attempts: 8, yards: 50, touchdowns: 0, interceptions: 0, ...over }, ...(fumbles ? { fumbles } : {}) });
    const qb = player({ position: 'QB' });
    const kick = (xpMade: number, xpAttempts: number) => stats({ kicking: { fgMade: 0, fgAttempts: 0, longest: 0, xpMade, xpAttempts, madeDistances: [] } });

    it('puts an interception thrown, a lost fumble, a missed field goal and a touchdown allowed in the big tier, as bad', () => {
      expect(scoringEvent(qb, qbStats({}), qbStats({ interceptions: 1 }))).toMatchObject({ kind: 'intthrown', tier: 'big', tone: 'bad', label: 'Interception thrown' });
      expect(scoringEvent(player({ position: 'RB' }), stats({ fumbles: { fumbles: 1, lost: 0, recovered: 0 } }), stats({ fumbles: { fumbles: 1, lost: 1, recovered: 0 } })))
        .toMatchObject({ kind: 'fumblelost', tier: 'big', tone: 'bad' });
      expect(scoringEvent(dst, stats({}, { pointsAllowed: 10 }), stats({}, { pointsAllowed: 16 }))).toMatchObject({ kind: 'tdallowed', tier: 'big', tone: 'bad' });
    });

    it('puts being sacked, a missed extra point and a field goal allowed in the small tier, as bad', () => {
      expect(scoringEvent(qb, qbStats({ sacked: 1 }), qbStats({ sacked: 2 }))).toMatchObject({ kind: 'sacked', tier: 'small', tone: 'bad' });
      expect(scoringEvent(player({ position: 'K' }), kick(1, 1), kick(1, 2))).toMatchObject({ kind: 'missxp', tier: 'small', tone: 'bad' });
      expect(scoringEvent(dst, stats({}, { pointsAllowed: 10 }), stats({}, { pointsAllowed: 13 }))).toMatchObject({ kind: 'fgallowed', tier: 'small', tone: 'bad' });
    });

    it('ignores a point after a touchdown and a safety, which are neither a touchdown nor a field goal allowed', () => {
      expect(scoringEvent(dst, stats({}, { pointsAllowed: 16 }), stats({}, { pointsAllowed: 17 }))).toBeNull();
      expect(scoringEvent(dst, stats({}, { pointsAllowed: 16 }), stats({}, { pointsAllowed: 18 }))).toBeNull();
    });

    it('does not blame a defender for an offensive stat, and keeps good plays marked good', () => {
      expect(scoringEvent(player({ position: 'LB' }), qbStats({}), qbStats({ interceptions: 1 }))).toBeNull();
      expect(scoringEvent(dst, stats(), stats({}, { sacks: 1 }))).toMatchObject({ tone: 'good' });
    });

    it('shows a big good play ahead of a bad one in the same refresh', () => {
      expect(scoringEvent(qb, qbStats({}), qbStats({ touchdowns: 1, interceptions: 1 }))).toMatchObject({ kind: 'td', tone: 'good' });
    });
  });
});
