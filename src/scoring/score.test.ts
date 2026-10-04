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
  it('scores explicit ESPN defense ranges at provider boundaries', () => {
    const values = {
      ...ppr,
      pointsAllowedBands: [
        { min: 0, max: 0, points: 10 }, { min: 1, max: 6, points: 4 }, { min: 7, max: 13, points: 1 },
        { min: 14, max: 17, points: 0 }, { min: 18, max: 21, points: -1 }, { min: 22, max: 27, points: -3 },
        { min: 28, max: 34, points: -5 }, { min: 35, max: 45, points: -6 }, { min: 46, max: null, points: -7 },
      ],
    };
    const base = { sacks: 0, interceptions: 0, fumbleRecoveries: 0, touchdowns: 0, safeties: 0, pointsAllowed: 0 };
    for (const [pointsAllowed, expected] of [[17, 0], [18, -1], [20, -1], [21, -1], [22, -3], [27, -3], [28, -5], [34, -5], [35, -6], [45, -6], [46, -7]] as const) {
      expect(scoreDefense({ ...base, pointsAllowed }, values).total).toBe(expected);
    }
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

describe('new scoring rules and on/off switches', () => {
  const base = { twoPointConversions: 0, safeties: 0 };
  const rules = (over: Partial<typeof ppr>) => ({ ...ppr, ...over });

  it('scores touchdown length and game yardage bonuses, cumulatively for 50+ yard touchdowns', () => {
    const wr = { ...base, receiving: { receptions: 0, targets: 0, yards: 210, touchdowns: 2 }, tdYards: { pass: [], rush: [], rec: [55, 12] } };
    const v = rules({ recTd40: 1, recTd50: 2, rec100: 3, rec200: 4 });
    const r = scorePlayer(wr, v);
    expect(r.breakdown).toContainEqual({ label: '40+ yard receiving TDs', points: 1 });
    expect(r.breakdown).toContainEqual({ label: '50+ yard receiving TDs', points: 2 });
    expect(r.breakdown).toContainEqual({ label: '200+ yard receiving game', points: 4 });
    expect(r.breakdown.some((l) => l.label === '100-199 yard receiving game')).toBe(false);
  });

  it('scores 50-59 and 60+ yard kicks and misses by their own weights', () => {
    const k = { ...base, kicking: { fgMade: 2, fgAttempts: 3, longest: 61, xpMade: 0, xpAttempts: 0, madeDistances: [55, 61], missedDistances: [44] } };
    const v = rules({ fg50to59: 5, fg60plus: 6, fgMissed: -1, fgMissed40to49: -2 });
    expect(scorePlayer(k, v).total).toBeCloseTo(5 + 6 - 1 - 2);
  });

  it('scores yards allowed bands from the opponent total', () => {
    const d = { sacks: 0, interceptions: 0, fumbleRecoveries: 0, touchdowns: 0, safeties: 0, pointsAllowed: 99, yardsAllowed: 372 };
    const v = rules({ yardsAllowed350: -1, pointsAllowed: [0, 0, 0, 0, 0, 0, 0] });
    expect(scoreDefense(d, v).total).toBe(-1);
    expect(scoreDefense({ ...d, yardsAllowed: undefined }, v).total).toBe(0);
  });

  it('scores nothing for a rule switched off and restores it when switched back on', () => {
    const qb = { ...base, passing: { completions: 10, attempts: 20, yards: 100, touchdowns: 2, interceptions: 0 } };
    expect(scorePlayer(qb, rules({ off: ['passTd'] })).total).toBeCloseTo(4);
    expect(scorePlayer(qb, rules({ off: [] })).total).toBeCloseTo(12);
  });

  it('keeps an off rule out of the preset objects it was copied from', () => {
    const copy = { ...PRESETS.ppr, off: ['passTd' as const] };
    expect(PRESETS.ppr.off).toBeUndefined();
    expect(scorePlayer({ ...base, passing: { completions: 0, attempts: 0, yards: 0, touchdowns: 1, interceptions: 0 } }, copy).total).toBe(0);
  });
});
