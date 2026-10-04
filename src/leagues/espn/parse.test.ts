import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEspnLeagueInput, parseEspnLeagueSettings, parseEspnSettingsFile } from './parse';

const fixture = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-settings-1900128084-2026.json', 'utf8')) as unknown;

describe('parseEspnLeagueSettings', () => {
  it('validates identity and keeps only the scoring and lineup allowlist', () => {
    const parsed = parseEspnLeagueSettings(fixture, '1900128084', '2026');
    expect(parsed.scoringItems).toHaveLength(47);
    expect(parsed.rawSettings.rosterSettings.lineupSlotCounts['16']).toBe(1);
    const allowedKeys = new Set(['scoringSettings', 'scoringItems', 'statId', 'points', 'pointsOverrides', 'pointsOverridesByPosition', 'isActive', 'isDisabled', 'scoringPeriodId', 'statOffset', 'statPeriodId', 'pointsByDistance', 'rosterSettings', 'lineupSlotCounts']);
    const numericMaps = new Set(['pointsOverrides', 'pointsOverridesByPosition', 'pointsByDistance', 'lineupSlotCounts']);
    const visit = (value: unknown, dynamicKeys = false) => {
      if (Array.isArray(value)) return value.forEach((child) => visit(child));
      if (typeof value !== 'object' || value === null) return;
      for (const [key, child] of Object.entries(value)) {
        if (!dynamicKeys && !allowedKeys.has(key)) throw new Error(`unexpected raw settings key: ${key}`);
        visit(child, numericMaps.has(key));
      }
    };
    visit(parsed.rawSettings);
  });

  it('preserves explicit zero bases, negative weights and position overrides', () => {
    const parsed = parseEspnLeagueSettings(fixture);
    const item = parsed.scoringItems.find((candidate) => candidate.statId === 123)!;
    expect(item.points).toBe(0);
    expect(item.pointsOverrides).toEqual({ '16': -1 });
    expect(parsed.scoringItems.find((candidate) => candidate.statId === 20)?.points).toBe(-2);
  });

  it('rejects a response for another league or season', () => {
    expect(() => parseEspnLeagueSettings(fixture, '9', '2026')).toThrow(/different league/);
    expect(() => parseEspnLeagueSettings(fixture, '1900128084', '2025')).toThrow(/different season/);
  });

  it('rejects non-finite weights and malformed overrides', () => {
    const malformed = structuredClone(fixture) as { settings: { scoringSettings: { scoringItems: { points: number }[] } } };
    malformed.settings.scoringSettings.scoringItems[0]!.points = Number.NaN;
    expect(() => parseEspnLeagueSettings(malformed)).toThrow(/invalid points/);
    const malformedOverride = structuredClone(fixture) as { settings: { scoringSettings: { scoringItems: { pointsOverrides: unknown }[] } } };
    malformedOverride.settings.scoringSettings.scoringItems[0]!.pointsOverrides = { '16': '3' };
    expect(() => parseEspnLeagueSettings(malformedOverride)).toThrow(/pointsOverrides/);
  });
});

describe('parseEspnLeagueInput', () => {
  it('accepts numeric IDs and ESPN league links', () => {
    expect(parseEspnLeagueInput('1900128084')).toEqual({ leagueId: '1900128084' });
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=1900128084&seasonId=2026'))
      .toEqual({ leagueId: '1900128084', season: '2026' });
    expect(parseEspnLeagueInput('https://www.espn.com/fantasy/football/league?leagueId=409479118'))
      .toEqual({ leagueId: '409479118' });
  });

  it('rejects wrong hosts, schemes and non-football pages', () => {
    expect(() => parseEspnLeagueInput('https://espn.example/football?leagueId=1')).toThrow(/not an ESPN/);
    expect(() => parseEspnLeagueInput('http://fantasy.espn.com/football?leagueId=1')).toThrow(/not an ESPN/);
    expect(() => parseEspnLeagueInput('https://fantasy.espn.com/baseball?leagueId=1')).toThrow(/not an ESPN/);
  });
});

describe('parseEspnSettingsFile', () => {
  it('requires a versioned envelope and reuses the API validator', () => {
    const file = JSON.stringify({ schemaVersion: 1, provider: 'espn', leagueId: '1900128084', season: '2026', settings: fixture });
    expect(parseEspnSettingsFile(file).transport).toBe('settings-file');
    expect(() => parseEspnSettingsFile(JSON.stringify({ schemaVersion: 2, provider: 'espn' }))).toThrow(/unsupported envelope/);
    expect(() => parseEspnSettingsFile('x'.repeat(1_000_001))).toThrow(/1 MB/);
  });
});
