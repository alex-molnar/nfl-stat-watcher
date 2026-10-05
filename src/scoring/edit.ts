import { isHexColor } from './leagueColor';
import { PRESETS, copyValues } from './presets';
import { isValidPointsAllowedBands, type PresetId, type Profile, type ValueKey } from './types';

/**
 * Edits to a profile as pure functions, so the same rules serve the settings page's unsaved working copy and the
 * stored profiles. Each returns the profile it was given when the change is not valid.
 */
export const withName = (p: Profile, name: string): Profile => ({ ...p, name });

export const withColor = (p: Profile, color: string): Profile => (isHexColor(color) ? { ...p, color: color.toLowerCase() } : p);

export const withValue = (p: Profile, key: ValueKey, value: number): Profile =>
  Number.isFinite(value) ? { ...p, preset: 'custom', values: { ...p.values, [key]: value } } : p;

export function withRuleEnabled(p: Profile, key: ValueKey, enabled: boolean): Profile {
  const off = new Set(p.values.off ?? []);
  if (enabled) off.delete(key); else off.add(key);
  const values = { ...p.values };
  if (off.size) values.off = [...off]; else delete values.off;
  return { ...p, preset: 'custom', values };
}

export function withStepPoints(p: Profile, index: number, points: number): Profile {
  const steps = p.values.steps;
  if (!Number.isFinite(points) || !steps || !Number.isInteger(index) || index < 0 || index >= steps.length) return p;
  return { ...p, preset: 'custom', values: { ...p.values, steps: steps.map((rule, i) => (i === index ? { ...rule, points } : rule)) } };
}

export function withTier(p: Profile, index: number, value: number): Profile {
  if (!Number.isFinite(value) || !Number.isInteger(index) || index < 0 || index > 6) return p;
  return { ...p, preset: 'custom', values: { ...p.values, pointsAllowed: p.values.pointsAllowed.map((v, i) => (i === index ? value : v)) } };
}

export function withBand(p: Profile, index: number, key: 'min' | 'max' | 'points', value: number | null): Profile {
  const bands = p.values.pointsAllowedBands;
  if (!bands || !Number.isInteger(index) || index < 0 || index >= bands.length) return p;
  const next = bands.map((band, i) => (i === index ? { ...band, [key]: value } : band));
  return isValidPointsAllowedBands(next) ? { ...p, preset: 'custom', values: { ...p.values, pointsAllowedBands: next } } : p;
}

export function withoutBands(p: Profile): Profile {
  const values = { ...p.values };
  delete values.pointsAllowedBands;
  return { ...p, values };
}

export const withPreset = (p: Profile, preset: PresetId): Profile => ({ ...p, preset, values: copyValues(PRESETS[preset]) });
