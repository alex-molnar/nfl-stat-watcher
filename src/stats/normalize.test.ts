import summaryJson from '../test/fixtures/summary-pit-cle.json';
import type { EspnPlay, EspnSummary } from '../espn/types';
import { allPlays, endsDrive, normalizeSummary, shortName, situationFrom } from './normalize';

const summary = summaryJson as unknown as EspnSummary;
const game = normalizeSummary(summary);

describe('normalizeSummary on PIT 24 at CLE 27', () => {
  it('reads passing and credits a successful 2-point run', () => {
    expect(game.players['8439']?.passing).toEqual({ completions: 22, attempts: 40, yards: 299, touchdowns: 3, interceptions: 2, sacked: 5 });
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

describe('blocked kicks from play text', () => {
  const side = (id: string, name: string) => ({ team: { id }, statistics: [{ name: 'defensive', keys: [] as string[], totals: [] as string[], athletes: [{ athlete: { id: `a${id}`, displayName: name }, stats: [] as string[] }] }] });
  // Two teams, as in a real game: the kicking team has the ball, the other team blocks.
  const game = (kicking: string, blocker: [string, string], text: string) => normalizeSummary({
    header: { id: '1', competitions: [{ competitors: [] }] },
    boxscore: { players: [side(kicking, 'Some Kicker'), side(blocker[0], blocker[1])] },
    drives: { previous: [{ plays: [{ id: '1', text, start: { team: { id: kicking } } }] }] },
  } as unknown as EspnSummary);

  it.each([
    ['punt', 'J.Scott punt is BLOCKED by S.Fehoko, Center-J.Harris, recovered by LAC-A.Ingold at LAC 3.', ['22', 'Simi Fehoko']],
    ['extra point', 'T.Shough pass short left to J.Johnson for 2 yards, TOUCHDOWN. D.Carlson extra point is Blocked (T.Booker), Center-C.Adomitis, Holder-R.Wright.', ['13', 'Thomas Booker']],
    ['field goal', 'B.Aubrey 62 yard field goal is BLOCKED (W.Anderson), Center-T.Sieg, Holder-B.Anger.', ['34', 'Will Anderson']],
  ] as const)('credits a blocked %s to the defense and the named blocker', (_kind, text, blocker) => {
    const g = game('24', [blocker[0], blocker[1]], text);
    expect(g.defenses[blocker[0]]?.blockedKicks).toBe(1);
    expect(g.players[`a${blocker[0]}`]?.blockedKicks).toBe(1);
    expect(g.defenses['24']?.blockedKicks).toBeUndefined();
  });

  it('ignores a kick that is only mentioned, not blocked', () => {
    const g = game('24', ['22', 'Simi Fehoko'], 'J.Scott punt is Good, blocked by nobody. D.Carlson extra point is GOOD.');
    expect(Object.values(g.defenses).every((d) => !d.blockedKicks)).toBe(true);
  });
});

describe('forced fumbles and stuffs from play text', () => {
  const side = (id: string, names: string[]) => ({ team: { id }, statistics: [{ name: 'defensive', keys: [] as string[], totals: [] as string[], athletes: names.map((n, i) => ({ athlete: { id: `${id}${i}`, displayName: n }, stats: [] as string[] })) }] });
  const game = (plays: { type: string; text: string }[]) => normalizeSummary({
    header: { id: '1', competitions: [{ competitors: [] }] },
    boxscore: { players: [side('9', ['Jordan Love']), side('27', ['Antoine Winfield', 'Terrel Bernard', 'Gaines Gaines'])] },
    drives: { previous: [{ plays: plays.map((p, i) => ({ id: String(i), text: p.text, type: { text: p.type }, start: { team: { id: '9' } } })) }] },
  } as unknown as EspnSummary);

  it('credits a forced fumble to the named defender, but not on a play replay reversed', () => {
    const g = game([
      { type: 'Pass Reception', text: 'J.Love pass short right to M.Lloyd to TB 16 for 16 yards (A.Winfield). FUMBLES (A.Winfield), ball out of bounds at TB 16.' },
      { type: 'Pass Incompletion', text: 'J.Love pass short left to M.Golden to GB 42 for 11 yards (J.Parrish). FUMBLES (A.Winfield), RECOVERED by TB-A.Winfield at GB 47.The Replay Official reviewed the pass completion ruling, and the play was REVERSED.' },
    ]);
    expect(g.players['270']?.forcedFumbles).toBe(1);
  });

  it('prefers "Fumble Forced by" over the sacker named in parentheses', () => {
    const g = game([{ type: 'Sack', text: 'T.Shough sacked at LV 30 for -10 yards (J.Chinn). FUMBLES (J.Chinn) [J.Chinn], RECOVERED by LV-T.Johnson at LV 32. Fumble Forced by 27-A.Winfield.' }]);
    expect(g.players['270']?.forcedFumbles).toBe(1);
  });

  it('splits a stuff between the tacklers of a no gain or losing rush and ignores ordinary gains', () => {
    const g = game([
      { type: 'Rush', text: 'R.Stevenson up the middle to NE 19 for no gain (G.Gaines; T.Bernard).' },
      { type: 'Rush', text: 'T.Henderson up the middle to NE 21 for 1 yard (T.Bernard).' },
      { type: 'Rush', text: 'T.Henderson up the middle to NE 21 for -3 yards (T.Bernard).' },
    ]);
    expect(g.players['271']?.stuffs).toBeCloseTo(1.5);
    expect(g.players['272']?.stuffs).toBeCloseTo(0.5);
  });
});

describe('drive end detection', () => {
  const play = (type: string, text = type, extra: Partial<EspnPlay> = {}): EspnPlay => ({ id: `${type}${text}`.slice(0, 40), text, type: { text: type }, start: { team: { id: '25' }, yardsToEndzone: 4 }, ...extra });

  it('knows a drive is over right after a score, even though ESPN appends a timeout to it', () => {
    expect(endsDrive([play('Rush'), play('Rushing Touchdown', 'J.Cook for 4 yards, TOUCHDOWN.'), play('Official Timeout')])).toBe(true);
    expect(endsDrive([play('Pass Reception'), play('Field Goal Good'), play('Official Timeout')])).toBe(true);
    expect(endsDrive([play('Pass Reception'), play('Punt'), play('End Period')])).toBe(true);
  });

  it('knows from the drive result alone when the last play looks ordinary (a turnover on downs)', () => {
    expect(endsDrive([play('Pass Incompletion')])).toBe(false);
    expect(endsDrive([play('Pass Incompletion')], 'DOWNS')).toBe(true);
  });

  it('keeps a drive alive through timeouts and period breaks in the middle of it', () => {
    expect(endsDrive([play('Rush'), play('Pass Reception'), play('Official Timeout')])).toBe(false);
    expect(endsDrive([play('Sack'), play('End Period')])).toBe(false);
  });

  it('treats the kickoff after a score as nobody having the ball yet', () => {
    expect(endsDrive([play('Kickoff')])).toBe(true);
  });

  it('flags the situation as drive over, so the scorer is no longer in the red zone', () => {
    const s = situationFrom([play('Rushing Touchdown'), play('Official Timeout')], true);
    expect(s).toMatchObject({ possessionTeamId: '25', yardsToEndzone: 4, driveOver: true });
    expect(situationFrom([play('Rush')], false)).not.toHaveProperty('driveOver');
  });
});

describe('injury report', () => {
  const summary = (injuries: unknown) => normalizeSummary({
    header: { id: '1', competitions: [{ competitors: [] }] }, boxscore: { players: [] }, injuries,
  } as unknown as EspnSummary);

  it('keys designations by athlete id, with the injury and return date when ESPN gives them', () => {
    const g = summary([
      { team: { id: '25' }, injuries: [
        { status: 'Out', athlete: { id: '10' }, details: { type: 'Ankle', returnDate: '2026-10-11' } },
        { status: 'Questionable', athlete: { id: '11' }, details: { type: 'Not Specified' } },
        { status: 'Doubtful', athlete: { id: '12' } },
      ] },
    ]);
    expect(g.injuries).toEqual({
      '10': { status: 'Out', type: 'Ankle', returnDate: '2026-10-11' },
      '11': { status: 'Questionable' },
      '12': { status: 'Doubtful' },
    });
  });

  it('is empty for a game with no report, and ignores entries without a status or athlete', () => {
    expect(summary(undefined).injuries).toEqual({});
    expect(summary([{ injuries: [{ status: '', athlete: { id: '1' } }, { status: 'Out' }] }]).injuries).toEqual({});
  });
});
