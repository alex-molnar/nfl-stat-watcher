import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectLeagueSource, commitLeagueImports, createEspnDraft, isLocallyModified, leagueIdentity } from './import';
import { parseEspnLeagueSettings } from './espn/parse';
import { profilesStore, setValue } from '../storage/profiles';
import { reloadAllStores } from '../storage/store';

const fixture = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json', 'utf8')) as unknown;
const draft = () => createEspnDraft(parseEspnLeagueSettings(fixture));

beforeEach(() => {
  localStorage.clear();
  reloadAllStores();
});

describe('commitLeagueImports', () => {
  it('creates an imported profile and preserves its source after reload', () => {
    const value = draft();
    const result = commitLeagueImports([value], [{ sourceIdentity: leagueIdentity(value.source), profileId: null }]);
    expect(result.persisted).toBe(true);
    expect(profilesStore.get().find((profile) => profile.id === result.importedIds[0])?.source?.transport).toBe('public-api');
    reloadAllStores();
    expect(profilesStore.get().find((profile) => profile.id === result.importedIds[0])?.source?.leagueId).toBe('1900128084');
  });

  it('refreshes the matching profile without changing its ID', () => {
    const first = draft();
    const id = commitLeagueImports([first], [{ sourceIdentity: leagueIdentity(first.source), profileId: null }]).importedIds[0]!;
    const refresh = draft();
    refresh.name = 'Renamed ESPN league';
    const result = commitLeagueImports([refresh], [{ sourceIdentity: leagueIdentity(refresh.source), profileId: id }]);
    expect(result.importedIds).toEqual([id]);
    expect(profilesStore.get().find((profile) => profile.id === id)?.name).toBe('Renamed ESPN league');
  });

  it('requires explicit manual targets and rejects a duplicate batch atomically', () => {
    const value = draft();
    const before = profilesStore.get();
    expect(() => commitLeagueImports([value], [])).toThrow(/Choose where/);
    expect(() => commitLeagueImports([value, value], [
      { sourceIdentity: leagueIdentity(value.source), profileId: null },
      { sourceIdentity: leagueIdentity(value.source), profileId: null },
    ])).toThrow(/duplicate league/);
    expect(profilesStore.get()).toEqual(before);
  });

  it('reports when a valid import remains session-only after a quota failure', () => {
    const value = draft();
    const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = commitLeagueImports([value], [{ sourceIdentity: leagueIdentity(value.source), profileId: null }]);
    expect(result.persisted).toBe(false);
    expect(profilesStore.get()).toHaveLength(2);
    quota.mockRestore();
    warn.mockRestore();
  });

  it('detects local edits and disconnects source without deleting the values', () => {
    const value = draft();
    const id = commitLeagueImports([value], [{ sourceIdentity: leagueIdentity(value.source), profileId: null }]).importedIds[0]!;
    const profile = profilesStore.get().find((candidate) => candidate.id === id)!;
    expect(isLocallyModified(profile)).toBe(false);
    setValue(id, 'passTd', 7);
    const edited = profilesStore.get().find((candidate) => candidate.id === id)!;
    expect(isLocallyModified(edited)).toBe(true);
    disconnectLeagueSource(id);
    const disconnected = profilesStore.get().find((candidate) => candidate.id === id)!;
    expect(disconnected.values.passTd).toBe(7);
    expect(disconnected.source).toBeUndefined();
  });
});
