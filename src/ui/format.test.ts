import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnSummary } from '../espn/types';
import { normalizeSummary } from '../stats/normalize';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';
import { isRedZone, resultText, statLine, textOn } from './format';

const stats = normalizeSummary(summaryJson as unknown as EspnSummary);
const entry = (over: Partial<FollowedEntry>): FollowedEntry => ({
  kind: 'player', espnId: '8439', name: 'Aaron Rodgers', teamId: '23', teamAbbr: 'PIT', position: 'QB', profileId: 'p1', ...over,
});
const line = (e: FollowedEntry) => statLine(e, stats).map((s) => `${s.value} ${s.label}`);

describe('statLine', () => {
  it('formats each position', () => {
    expect(line(entry({}))).toEqual(['22/40 comp', '299 pass yds', '3 pass TD', '2 INT', '0 rush yds']);
    expect(line(entry({ espnId: '4569987', position: 'RB' }))).toEqual(['17 carries', '93 rush yds', '3 catches', '33 rec yds', '0 TD']);
    expect(line(entry({ espnId: '4430802', position: 'TE' }))).toEqual(['3/5 catches', '27 rec yds', '1 TD']);
    expect(line(entry({ espnId: '17372', position: 'K' }))).toEqual(['1/2 FG', '31 long', '1/1 XP']);
    expect(line(entry({ espnId: '4361652', position: 'LB' }))).toEqual(['9 tackles', '1 sacks', '1 TFL', '0 PD', '0 INT']);
    expect(line(entry({ kind: 'defense', espnId: '23', position: 'D/ST' }))).toEqual(['2 sacks', '1 INT', '1 fum rec', '27 pts allowed']);
  });
  it('is empty without stats', () => {
    expect(statLine(entry({}), undefined)).toEqual([]);
    expect(statLine(entry({ espnId: '1' }), stats)).toEqual([]);
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
    expect(textOn('#d3bc8d')).toBe('#111111'); // Saints gold
    expect(textOn('#ffb612')).toBe('#111111');
  });
});

describe('resultText', () => {
  it('describes a final from the team perspective', () => {
    const final = { ...live, state: 'post' as const, home: { ...live.home, score: 24 }, away: { ...live.away, score: 27 } };
    expect(resultText(final, '23')).toBe('Lost 24-27 vs CLE');
    expect(resultText(final, '5')).toBe('Won 27-24 at PIT');
  });
});
