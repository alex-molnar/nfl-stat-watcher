import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from '../storage/types';
import { ProfileFileError, exportProfile, mergeProfile, parseProfileFile, serializeProfile } from './profileTransfer';

const profile = (id: string, name: string, extra: Partial<Profile> = {}): Profile => ({ id, name, preset: 'ppr', values: copyValues(PRESETS.ppr), color: '#336699', ...extra });
const player = (espnId: string, profileId: string, extra: Partial<FollowedEntry> = {}): FollowedEntry => ({ kind: 'player', espnId, name: `P${espnId}`, teamId: '1', teamAbbr: 'AAA', position: 'WR', profileId, ...extra });
const roundTrip = (profiles: Profile[], followed: FollowedEntry[]) => parseProfileFile(serializeProfile(exportProfile(profiles, followed)));

describe('export and parse', () => {
  it('round-trips leagues with their scoring and the players of both sides', () => {
    const mine = player('1', 'a');
    const theirs = player('2', 'a', { side: 'opponent', jersey: '12' });
    const file = roundTrip([profile('a', 'Office', { preset: 'standard' }), profile('b', 'Friends')], [mine, theirs, player('3', 'b')]);
    expect(file.leagues.map((l) => [l.id, l.name, l.preset, l.players.length])).toEqual([['a', 'Office', 'standard', 2], ['b', 'Friends', 'ppr', 1]]);
    expect(file.leagues[0]!.players[1]).toMatchObject({ espnId: '2', side: 'opponent', jersey: '12' });
    expect(file.leagues[0]!.players[0]).not.toHaveProperty('profileId');
    expect(file.leagues[0]!.values).toEqual(copyValues(PRESETS.ppr));
  });

  it('leaves out players of a league that does not exist', () => {
    expect(roundTrip([profile('a', 'Office')], [player('1', 'gone')]).leagues[0]!.players).toEqual([]);
  });
});

describe('parseProfileFile refuses', () => {
  const good = () => JSON.parse(serializeProfile(exportProfile([profile('a', 'Office')], [player('1', 'a')])));
  const refuses = (change: (file: ReturnType<typeof good>) => void, message: RegExp) => {
    const file = good();
    change(file);
    expect(() => parseProfileFile(JSON.stringify(file))).toThrow(message);
    expect(() => parseProfileFile(JSON.stringify(file))).toThrow(ProfileFileError);
  };

  it('text that is not JSON, or not a profile', () => {
    expect(() => parseProfileFile('oops')).toThrow('not valid JSON');
    expect(() => parseProfileFile('{"a":1}')).toThrow('not a StatWatch profile');
    expect(() => parseProfileFile('null')).toThrow('not a StatWatch profile');
  });

  it('another version, no leagues, or the same id twice', () => {
    refuses((f) => { f.version = 2; }, /version 2/);
    refuses((f) => { f.leagues = []; }, /1 to 50 leagues/);
    refuses((f) => { f.leagues.push(f.leagues[0]); }, /share an id/);
  });

  it('a league with a bad id, name, preset, scoring, color or player', () => {
    refuses((f) => { f.leagues[0].id = 'has space'; }, /no valid id/);
    refuses((f) => { f.leagues[0].name = '  '; }, /no valid name/);
    refuses((f) => { f.leagues[0].preset = 'nope'; }, /unknown scoring preset/);
    refuses((f) => { f.leagues[0].values.passYards = 'lots'; }, /invalid scoring/);
    refuses((f) => { f.leagues[0].color = 'red'; }, /invalid color/);
    refuses((f) => { f.leagues[0].source = { provider: 'x' }; }, /invalid ESPN source/);
    refuses((f) => { f.leagues[0].players[0].kind = 'coach'; }, /invalid player/);
    refuses((f) => { f.leagues[0].players = 'many'; }, /invalid player list/);
  });

  it('a file that is too large', () => {
    expect(() => parseProfileFile(' '.repeat(5_000_001))).toThrow('too large');
  });
});

describe('mergeProfile', () => {
  const file = (leagues: Profile[], followed: FollowedEntry[]) => roundTrip(leagues, followed);

  it('adds new leagues under their own id with their players', () => {
    const incoming = file([profile('n', 'Newbies')], [player('1', 'n'), player('2', 'n', { side: 'opponent' })]);
    const merged = mergeProfile(incoming, [profile('a', 'Office')], [player('9', 'a')]);
    expect(merged.profiles.map((p) => p.id)).toEqual(['a', 'n']);
    expect(merged.followed).toHaveLength(3);
    expect(merged.summary).toMatchObject({ added: 1, updated: 0, players: 2 });
  });

  it('updates a league with the same id, replacing its scoring and keeping its other players', () => {
    const edited = profile('a', 'Office renamed', { preset: 'standard', values: copyValues(PRESETS.standard) });
    const merged = mergeProfile(file([edited], [player('1', 'a')]), [profile('a', 'Office')], [player('1', 'a'), player('9', 'a')]);
    expect(merged.profiles).toHaveLength(1);
    expect(merged.profiles[0]).toMatchObject({ id: 'a', name: 'Office renamed', preset: 'standard' });
    expect(merged.followed.map((e) => e.espnId)).toEqual(['1', '9']); // 9 stays, 1 is not duplicated
    expect(merged.summary).toMatchObject({ added: 0, updated: 1, players: 0 });
  });

  it('gives a new league a unique name when another league has it', () => {
    const merged = mergeProfile(file([profile('n', 'Office')], []), [profile('a', 'Office')], []);
    expect(merged.profiles.map((p) => p.name)).toEqual(['Office', 'Office 2']);
  });

  it('changes nothing when merged twice', () => {
    const incoming = file([profile('n', 'Newbies')], [player('1', 'n')]);
    const once = mergeProfile(incoming, [profile('a', 'Office')], []);
    const twice = mergeProfile(incoming, once.profiles, once.followed);
    expect(twice.profiles).toEqual(once.profiles);
    expect(twice.followed).toEqual(once.followed);
    expect(twice.summary).toMatchObject({ added: 0, updated: 1, players: 0 });
  });

  it('keeps a player on each side apart, and in each league', () => {
    const incoming = file([profile('n', 'N')], [player('1', 'n'), player('1', 'n', { side: 'opponent' })]);
    expect(mergeProfile(incoming, [profile('a', 'A')], [player('1', 'a')]).followed).toHaveLength(3);
  });

  it('with override deletes every league and player here and keeps only the file\'s', () => {
    const incoming = file([profile('n', 'Newbies')], [player('1', 'n')]);
    const merged = mergeProfile(incoming, [profile('a', 'Office'), profile('b', 'Friends')], [player('9', 'a'), player('8', 'b')], true);
    expect(merged.profiles.map((p) => p.id)).toEqual(['n']);
    expect(merged.followed.map((e) => e.espnId)).toEqual(['1']);
    expect(merged.summary).toMatchObject({ added: 1, updated: 0, players: 1, removed: { leagues: 2, players: 2 } });
  });

  it('does not report removals without override', () => {
    expect(mergeProfile(file([profile('n', 'N')], []), [profile('a', 'A')], []).summary.removed).toBeNull();
  });
});

