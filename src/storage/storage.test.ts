import { vi } from 'vitest';
import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from './types';
import { addEntry, followedStore, moveEntry, removeEntry, updateEntryTeam, withValidProfiles } from './followed';
import { addProfile, applyPreset, deleteProfile, profilesStore, setTier, setValue } from './profiles';
import { followSystemTheme, setTheme, themeStore } from './theme';
import { reloadAllStores } from './store';

const purdy = (profileId: string): FollowedEntry => ({
  kind: 'player', espnId: '4361741', name: 'Brock Purdy', teamId: '25', teamAbbr: 'SF', position: 'QB', jersey: '13', profileId,
});
const profile = (id: string, name: string): Profile => ({ id, name, preset: 'ppr', values: copyValues(PRESETS.ppr) });
const seedProfiles = (...ps: Profile[]) => {
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(ps));
  reloadAllStores();
};

describe('store loading', () => {
  it('creates one PPR profile named My league on first run', () => {
    const [p] = profilesStore.get();
    expect(profilesStore.get()).toHaveLength(1);
    expect(p?.name).toBe('My league');
    expect(p?.preset).toBe('ppr');
  });

  it('keeps the default profile id stable across reloads', () => {
    const id = profilesStore.get()[0]!.id;
    reloadAllStores();
    expect(profilesStore.get()[0]!.id).toBe(id);
  });

  it('replaces a corrupt stored value with the persisted fallback', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:profiles', '{');
    reloadAllStores();
    const id = profilesStore.get()[0]!.id;
    expect(JSON.parse(localStorage.getItem('nflsw:v1:profiles')!)[0].id).toBe(id);
    reloadAllStores();
    expect(profilesStore.get()[0]!.id).toBe(id);
  });

  it('rejects a stored profile with an unknown preset', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:profiles', JSON.stringify([{ ...profile('p1', 'Old'), preset: 'bogus' }]));
    reloadAllStores();
    expect(profilesStore.get()[0]?.name).toBe('My league');
  });

  it('warns when a write to localStorage fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    addEntry(purdy('p1'));
    expect(followedStore.get()).toEqual([purdy('p1')]);
    expect(warn).toHaveBeenCalled();
  });

  it('persists and reloads', () => {
    seedProfiles(profile('p1', 'Office'));
    addEntry(purdy('p1'));
    reloadAllStores();
    expect(followedStore.get()).toEqual([purdy('p1')]);
  });

  it('falls back to defaults on corrupt JSON and on the wrong shape', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:followed', '{');
    localStorage.setItem('nflsw:v1:profiles', JSON.stringify({ a: 1 }));
    reloadAllStores();
    expect(followedStore.get()).toEqual([]);
    expect(profilesStore.get()[0]?.name).toBe('My league');
    expect(warn).toHaveBeenCalled();
  });

  it('fills scoring fields missing from stored profiles with PPR defaults', () => {
    const { dstTd: _omit, ...partial } = PRESETS.ppr;
    localStorage.setItem('nflsw:v1:profiles', JSON.stringify([{ id: 'p1', name: 'Old', preset: 'custom', values: partial }]));
    reloadAllStores();
    expect(profilesStore.get()[0]?.values.dstTd).toBe(6);
  });
});

describe('followed entries', () => {
  it('ignores an exact duplicate but allows the same player in another profile', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    expect(followedStore.get().map((e) => e.profileId)).toEqual(['p1', 'p2']);
  });

  it('removes one entry', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    removeEntry(purdy('p1'));
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });

  it('moves an entry, merging into an existing one in the target profile', () => {
    addEntry(purdy('p1'));
    moveEntry(purdy('p1'), 'p2');
    expect(followedStore.get()).toEqual([purdy('p2')]);
    addEntry(purdy('p1'));
    moveEntry(purdy('p1'), 'p2');
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });

  it('updates the team of every entry for a traded player', () => {
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    updateEntryTeam('4361741', { teamId: '7', teamAbbr: 'DEN', position: 'QB', jersey: '10' });
    expect(followedStore.get().every((e) => e.teamAbbr === 'DEN' && e.jersey === '10')).toBe(true);
  });

  it('moves entries of unknown profiles to the first profile without duplicating', () => {
    expect(withValidProfiles([purdy('gone'), purdy('p1')], ['p1', 'p2'])).toEqual([purdy('p1')]);
  });
});

describe('profiles', () => {
  it('adds a PPR profile and returns its id', () => {
    const id = addProfile('Friends league');
    expect(profilesStore.get().find((p) => p.id === id)?.name).toBe('Friends league');
  });

  it('marks a profile custom when a value changes', () => {
    const id = profilesStore.get()[0]!.id;
    setValue(id, 'passTd', 6);
    setTier(id, 0, 12);
    const p = profilesStore.get()[0]!;
    expect(p.values.passTd).toBe(6);
    expect(p.values.pointsAllowed[0]).toBe(12);
    expect(p.preset).toBe('custom');
  });

  it('ignores non-finite values and out-of-range tier indexes', () => {
    const id = profilesStore.get()[0]!.id;
    const before = profilesStore.get();
    setValue(id, 'passTd', NaN);
    setValue(id, 'passTd', Infinity);
    setTier(id, 7, 5);
    setTier(id, -1, 5);
    setTier(id, 0, NaN);
    expect(profilesStore.get()).toEqual(before);
    expect(profilesStore.get()[0]!.preset).toBe('ppr');
  });

  it('applies a preset', () => {
    const id = profilesStore.get()[0]!.id;
    setValue(id, 'passTd', 6);
    applyPreset(id, 'standard');
    const p = profilesStore.get()[0]!;
    expect(p.preset).toBe('standard');
    expect(p.values.reception).toBe(0);
    expect(p.values.passTd).toBe(4);
  });

  it('refuses to delete the last profile', () => {
    const id = profilesStore.get()[0]!.id;
    expect(deleteProfile(id, id)).toBe(false);
    expect(profilesStore.get()).toHaveLength(1);
  });

  it('drops duplicates when reassigning entries of a deleted profile', () => {
    seedProfiles(profile('p1', 'Office'), profile('p2', 'Friends'));
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    expect(deleteProfile('p1', 'p2')).toBe(true);
    expect(profilesStore.get().map((p) => p.id)).toEqual(['p2']);
    expect(followedStore.get()).toEqual([purdy('p2')]);
  });
});

describe('theme', () => {
  it('stores the theme and applies it to the document', () => {
    expect(themeStore.get()).toBeNull();
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    reloadAllStores();
    expect(themeStore.get()).toBe('dark');
  });
});

describe('orphaned followed entries', () => {
  it('are moved to an existing profile in storage when profiles fall back to a default', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:followed', JSON.stringify([purdy('gone')]));
    localStorage.setItem('nflsw:v1:profiles', '{');
    reloadAllStores();
    const ids = profilesStore.get().map((p) => p.id);
    const stored = JSON.parse(localStorage.getItem('nflsw:v1:followed')!);
    expect(stored).toHaveLength(1);
    expect(ids).toContain(stored[0].profileId);
    expect(followedStore.get()[0]?.profileId).toBe(stored[0].profileId);
  });
});

describe('system theme', () => {
  function mockMedia() {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    const mql = {
      matches: false,
      addEventListener: (_: string, l: typeof listener) => { listener = l; },
      removeEventListener: () => { listener = undefined; },
    };
    vi.stubGlobal('matchMedia', () => mql);
    return { change: (matches: boolean) => listener?.({ matches }), attached: () => listener !== undefined };
  }

  it('follows an OS theme change while no theme is stored', () => {
    const media = mockMedia();
    const stop = followSystemTheme();
    media.change(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    media.change(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
    expect(media.attached()).toBe(false);
  });

  it('ignores OS changes once the user has chosen a theme', () => {
    const media = mockMedia();
    followSystemTheme();
    setTheme('light');
    media.change(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('does nothing without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(() => followSystemTheme()()).not.toThrow();
  });
});
