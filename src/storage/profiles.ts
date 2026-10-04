import { PRESETS, copyValues } from '../scoring/presets';
import type { PresetId, Profile, ScoringValues } from '../scoring/types';
import { reassignProfile } from './followed';
import { createStore } from './store';

const newProfile = (name: string): Profile => ({ id: crypto.randomUUID(), name, preset: 'ppr', values: copyValues(PRESETS.ppr) });

function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.name === 'string' && (p.preset === 'custom' || (typeof p.preset === 'string' && p.preset in PRESETS)) && typeof p.values === 'object' && p.values !== null;
}

/** Keeps stored profiles usable when new scoring fields are added later. */
function repairValues(stored: Partial<ScoringValues>): ScoringValues {
  const values = copyValues(PRESETS.ppr);
  for (const key of Object.keys(values) as (keyof ScoringValues)[]) {
    const v = stored[key];
    if (key === 'pointsAllowed') {
      if (Array.isArray(v) && v.length === 7 && v.every((n) => typeof n === 'number')) values.pointsAllowed = [...v];
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      values[key] = v;
    }
  }
  return values;
}

export const profilesStore = createStore<Profile[]>({
  key: 'nflsw:v1:profiles',
  fallback: () => [newProfile('My league')],
  isValid: (v): v is Profile[] => Array.isArray(v) && v.length > 0 && v.every(isProfile),
  repair: (ps) => ps.map((p) => ({ ...p, values: repairValues(p.values) })),
});

function update(id: string, change: (p: Profile) => Profile) {
  profilesStore.set(profilesStore.get().map((p) => (p.id === id ? change(p) : p)));
}

export function addProfile(name: string): string {
  const p = newProfile(name);
  profilesStore.set([...profilesStore.get(), p]);
  return p.id;
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

export function setValue(id: string, key: Exclude<keyof ScoringValues, 'pointsAllowed'>, value: number) {
  if (!Number.isFinite(value)) return;
  update(id, (p) => ({ ...p, preset: 'custom', values: { ...p.values, [key]: value } }));
}

export function setTier(id: string, index: number, value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(index) || index < 0 || index > 6) return;
  update(id, (p) => ({
    ...p,
    preset: 'custom',
    values: { ...p.values, pointsAllowed: p.values.pointsAllowed.map((v, i) => (i === index ? value : v)) },
  }));
}

export function applyPreset(id: string, preset: PresetId) {
  update(id, (p) => ({ ...p, preset, values: copyValues(PRESETS[preset]) }));
}
