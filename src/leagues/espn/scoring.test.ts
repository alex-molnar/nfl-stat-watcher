import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeEspnLeague } from './scoring';
import { parseEspnLeagueSettings } from './parse';
import type { EspnLeagueSettings } from '../types';

const league = (items: EspnLeagueSettings['scoringItems']): EspnLeagueSettings => ({
  leagueId: '12345',
  season: '2026',
  name: 'Test league',
  scoringItems: items,
  lineupSlotCounts: { '0': 1 },
  rawSettings: { scoringSettings: { scoringItems: items }, rosterSettings: { lineupSlotCounts: { '0': 1 } } },
  transport: 'public-api',
});

const item = (statId: number, points: number, pointsOverrides: Record<string, number> | null = null) => ({
  statId, points, pointsOverrides, pointsOverridesByPosition: null, isActive: true, isDisabled: false,
  scoringPeriodId: null, statOffset: null, statPeriodId: null, pointsByDistance: null,
});

describe('normalizeEspnLeague', () => {
  it('starts absent settings at zero and maps verified direct weights', () => {
    const draft = normalizeEspnLeague(league([item(4, 6), item(20, -2), item(53, 0.5)]));
    expect(draft.values.passTd).toBe(6);
    expect(draft.values.interception).toBe(-2);
    expect(draft.values.reception).toBe(0.5);
    expect(draft.values.rushYards).toBe(0);
    expect(draft.values.recYards).toBe(0);
    expect(draft.values.pointsAllowed).toEqual(Array(7).fill(0));
  });

  it('preserves explicit zero position overrides and imports D/ST ranges', () => {
    const draft = normalizeEspnLeague(league([
      item(4, 6),
      item(188, 10, { '16': 10 }), item(189, 4, { '16': 4 }), item(190, 1, { '16': 1 }),
      item(191, 0, { '16': 0 }), item(192, -1, { '16': -1 }), item(193, -3, { '16': -3 }),
      item(194, -5, { '16': -5 }), item(195, -6, { '16': -6 }), item(196, -7, { '16': -7 }),
    ]));
    expect(draft.values.pointsAllowedBands).toEqual([
      { min: 0, max: 0, points: 10 }, { min: 1, max: 6, points: 4 }, { min: 7, max: 13, points: 1 },
      { min: 14, max: 17, points: 0 }, { min: 18, max: 21, points: -1 }, { min: 22, max: 27, points: -3 },
      { min: 28, max: 34, points: -5 }, { min: 35, max: 45, points: -6 }, { min: 46, max: null, points: -7 },
    ]);
  });

  it('maps the captured ESPN stat ID family for points-allowed ranges', () => {
    const fixture = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json', 'utf8')) as unknown;
    const imported = normalizeEspnLeague(parseEspnLeagueSettings(fixture));
    expect(imported.values.pointsAllowedBands).toEqual([
      { min: 0, max: 0, points: 10 }, { min: 1, max: 6, points: 7 }, { min: 7, max: 13, points: 4 },
      { min: 14, max: 17, points: 1 }, { min: 18, max: 21, points: 0 }, { min: 22, max: 27, points: 0 },
      { min: 28, max: 34, points: -1 }, { min: 35, max: 45, points: -4 }, { min: 46, max: null, points: -5 },
    ]);
    expect(imported.source.issues.some(({ providerKeys }) => providerKeys.includes('statId:89'))).toBe(false);
  });

  it('flags overlapping ESPN stat ID families instead of guessing a band weight', () => {
    const draft = normalizeEspnLeague(league([item(89, 5), item(188, 5)]));
    expect(draft.values.pointsAllowedBands?.[0]?.points).toBe(0);
    expect(draft.source.issues.filter(({ providerKeys }) => providerKeys.includes('statId:89') || providerKeys.includes('statId:188'))).toHaveLength(2);
  });

  it('warns and omits a mapped weight when ESPN adds an unsupported modifier', () => {
    const offset = { ...item(4, 6), statOffset: 2 };
    const distance = { ...item(77, 4), pointsByDistance: { '50': 8 } };
    const madeByDistance = { ...item(198, 5), pointsByDistance: { '60': 8 } };
    const draft = normalizeEspnLeague(league([offset, distance, madeByDistance]));
    expect(draft.values.passTd).toBe(0);
    expect(draft.values.fg40to49).toBe(0);
    expect(draft.values.fg50to59).toBe(0);
    expect(draft.source.issues.filter(({ providerKeys }) => ['statId:4', 'statId:77', 'statId:198'].some((key) => providerKeys.includes(key)))).toHaveLength(3);
  });

  it('warns when total and category 2-point awards may stack', () => {
    const conversions = normalizeEspnLeague(league([item(19, 2), item(26, 2), item(44, 2), item(62, 2)]));
    expect(conversions.values.twoPoint).toBe(0);
    expect(conversions.source.issues.some(({ message }) => message.includes('both total and category-specific'))).toBe(true);
  });

  it('keeps aggregate and distance-specific missed kicks as separate rules that stack in scoring', () => {
    const draft = normalizeEspnLeague(league([item(85, -1), item(82, -2), item(79, -3), item(200, -4), item(203, -5)]));
    expect(draft.values).toMatchObject({ fgMissed: -1, fgMissed0to39: -2, fgMissed40to49: -3, fgMissed50to59: -4, fgMissed60plus: -5 });
    expect(draft.source.issues.some(({ message }) => message.includes('stack'))).toBe(false);
  });

  it('does not apply one distance-specific missed-kick rule to every distance', () => {
    const draft = normalizeEspnLeague(league([item(82, -1)]));
    expect(draft.values.fgMissed).toBe(0);
    expect(draft.values.fgMissed0to39).toBe(-1);
    expect(draft.values.fgMissed40to49).toBe(0);
  });

  it('omits position-specific values that one local coefficient cannot express', () => {
    const draft = normalizeEspnLeague(league([item(4, 6, { '0': 4, '1': 4 })]));
    expect(draft.values.passTd).toBe(0);
    expect(draft.source.issues.some((issue) => issue.providerKeys.includes('statId:4'))).toBe(true);
  });

  it('warns about unknown, unrepresentable and not-live stats', () => {
    const draft = normalizeEspnLeague(league([item(106, 2), item(999, 1), item(120, 1)]));
    expect(draft.source.issues.some(({ code }) => code === 'unknown-rule')).toBe(true);
    expect(draft.source.issues.some(({ code }) => code === 'unrepresentable-rule')).toBe(true);
    expect(draft.source.issues.some(({ code, message }) => code === 'stat-limitation' && message.includes('Forced fumble'))).toBe(true);
  });

  it('turns "every N yards" awards into a per-yard weight', () => {
    const draft = normalizeEspnLeague(league([item(8, 1), item(30, 1), item(48, 1)]));
    expect(draft.values.passYards).toBeCloseTo(0.04);
    expect(draft.values.rushYards).toBeCloseTo(0.04);
    expect(draft.values.recYards).toBeCloseTo(0.1);
  });

  it('adds awards from several ESPN stats that score the same thing, as ESPN does', () => {
    const draft = normalizeEspnLeague(league([item(3, 0.05), item(8, 1), item(109, 1), item(108, 1)]));
    expect(draft.values.passYards).toBeCloseTo(0.09);
    expect(draft.values.soloTackle).toBe(2);
    expect(draft.values.assistedTackle).toBe(1);
  });

  it('keeps 50-59 and 60+ yard field goals apart and spreads the 50+ and total rules over them', () => {
    expect(normalizeEspnLeague(league([item(198, 5), item(201, 6)])).values).toMatchObject({ fg50to59: 5, fg60plus: 6 });
    expect(normalizeEspnLeague(league([item(74, 5)])).values).toMatchObject({ fg50to59: 5, fg60plus: 5 });
    expect(normalizeEspnLeague(league([item(83, 3), item(80, 1)])).values).toMatchObject({ fg0to39: 4, fg40to49: 3, fg50to59: 3, fg60plus: 3 });
  });

  it('reads D/ST-only awards from the D/ST override and collapses touchdown types that agree', () => {
    const draft = normalizeEspnLeague(league([
      item(95, 0, { '16': 2 }), item(97, 0, { '16': 2 }), item(128, 0, { '16': 5 }), item(209, 1, { '16': 1 }),
      item(93, 6, { '16': 6 }), item(101, 6, { '16': 6 }), item(102, 6, { '16': 6 }), item(103, 6, { '16': 6 }), item(104, 6, { '16': 6 }),
    ]));
    expect(draft.values).toMatchObject({ dstInterception: 2, idpInterception: 0, dstBlockedKick: 2, yardsAllowed0: 5, onePointSafety: 1, dstTd: 6, returnTd: 6 });
    expect(draft.source.issues.some(({ message }) => message.includes('different awards'))).toBe(false);
  });

  it('warns and keeps the highest value when touchdown types are scored differently', () => {
    const draft = normalizeEspnLeague(league([item(101, 6, { '16': 6 }), item(103, 3, { '16': 3 })]));
    expect(draft.values.dstTd).toBe(6);
    expect(draft.source.issues.some(({ message }) => message.includes('different awards'))).toBe(true);
  });

  it('switches off every rule the league does not score and keeps the rest on', () => {
    const draft = normalizeEspnLeague(league([item(4, 4), item(15, 1)]));
    expect(draft.values.off).not.toContain('passTd');
    expect(draft.values.off).not.toContain('passTd40');
    expect(draft.values.off).toContain('passTd50');
    expect(draft.source.baselineValues.off).toEqual(draft.values.off);
  });

  it('imports the captured league with its real passing, field goal and defense rules', () => {
    const fixture = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json', 'utf8')) as unknown;
    const { values, source } = normalizeEspnLeague(parseEspnLeagueSettings(fixture));
    expect(values).toMatchObject({
      passYards: 0.04, passTd: 4, rushYards: 0.1, recYards: 0.1, reception: 0.5,
      fg0to39: 3, fg40to49: 4, fg50to59: 5, fg60plus: 6, fgMissed: -1, xpMade: 1,
      dstInterception: 2, dstSack: 1, dstSafety: 2, dstFumbleRecovery: 2, dstBlockedKick: 2, dstTd: 6, twoPointReturn: 2, onePointSafety: 1,
      yardsAllowed0: 5, yardsAllowed100: 3, yardsAllowed200: 2, yardsAllowed350: -1, yardsAllowed400: -3, yardsAllowed450: -5, yardsAllowed500: -6, yardsAllowed550: -7,
    });
    const flagged = source.issues.flatMap(({ providerKeys }) => providerKeys);
    for (const id of [8, 209, 206, 95, 96, 98, 99, 93, 101, 102, 103, 104, 128, 129, 130, 132, 133, 85, 82]) expect(flagged).not.toContain(`statId:${id}`);
    expect(source.issues.filter(({ code }) => code !== 'stat-limitation')).toEqual([]);
  });
});
