import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnSummary } from '../espn/types';
import { normalizeSummary } from '../stats/normalize';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';
import type { GameStats, PlayerStats } from '../stats/types';
import { PRESETS } from '../scoring/presets';
import type { ScoringValues } from '../scoring/types';
import { displayName, isRedZone, resultText, statLine, textOn } from './format';

const stats = normalizeSummary(summaryJson as unknown as EspnSummary);
const entry = (over: Partial<FollowedEntry>): FollowedEntry => ({
  kind: 'player', espnId: '8439', name: 'Aaron Rodgers', teamId: '23', teamAbbr: 'PIT', position: 'QB', profileId: 'p1', ...over,
});
const ppr = PRESETS.ppr;
const line = (e: FollowedEntry, v: ScoringValues = ppr, game: GameStats = stats) => statLine(e, game, v).map((s) => `${s.value} ${s.label}`);
const only = (player: PlayerStats) => ({ ...stats, players: { x: player } });
const x = entry({ espnId: 'x', position: 'WR' });

describe('statLine', () => {
  it('lists what the league scores, leaving out zeros and stats it gives no points', () => {
    expect(line(entry({}))).toEqual(['299 pass yds', '3 pass TD', '2 INT', '1 2PT']); // 0 rush yds and the unscored 5 sacks are left out
    expect(line(entry({ espnId: '4569987', position: 'RB' }))).toEqual(['93 rush yds', '3 catches', '33 rec yds']); // carries score nothing, 0 TD hidden
    expect(line(entry({ espnId: '4430802', position: 'TE' }))).toEqual(['3 catches', '27 rec yds', '1 rec TD']);
    expect(line(entry({ espnId: '17372', position: 'K' }))).toEqual(['1/2 FG', '1/1 XP']);
    expect(line(entry({ espnId: '4361652', position: 'LB' }))).toEqual(['9 tackles', '1 sacks', '1 TFL', '1 QB hits']);
    expect(line(entry({ kind: 'defense', espnId: '23', position: 'D/ST' }))).toEqual(['2 sacks', '1 INT', '1 fum rec', '27 pts allowed']);
  });

  it('follows the league: weights, negative ones, switched-off rules and step rules', () => {
    const tePlayer = entry({ espnId: '4430802', position: 'TE' });
    expect(line(tePlayer, PRESETS.standard)).toEqual(['27 rec yds', '1 rec TD']); // no points per catch
    expect(line(tePlayer, { ...ppr, recTarget: 0.1 })).toEqual(['5 targets', '3 catches', '27 rec yds', '1 rec TD']);
    expect(line(tePlayer, { ...ppr, off: ['reception'] })).toEqual(['27 rec yds', '1 rec TD']);
    expect(line(entry({}), { ...ppr, sacked: -1 })).toContain('5 sacked');
    expect(line(entry({ espnId: '4569987', position: 'RB' }), { ...ppr, steps: [{ stat: 'rushAttempt', every: 10, points: 1 }] })).toContain('17 carries');
  });

  it('shows whatever the player recorded, whatever the position', () => {
    const trick = only({ twoPointConversions: 0, safeties: 0, passing: { completions: 1, attempts: 1, yards: 40, touchdowns: 1, interceptions: 0 }, fumbles: { fumbles: 1, lost: 1, recovered: 0 } });
    expect(line(x, ppr, trick)).toEqual(['40 pass yds', '1 pass TD', '1 fum lost']); // a receiver's trick play; fumbles alone score nothing in PPR
  });

  it('adds return yards and TDs only when they score and are not 0', () => {
    const returner = (returns: NonNullable<PlayerStats['returns']>, v: ScoringValues = { ...ppr, kickReturnYards: 0.04 }) =>
      line(x, v, only({ twoPointConversions: 0, safeties: 0, returns }));
    expect(returner({ touchdowns: 0, kickYards: 0, puntYards: 0 })).toEqual([]);
    expect(returner({ touchdowns: 1, kickYards: 98, puntYards: 12 })).toEqual(['98 ret yds', '1 ret TD']); // punt return yards score nothing here
    expect(returner({ touchdowns: 1, kickYards: 98, puntYards: 12 }, { ...ppr, kickReturnYards: 0.04, puntReturnYards: 0.04 })).toEqual(['110 ret yds', '1 ret TD']);
  });

  it('always shows points allowed, since 0 is a shutout', () => {
    const shutout = { ...stats, defenses: { 23: { ...stats.defenses['23']!, sacks: 0, interceptions: 0, fumbleRecoveries: 0, pointsAllowed: 0 } } };
    expect(line(entry({ kind: 'defense', espnId: '23', position: 'D/ST' }), ppr, shutout)).toEqual(['0 pts allowed']);
  });

  it('explains each stat with the league rules behind it and what it earned this game', () => {
    const rules = (e: FollowedEntry, v: ScoringValues) => Object.fromEntries(statLine(e, stats, v).map((s) => [s.label, s.rules]));
    const te = rules(entry({ espnId: '4430802', position: 'TE' }), { ...ppr, rec100: 3, steps: [{ stat: 'recYards', every: 10, points: 0.5 }] });
    expect(te['rec yds']).toBe('Per receiving yard: 0.1\n100-199 yard receiving game: 3\nEvery 10 receiving yards: 0.5\n+3.70 pts this game'); // 27 yards: no bonus yet
    expect(rules(entry({}), ppr).INT).toBe('Interception thrown: -2\n-4.00 pts this game');
    expect(rules(entry({ espnId: '17372', position: 'K' }), ppr).FG).toContain('Missed field goal (any distance): -1\n+2.00 pts this game');
    const dst = rules(entry({ kind: 'defense', espnId: '23', position: 'D/ST' }), { ...ppr, yardsAllowed350: -1 });
    expect(dst['yds allowed']).toBe('372 yards allowed: -1.00\n-1.00 pts this game');
    expect(dst['pts allowed']).toBe('27 points allowed: 0.00\n0.00 pts this game');
  });

  it('is empty without stats', () => {
    expect(statLine(entry({}), undefined, ppr)).toEqual([]);
    expect(statLine(entry({ espnId: '1' }), stats, ppr)).toEqual([]);
  });
});

const live: GameInfo = {
  eventId: '1', state: 'in', period: 2, clock: '6:41', kickoff: '2026-10-04T20:25Z',
  home: { id: '23', abbr: 'PIT', color: '#000000', score: 10 }, away: { id: '5', abbr: 'CLE', color: '#472a08', score: 3 },
};
const withSituation = (possessionTeamId: string, yardsToEndzone: number) => ({
  ...stats, situation: { possessionTeamId, yardsToEndzone, downDistanceText: '', lastPlayText: '' },
});

describe('isRedZone', () => {
  it('is true only for offensive players of the team with the ball inside the 20 in a live game', () => {
    expect(isRedZone(entry({}), live, withSituation('23', 12))).toBe(true);
    expect(isRedZone(entry({}), live, withSituation('23', 21))).toBe(false);
    expect(isRedZone(entry({}), live, withSituation('5', 12))).toBe(false);
    expect(isRedZone(entry({ position: 'LB' }), live, withSituation('23', 12))).toBe(false);
    expect(isRedZone(entry({}), { ...live, state: 'post' }, withSituation('23', 12))).toBe(false);
  });
});

describe('textOn', () => {
  it('picks readable text for dark and light team colors', () => {
    expect(textOn('#000000')).toBe('#ffffff');
    expect(textOn('#aa0000')).toBe('#ffffff');
    expect(textOn('#d3bc8d')).toBe('#000000'); // Saints gold
    expect(textOn('#ffb612')).toBe('#000000');
  });
});

describe('resultText', () => {
  it('describes a final from the team perspective', () => {
    const final = { ...live, state: 'post' as const, home: { ...live.home, score: 24 }, away: { ...live.away, score: 27 } };
    expect(resultText(final, '23')).toBe('Lost 24-27 vs CLE');
    expect(resultText(final, '5')).toBe('Won 27-24 at PIT');
  });
});

describe('displayName', () => {
  const as = (name: string, mode: 'full' | 'initial' | 'formal', kind: FollowedEntry['kind'] = 'player') => displayName({ kind, name }, mode);

  it('keeps the full name, and shortens or reorders it for the other modes', () => {
    expect(as('David Montgomery', 'full')).toBe('David Montgomery');
    expect(as('David Montgomery', 'initial')).toBe('D. Montgomery');
    expect(as('David Montgomery', 'formal')).toBe('Montgomery, David');
  });

  it('keeps suffixes with the last name', () => {
    expect(as('Patrick Mahomes II', 'initial')).toBe('P. Mahomes II');
    expect(as('Patrick Mahomes II', 'formal')).toBe('Mahomes II, Patrick');
    expect(as('Odell Beckham Jr.', 'formal')).toBe('Beckham Jr., Odell');
  });

  it('keeps name particles with the last name and existing initials as they are', () => {
    expect(as('Amon-Ra St. Brown', 'formal')).toBe('St. Brown, Amon-Ra');
    expect(as('Amon-Ra St. Brown', 'initial')).toBe('A. St. Brown');
    expect(as('D.J. Moore', 'initial')).toBe('D.J. Moore');
  });

  it('leaves one-word names and team defenses alone', () => {
    expect(as('Cher', 'formal')).toBe('Cher');
    expect(as('Pittsburgh Steelers', 'formal', 'defense')).toBe('Pittsburgh Steelers');
  });
});
