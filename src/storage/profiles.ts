import { PRESETS, copyValues } from '../scoring/presets';
import { VALUE_KEYS, isValidSteps, type PresetId, type Profile, type ScoringValues, type ValueKey } from '../scoring/types';
import { followedStore, reassignProfile, withValidProfiles } from './followed';
import { createStore } from './store';
import { isHexColor, nextLeagueColor } from '../scoring/leagueColor';
import { isLeagueSource } from '../leagues/types';
import { isValidPointsAllowedBands } from '../scoring/types';

const newProfile = (name: string, existing: Profile[] = []): Profile => ({ id: crypto.randomUUID(), name, preset: 'ppr', values: copyValues(PRESETS.ppr), color: nextLeagueColor(existing.map((p) => p.color)) });

function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' && (p.preset === 'custom' || (typeof p.preset === 'string' && p.preset in PRESETS)) && typeof p.values === 'object' && p.values !== null;
}

/** Keeps stored profiles usable when new scoring fields are added later. */
export function repairValues(stored: Partial<ScoringValues> & { fg50plus?: number }): ScoringValues {
  const values = copyValues(PRESETS.ppr);
  for (const key of VALUE_KEYS) {
    const v = stored[key];
    if (typeof v === 'number' && Number.isFinite(v)) values[key] = v;
  }
  // The single 50+ yard value became separate 50-59 and 60+ values.
  if (typeof stored.fg50plus === 'number' && Number.isFinite(stored.fg50plus)) {
    if (typeof stored.fg50to59 !== 'number') values.fg50to59 = stored.fg50plus;
    if (typeof stored.fg60plus !== 'number') values.fg60plus = stored.fg50plus;
  }
  if (Array.isArray(stored.pointsAllowed) && stored.pointsAllowed.length === 7 && stored.pointsAllowed.every((n) => typeof n === 'number')) values.pointsAllowed = [...stored.pointsAllowed];
  if (isValidPointsAllowedBands(stored.pointsAllowedBands)) values.pointsAllowedBands = stored.pointsAllowedBands.map((band) => ({ ...band }));
  if (isValidSteps(stored.steps) && stored.steps.length) values.steps = stored.steps.map((rule) => ({ ...rule }));
  const off = Array.isArray(stored.off) ? stored.off.filter((key): key is ValueKey => (VALUE_KEYS as readonly unknown[]).includes(key)) : [];
  if (off.length) values.off = [...new Set(off)];
  else delete values.off;
  return values;
}

export const profilesStore = createStore<Profile[]>({
  key: 'nflsw:v1:profiles',
  fallback: () => [newProfile('My league')],
  isValid: (v): v is Profile[] => Array.isArray(v) && v.length > 0 && v.every(isProfile),
  repair: (ps) => ps.reduce<Profile[]>((done, p) => {
    const values = repairValues(p.values);
    const rawSource = p.source as (Record<string, unknown> & { baselineValues?: Partial<ScoringValues> }) | undefined;
    const migrated = rawSource && typeof rawSource === 'object' && rawSource.baselineValues && typeof rawSource.baselineValues === 'object'
      ? { ...rawSource, baselineValues: repairValues(rawSource.baselineValues) }
      : rawSource;
    const source = isLeagueSource(migrated) ? migrated : undefined;
    // Profiles saved before colours existed get the next unused one, in list order, so each looks different.
    const color = isHexColor(p.color) ? p.color : nextLeagueColor([...done, ...ps.slice(done.length + 1)].map((other) => other.color));
    return [...done, { ...p, values, color, ...(source ? { source } : { source: undefined }) }];
  }, []),
});

/** Persists the repair of entries that point at a missing profile (spec section 7), once at startup and after every reload. */
function repairFollowed() {
  const current = followedStore.get();
  const next = withValidProfiles(current, profilesStore.get().map((p) => p.id));
  if (JSON.stringify(next) !== JSON.stringify(current)) followedStore.set(next);
}
repairFollowed();
profilesStore.subscribe(repairFollowed);

function update(id: string, change: (p: Profile) => Profile) {
  profilesStore.set(profilesStore.get().map((p) => (p.id === id ? change(p) : p)));
}

export function addProfile(name: string): string {
  const p = newProfile(name, profilesStore.get());
  profilesStore.set([...profilesStore.get(), p]);
  return p.id;
}

export function setProfileColor(id: string, color: string) {
  if (isHexColor(color)) update(id, (p) => ({ ...p, color: color.toLowerCase() }));
}

export function renameProfile(id: string, name: string) {
  update(id, (p) => ({ ...p, name }));
}

export function deleteProfile(id: string, moveTo: string): boolean {
  const list = profilesStore.get();
  if (list.length <= 1 || id === moveTo || !list.some((p) => p.id === moveTo)) return false;
  reassignProfile(id, moveTo);
  profilesStore.set(list.filter((p) => p.id !== id));
  return true;
}

export function setValue(id: string, key: ValueKey, value: number) {
  if (!Number.isFinite(value)) return;
  update(id, (p) => ({ ...p, preset: 'custom', values: { ...p.values, [key]: value } }));
}

export function setRuleEnabled(id: string, key: ValueKey, enabled: boolean) {
  update(id, (p) => {
    const off = new Set(p.values.off ?? []);
    if (enabled) off.delete(key); else off.add(key);
    const values = { ...p.values };
    if (off.size) values.off = [...off]; else delete values.off;
    return { ...p, preset: 'custom', values };
  });
}

export function setStepPoints(id: string, index: number, points: number) {
  if (!Number.isFinite(points)) return;
  update(id, (p) => {
    const steps = p.values.steps;
    if (!steps || !Number.isInteger(index) || index < 0 || index >= steps.length) return p;
    return { ...p, preset: 'custom', values: { ...p.values, steps: steps.map((rule, i) => (i === index ? { ...rule, points } : rule)) } };
  });
}

export function setTier(id: string, index: number, value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(index) || index < 0 || index > 6) return;
  update(id, (p) => ({
    ...p,
    preset: 'custom',
    values: { ...p.values, pointsAllowed: p.values.pointsAllowed.map((v, i) => (i === index ? value : v)) },
  }));
}

export function setPointsAllowedBand(id: string, index: number, key: 'min' | 'max' | 'points', value: number | null) {
  update(id, (p) => {
    const bands = p.values.pointsAllowedBands;
    if (!bands || !Number.isInteger(index) || index < 0 || index >= bands.length) return p;
    const next = bands.map((band, i) => i === index ? { ...band, [key]: value } : band);
    if (!isValidPointsAllowedBands(next)) return p;
    return { ...p, preset: 'custom', values: { ...p.values, pointsAllowedBands: next } };
  });
}

export function clearPointsAllowedBands(id: string) {
  update(id, (p) => {
    const values = { ...p.values };
    delete values.pointsAllowedBands;
    return { ...p, values };
  });
}

export function applyPreset(id: string, preset: PresetId) {
  update(id, (p) => ({ ...p, preset, values: copyValues(PRESETS[preset]) }));
}
