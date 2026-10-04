import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnSummary } from '../espn/types';
import { normalizeSummary } from '../stats/normalize';
import type { FollowedEntry } from '../storage/types';
import { PRESETS } from './presets';
import { scoreDefense, scoreEntry, scorePlayer, tierIndex } from './score';

const game = normalizeSummary(summaryJson as unknown as EspnSummary);
const ppr = PRESETS.ppr;
const total = (id: string, v = ppr) => scorePlayer(game.players[id]!, v).total;

describe('scorePlayer on PIT at CLE', () => {
  it('scores a QB with a 2-point conversion', () => expect(total('8439')).toBeCloseTo(21.96));
  it('scores a QB with a lost fumble and no recovery points for his own fumble', () => expect(total('3122840')).toBeCloseTo(12.92));
  it('scores a RB in all three presets', () => {
    expect(total('4569987', PRESETS.ppr)).toBeCloseTo(15.6);
    expect(total('4569987', PRESETS.half)).toBeCloseTo(14.1);
    expect(total('4569987', PRESETS.standard)).toBeCloseTo(12.6);
  });
  it('scores a TE touchdown', () => expect(total('4430802')).toBeCloseTo(11.7));
  it('scores kickers by distance, with misses', () => {
    expect(total('17372')).toBeCloseTo(3); // 31 yd (3) + miss (-1) + XP (1)
    expect(total('4258620')).toBeCloseTo(12); // 44 (4) + 56 (5) + 3 XP
  });
  it('scores IDP players', () => {
    expect(total('4361652')).toBeCloseTo(11.5);
    expect(total('3045282')).toBeCloseTo(12);
  });
  it('lists each scoring category in the breakdown', () => {
    expect(scorePlayer(game.players['8439']!, ppr).breakdown).toEqual([
      { label: 'Passing yards', points: 11.96 },
      { label: 'Passing TDs', points: 12 },
      { label: 'Interceptions thrown', points: -4 },
      { label: '2-point conversions', points: 2 },
    ]);
  });
  it('scores unparsed field goals at the 0-39 value', () => {
    const k = { twoPointConversions: 0, safeties: 0, kicking: { fgMade: 2, fgAttempts: 2, longest: 50, xpMade: 0, xpAttempts: 0, madeDistances: [50] } };
    const r = scorePlayer(k, ppr);
    expect(r.total).toBeCloseTo(8);
    expect(r.breakdown).toContainEqual({ label: 'Field goals, distance unknown', points: 3 });
  });
});

describe('scorePlayer edge cases', () => {
  const dline = { totalTackles: 1, soloTackles: 1, sacks: 0, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 };
  const fumbles = { fumbles: 0, lost: 0, recovered: 1 };
  const recoveries = (r: { breakdown: { label: string }[] }) => r.breakdown.filter((l) => l.label === 'Fumble recoveries');
  it('gives no fumble recovery points to offensive players with a defense line', () => {
    const qb = { twoPointConversions: 0, safeties: 0, passing: { completions: 0, attempts: 0, yards: 0, touchdowns: 0, interceptions: 0 }, defense: dline, fumbles };
    expect(recoveries(scorePlayer(qb, ppr))).toEqual([]);
  });
  it('still scores fumble recoveries for pure defenders', () => {
    const d = { twoPointConversions: 0, safeties: 0, defense: dline, fumbles };
    expect(recoveries(scorePlayer(d, ppr))).toEqual([{ label: 'Fumble recoveries', points: 2 }]);
  });
  it('scores fumble recoveries for a defender with no defense line but an interception line', () => {
    const d = { twoPointConversions: 0, safeties: 0, interceptions: { interceptions: 1, touchdowns: 0 }, fumbles };
    expect(recoveries(scorePlayer(d, ppr))).toEqual([{ label: 'Fumble recoveries', points: 2 }]);
  });
  it('scores at most fgMade parsed distances', () => {
    const k = { twoPointConversions: 0, safeties: 0, kicking: { fgMade: 1, fgAttempts: 1, longest: 50, xpMade: 0, xpAttempts: 0, madeDistances: [31, 50] } };
    expect(scorePlayer(k, ppr).total).toBeCloseTo(3);
  });
});

describe('scoreEntry results', () => {
  it('returns a fresh empty result each time', () => {
    const e: FollowedEntry = { kind: 'player', espnId: '1', name: 'x', teamId: '23', teamAbbr: 'PIT', position: 'RB', profileId: 'p' };
    expect(scoreEntry(e, undefined, ppr).breakdown).not.toBe(scoreEntry(e, undefined, ppr).breakdown);
  });
});

describe('scoreDefense', () => {
  it('scores both team defenses', () => {
    expect(scoreDefense(game.defenses['23']!, ppr).total).toBeCloseTo(6);
    expect(scoreDefense(game.defenses['5']!, ppr).total).toBeCloseTo(9);
  });
  it('maps points allowed to tiers at every boundary', () => {
    const cases: [number, number][] = [[0, 0], [1, 1], [6, 1], [7, 2], [13, 2], [14, 3], [20, 3], [21, 4], [27, 4], [28, 5], [34, 5], [35, 6], [52, 6]];
    for (const [pa, tier] of cases) expect(tierIndex(pa)).toBe(tier);
  });
});

describe('scoreEntry', () => {
  const base: FollowedEntry = { kind: 'player', espnId: '4569987', name: 'Jaylen Warren', teamId: '23', teamAbbr: 'PIT', position: 'RB', profileId: 'p1' };
  it('scores a player entry', () => expect(scoreEntry(base, game, ppr).total).toBeCloseTo(15.6));
  it('scores a defense entry by team id', () => {
    expect(scoreEntry({ ...base, kind: 'defense', espnId: '999', teamId: '23', position: 'D/ST' }, game, ppr).total).toBeCloseTo(6);
  });
  it('returns zero without game stats or without a box score line', () => {
    expect(scoreEntry(base, undefined, ppr)).toEqual({ total: 0, breakdown: [] });
    expect(scoreEntry({ ...base, espnId: '1' }, game, ppr)).toEqual({ total: 0, breakdown: [] });
  });
});
