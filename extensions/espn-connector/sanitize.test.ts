import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeSettings } from './sanitize';

const fixture = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json', 'utf8')) as Record<string, any>;

describe('sanitizeSettings', () => {
  it('returns only identity, scoring rules and lineup slots', () => {
    const result = sanitizeSettings({ ...fixture, teams: [{ id: 'private' }], members: [{ displayName: 'private' }] }, '1900128084', '2026');
    expect(result.ok).toBe(true);
    expect(Object.keys(result.payload!)).toEqual(['id', 'seasonId', 'settings']);
    expect(Object.keys(result.payload!.settings)).toEqual(['name', 'scoringSettings', 'rosterSettings']);
    expect(result.payload!.settings.scoringSettings.scoringItems).toHaveLength(47);
  });

  it('rejects malformed present override maps instead of treating them as absent', () => {
    const body = structuredClone(fixture);
    body.settings.scoringSettings.scoringItems[0].pointsOverrides = { '16': '10' };
    expect(sanitizeSettings(body, '1900128084', '2026')).toEqual({ ok: false, status: 'malformed' });
  });

  it('rejects a response for another league or season', () => {
    expect(sanitizeSettings(fixture, '9', '2026')).toEqual({ ok: false, status: 'malformed' });
    expect(sanitizeSettings(fixture, '1900128084', '2025')).toEqual({ ok: false, status: 'malformed' });
  });

  it('rejects invalid flags and distance weights', () => {
    const invalidFlag = structuredClone(fixture);
    invalidFlag.settings.scoringSettings.scoringItems[0].isActive = 'yes';
    expect(sanitizeSettings(invalidFlag, '1900128084', '2026').status).toBe('malformed');
    const invalidDistance = structuredClone(fixture);
    invalidDistance.settings.scoringSettings.scoringItems[0].pointsByDistance = { '20': '2' };
    expect(sanitizeSettings(invalidDistance, '1900128084', '2026').status).toBe('malformed');
  });
});
