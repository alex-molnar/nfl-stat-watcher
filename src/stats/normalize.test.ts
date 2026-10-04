import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnPlay, EspnSummary } from '../espn/types';
import { allPlays, normalizeSummary, shortName, situationFrom } from './normalize';

const summary = summaryJson as unknown as EspnSummary;
const game = normalizeSummary(summary);

describe('normalizeSummary on PIT 24 at CLE 27', () => {
  it('reads passing and credits a successful 2-point run', () => {
    expect(game.players['8439']?.passing).toEqual({ completions: 22, attempts: 40, yards: 299, touchdowns: 3, interceptions: 2, sacked: 1 });
    expect(game.players['8439']?.twoPointConversions).toBe(1);
  });

  it('reads rushing and receiving, and does not credit a failed 2-point attempt', () => {
    const warren = game.players['4569987'];
    expect(warren?.rushing).toEqual({ attempts: 17, yards: 93, touchdowns: 0 });
    expect(warren?.receiving).toEqual({ receptions: 3, targets: 6, yards: 33, touchdowns: 0 });
    expect(warren?.twoPointConversions).toBe(0);
  });

  it('reads a tight end touchdown', () => {
    expect(game.players['4430802']?.receiving).toEqual({ receptions: 3, targets: 5, yards: 27, touchdowns: 1 });
  });

  it('reads kicking and parses made field goal distances', () => {
    expect(game.players['17372']?.kicking).toEqual({ fgMade: 1, fgAttempts: 2, longest: 31, xpMade: 1, xpAttempts: 1, madeDistances: [31], missedDistances: [48] });
    expect(game.players['4258620']?.kicking?.madeDistances).toEqual([44, 56]);
  });

  it('reads individual defense, interceptions and fumbles', () => {
    expect(game.players['4361652']?.defense).toEqual({ totalTackles: 9, soloTackles: 7, sacks: 1, tacklesForLoss: 1, passesDefended: 0, qbHits: 1, touchdowns: 0 });
    expect(game.players['3045282']?.fumbles?.recovered).toBe(1);
    expect(game.players['4820584']?.interceptions).toEqual({ interceptions: 1, touchdowns: 0 });
    expect(game.players['3122840']?.fumbles?.lost).toBe(1);
  });

  it('credits touchdown lengths to the passer, receiver and runner named in the play text', () => {
    const lengths = Object.values(game.players).flatMap((p) => p.tdYards ? [p.tdYards] : []);
    expect(lengths.flatMap((l) => l.pass).sort((a, b) => a - b)).toEqual([2, 3, 12, 21]);
    expect(lengths.flatMap((l) => l.rec).sort((a, b) => a - b)).toEqual([2, 3, 12, 21]);
    expect(lengths.flatMap((l) => l.rush).sort((a, b) => a - b)).toEqual([2, 28]);
    expect(game.players['8439']?.tdYards?.pass).toEqual([12, 21, 3]);
  });
  it('builds team defense stats for both teams', () => {
    expect(game.defenses['23']).toEqual({ sacks: 2, interceptions: 1, fumbleRecoveries: 1, touchdowns: 0, safeties: 0, pointsAllowed: 27, yardsAllowed: 372 });
    expect(game.defenses['5']).toEqual({ sacks: 5, interceptions: 2, fumbleRecoveries: 0, touchdowns: 0, safeties: 0, pointsAllowed: 24, yardsAllowed: 361 });
  });
});

describe('shortName', () => {
  it('matches the play text style', () => {
    expect(shortName({ firstName: 'Aaron', lastName: 'Rodgers', displayName: 'Aaron Rodgers' })).toBe('A.Rodgers');
    expect(shortName({ firstName: 'T.J.', lastName: 'Watt', displayName: 'T.J. Watt' })).toBe('T.Watt');
  });
  it('drops name suffixes', () => {
    expect(shortName({ firstName: 'Marvin', lastName: 'Harrison Jr.', displayName: 'Marvin Harrison Jr.' })).toBe('M.Harrison');
  });
  it('keeps the first part of a multi-part last name', () => {
    expect(shortName({ firstName: 'Amon-Ra', lastName: 'St. Brown', displayName: 'Amon-Ra St. Brown' })).toBe('A.St.');
  });
  it('falls back to the display name', () => {
    expect(shortName({ displayName: 'Brock Purdy' })).toBe('B.Purdy');
  });
});

const play = (id: string, text: string, team: string, end?: EspnPlay['end']): EspnPlay => ({
  id, text, start: { team: { id: team }, yardsToEndzone: 40, downDistanceText: '1st & 10 at X 40' }, end,
});

describe('plays', () => {
  it('dedupes plays that appear in both previous and current drives', () => {
    const fg = play('1', 'C.Boswell 31 yard field goal is GOOD, Center-C.Kuntz.', '23');
    const s: EspnSummary = { ...summary, drives: { previous: [{ plays: [fg] }], current: { plays: [fg] } } };
    expect(allPlays(s)).toHaveLength(1);
    expect(normalizeSummary(s).players['17372']?.kicking?.madeDistances).toEqual([31]);
  });

  it('credits a safety to the defending team and the named defender', () => {
    const safety = play('9', 'D.Watson sacked in End Zone by T.Watt, SAFETY.', '5');
    const s: EspnSummary = { ...summary, drives: { previous: [{ plays: [safety] }] } };
    const g = normalizeSummary(s);
    expect(g.defenses['23']?.safeties).toBe(1);
    expect(g.defenses['5']?.safeties).toBe(0);
    expect(g.players['3045282']?.safeties).toBe(1);
  });

  it('derives the situation from the end of the last play', () => {
    const last = play('3', 'B.Purdy pass short right to G.Kittle for 18 yards', '25', {
      team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '2nd & 6 at DEN 12',
    });
    expect(situationFrom([last])).toEqual({ possessionTeamId: '25', yardsToEndzone: 12, downDistanceText: '2nd & 6 at DEN 12', lastPlayText: last.text });
  });

  it('falls back to the start spot and returns null without plays', () => {
    expect(situationFrom([play('4', 'Kickoff', '7')])?.yardsToEndzone).toBe(40);
    expect(situationFrom([])).toBeNull();
  });
});
