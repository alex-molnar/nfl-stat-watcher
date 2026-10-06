import { vi } from 'vitest';
import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from './types';
import { addEntry, entryKey, followedStore, moveEntry, removeEntry, sideOf, updateEntryTeam, withValidProfiles } from './followed';
import { opponent } from '../test/data';
import { addProfile, applyPreset, deleteProfile, profilesStore, setPointsAllowedBand, setProfileColor, setRuleEnabled, setTier, setValue } from './profiles';
import { followSystemTheme, setTheme, themeStore } from './theme';
import { reloadAllStores } from './store';

const purdy = (profileId: string): FollowedEntry => ({
  kind: 'player', espnId: '4361741', name: 'Brock Purdy', teamId: '25', teamAbbr: 'SF', position: 'QB', jersey: '13', profileId,
});
const kelce = (profileId: string): FollowedEntry => ({
  kind: 'player', espnId: '15847', name: 'Travis Kelce', teamId: '12', teamAbbr: 'KC', position: 'TE', jersey: '87', profileId,
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

describe('league colours', () => {
  it('gives the first league a colour and every new league the next unused one', () => {
    const first = profilesStore.get()[0]!.color;
    expect(first).toMatch(/^#[0-9a-f]{6}$/i);
    const id = addProfile('Second');
    const second = profilesStore.get().find((p) => p.id === id)!.color;
    expect(second).not.toBe(first);
    const id3 = addProfile('Third');
    expect(new Set([first, second, profilesStore.get().find((p) => p.id === id3)!.color]).size).toBe(3);
  });

  it('gives profiles saved before colours existed different colours, and keeps ones they chose', () => {
    const { color: _c, ...plain } = profile('a', 'A');
    seedProfiles(plain as Profile, { ...plain, id: 'b', name: 'B' } as Profile, { ...plain, id: 'c', name: 'C', color: '#123456' } as Profile);
    const colors = profilesStore.get().map((p) => p.color);
    expect(colors[2]).toBe('#123456');
    expect(new Set(colors).size).toBe(3);
    reloadAllStores();
    expect(profilesStore.get().map((p) => p.color)).toEqual(colors); // stable across reloads
  });

  it('changes the colour, and ignores anything that is not #rrggbb', () => {
    const id = profilesStore.get()[0]!.id;
    setProfileColor(id, '#AABBCC');
    expect(profilesStore.get()[0]!.color).toBe('#aabbcc');
    setProfileColor(id, 'red');
    setProfileColor(id, '#fff');
    expect(profilesStore.get()[0]!.color).toBe('#aabbcc');
  });
});

describe('rule switches and migrated fields', () => {
  it('turns a rule off and on without losing its weight', () => {
    const id = profilesStore.get()[0]!.id;
    setRuleEnabled(id, 'passTd', false);
    expect(profilesStore.get()[0]!.values.off).toEqual(['passTd']);
    expect(profilesStore.get()[0]!.values.passTd).toBe(4);
    expect(profilesStore.get()[0]!.preset).toBe('custom');
    setRuleEnabled(id, 'passTd', true);
    expect(profilesStore.get()[0]!.values.off).toBeUndefined();
  });

  it('splits a stored single 50+ yard kick value into 50-59 and 60+ and drops unknown switches', () => {
    const { fg50to59: _a, fg60plus: _b, ...legacy } = copyValues(PRESETS.ppr);
    seedProfiles({ id: 'p1', name: 'Old', preset: 'custom', values: { ...legacy, fg50plus: 7, off: ['passTd', 'nonsense'] } as never });
    const values = profilesStore.get()[0]!.values;
    expect(values.fg50to59).toBe(7);
    expect(values.fg60plus).toBe(7);
    expect(values.off).toEqual(['passTd']);
    expect(values.passTd40).toBe(0);
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

  it('edits imported points-allowed bands and clears them when applying a preset', () => {
    const id = profilesStore.get()[0]!.id;
    profilesStore.set(profilesStore.get().map((p) => ({ ...p, values: { ...p.values, pointsAllowedBands: [
      { min: 0, max: 17, points: 2 }, { min: 18, max: null, points: -2 },
    ] } })));
    setPointsAllowedBand(id, 1, 'points', -4);
    expect(profilesStore.get()[0]!.values.pointsAllowedBands?.[1]?.points).toBe(-4);
    applyPreset(id, 'standard');
    expect(profilesStore.get()[0]!.values.pointsAllowedBands).toBeUndefined();
  });

  it('refuses to delete the last profile', () => {
    const id = profilesStore.get()[0]!.id;
    expect(deleteProfile(id, { moveTo: id, opponents: false })).toBe(false);
    expect(profilesStore.get()).toHaveLength(1);
  });

  it('drops duplicates when reassigning entries of a deleted profile', () => {
    seedProfiles(profile('p1', 'Office'), profile('p2', 'Friends'));
    addEntry(purdy('p1'));
    addEntry(purdy('p2'));
    expect(deleteProfile('p1', { moveTo: 'p2', opponents: false })).toBe(true);
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

describe('opponent entries', () => {
  it('loads entries stored before vs mode unchanged', () => {
    seedProfiles(profile('p1', 'Office'));
    const raw = JSON.stringify([purdy('p1')]);
    localStorage.setItem('nflsw:v1:followed', raw);
    reloadAllStores();
    expect(followedStore.get()).toEqual([purdy('p1')]);
    expect(sideOf(followedStore.get()[0]!)).toBe('mine');
    expect(localStorage.getItem('nflsw:v1:followed')).toBe(raw);
  });

  it('accepts side opponent and rejects any other side value', () => {
    seedProfiles(profile('p1', 'Office'));
    localStorage.setItem('nflsw:v1:followed', JSON.stringify([opponent(purdy('p1'))]));
    reloadAllStores();
    expect(followedStore.get()).toEqual([opponent(purdy('p1'))]);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const side of ['mine', 'theirs', null, 1]) {
      localStorage.setItem('nflsw:v1:followed', JSON.stringify([{ ...purdy('p1'), side }]));
      reloadAllStores();
      expect(followedStore.get()).toEqual([]);
    }
    expect(warn).toHaveBeenCalled();
  });

  it('keys my entries as before and opponent entries with a suffix', () => {
    expect(entryKey(purdy('p1'))).toBe('player:4361741:p1');
    expect(entryKey(opponent(purdy('p1')))).toBe('player:4361741:p1:opponent');
  });

  it('keeps the same player on both sides of one league apart', () => {
    addEntry(purdy('p1'));
    addEntry(opponent(purdy('p1')));
    addEntry(opponent(purdy('p1')));
    expect(followedStore.get()).toEqual([purdy('p1'), opponent(purdy('p1'))]);
    removeEntry(opponent(purdy('p1')));
    expect(followedStore.get()).toEqual([purdy('p1')]);
  });

  it('never moves an opponent entry, and moving mine leaves the opponent copy alone', () => {
    addEntry(purdy('p1'));
    addEntry(opponent(purdy('p1')));
    moveEntry(opponent(purdy('p1')), 'p2');
    expect(followedStore.get()).toEqual([purdy('p1'), opponent(purdy('p1'))]);
    moveEntry(purdy('p1'), 'p2');
    expect(followedStore.get()).toEqual([purdy('p2'), opponent(purdy('p1'))]);
  });

  it('updates the team on both sides after a trade', () => {
    addEntry(purdy('p1'));
    addEntry(opponent(purdy('p1')));
    updateEntryTeam('4361741', { teamId: '7', teamAbbr: 'DEN', position: 'QB', jersey: '10' });
    expect(followedStore.get().every((e) => e.teamAbbr === 'DEN')).toBe(true);
  });

  it('drops opponent entries of a missing profile and still moves mine', () => {
    expect(withValidProfiles([purdy('gone'), opponent(kelce('gone')), opponent(purdy('p1'))], ['p1', 'p2'])).toEqual([
      purdy('p1'),
      opponent(purdy('p1')),
    ]);
  });

  it('removes the deleted league\'s opponent entries and moves mine', () => {
    seedProfiles(profile('p1', 'Office'), profile('p2', 'Friends'));
    addEntry(purdy('p1'));
    addEntry(opponent(purdy('p1')));
    addEntry(opponent(kelce('p2')));
    expect(deleteProfile('p1', { moveTo: 'p2', opponents: false })).toBe(true);
    expect(followedStore.get()).toEqual([purdy('p2'), opponent(kelce('p2'))]);
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toEqual([purdy('p2'), opponent(kelce('p2'))]);
  });

  it('drops orphaned opponent entries from storage when profiles fall back to a default', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('nflsw:v1:followed', JSON.stringify([purdy('gone'), opponent(kelce('gone'))]));
    localStorage.setItem('nflsw:v1:profiles', '{');
    reloadAllStores();
    const id = profilesStore.get()[0]!.id;
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toEqual([purdy(id)]);
  });
});
