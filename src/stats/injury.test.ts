import { describe, expect, it } from 'vitest';
import { injuryLabel, injuryTone, isOut } from './injury';

describe('injury designations', () => {
  it('treats out, injured reserve and suspensions as out, and nothing else', () => {
    for (const status of ['Out', 'out', 'Injured Reserve', 'IR', 'Suspension', 'PUP']) expect(isOut({ status })).toBe(true);
    for (const status of ['Questionable', 'Doubtful', 'Day-To-Day', 'Probable']) expect(isOut({ status })).toBe(false);
    expect(isOut(undefined)).toBe(false);
  });

  it('maps a status to a tone and adds the injury to the label when ESPN names it', () => {
    expect(injuryTone({ status: 'Out' })).toBe('out');
    expect(injuryTone({ status: 'Doubtful' })).toBe('doubtful');
    expect(injuryTone({ status: 'Questionable' })).toBe('questionable');
    expect(injuryTone({ status: 'Day-To-Day' })).toBe('questionable');
    expect(injuryTone({ status: 'Probable' })).toBe('other');
    expect(injuryLabel({ status: 'Questionable', type: 'Hamstring' })).toBe('Questionable · Hamstring');
    expect(injuryLabel({ status: 'Out' })).toBe('Out');
  });
});

import { injuryOf, parseLeagueInjuries } from './injury';

const entry = (id: string, name: string, status: string, details?: unknown) => ({
  id: '-1', status, athlete: { displayName: name, links: [{ rel: ['playercard', 'desktop', 'athlete'], href: `https://www.espn.com/nfl/player/_/id/${id}/x` }, { rel: ['stats'], href: `https://www.espn.com/nfl/player/stats/_/id/999/x` }] }, details,
});
const report = { injuries: [
  { displayName: 'Pittsburgh Steelers', injuries: [entry('4038815', 'Rico Dowdle', 'Out', { type: 'Toe', returnDate: '2026-10-11' }), entry('1', 'Healthy', 'Active')] },
  { displayName: 'Philadelphia Eagles', injuries: [entry('4426385', 'DeVonta Smith', 'Out', { type: 'Not Specified' }), entry('2', 'Iffy', 'Questionable', { type: 'Hamstring' })] },
] };

describe('league injury report', () => {
  it('keys every designation by the athlete id in the player card link, with the injury when named', () => {
    expect(parseLeagueInjuries(report)).toEqual({
      '4038815': { status: 'Out', type: 'Toe', returnDate: '2026-10-11' },
      '4426385': { status: 'Out' },
      '2': { status: 'Questionable', type: 'Hamstring' },
    });
  });

  it('leaves out healthy (Active) players, entries with no player card, and malformed input', () => {
    expect(parseLeagueInjuries(report)['1']).toBeUndefined();
    expect(parseLeagueInjuries({ injuries: [{ injuries: [{ status: 'Out', athlete: { links: [] } }] }] })).toEqual({});
    expect(parseLeagueInjuries(null)).toEqual({});
    expect(parseLeagueInjuries({ injuries: 'no' })).toEqual({});
  });

  it('prefers the game\'s own report, and falls back to the league report', () => {
    const game = { injuries: { '5': { status: 'Out' } } };
    const league = { '5': { status: 'Questionable' }, '6': { status: 'Doubtful' } };
    expect(injuryOf('5', game, league)).toEqual({ status: 'Out' });
    expect(injuryOf('6', game, league)).toEqual({ status: 'Doubtful' });
    expect(injuryOf('7', undefined, undefined)).toBeUndefined();
  });
});
