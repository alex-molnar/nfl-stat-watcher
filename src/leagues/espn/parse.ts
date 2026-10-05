import type { EspnLeagueSettings, EspnScoringItem, EspnSettingsFile } from '../types';

const MAX_SETTINGS_BYTES = 1_000_000;
const MAX_SCORING_ITEMS = 300;
const MAX_LINEUP_SLOTS = 100;

export class EspnSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EspnSettingsError';
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numericMap(value: unknown, label: string): Record<string, number> | null {
  if (value == null) return null;
  const input = record(value);
  if (!input || Object.keys(input).length > MAX_LINEUP_SLOTS) throw new EspnSettingsError(`${label} must be an object of numeric values`);
  const out: Record<string, number> = {};
  for (const [key, points] of Object.entries(input)) {
    if (!/^\d{1,4}$/.test(key) || typeof points !== 'number' || !Number.isFinite(points)) {
      throw new EspnSettingsError(`${label} contains an invalid key or value`);
    }
    out[key] = points;
  }
  return out;
}

function optionalNumber(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new EspnSettingsError(`${label} must be finite`);
  return value;
}

function parseScoringItem(value: unknown, index: number): EspnScoringItem {
  const item = record(value);
  if (!item || !Number.isInteger(item.statId) || (item.statId as number) < 0) throw new EspnSettingsError(`Scoring item ${index + 1} has an invalid statId`);
  if (typeof item.points !== 'number' || !Number.isFinite(item.points)) throw new EspnSettingsError(`Scoring item ${index + 1} has invalid points`);
  if (item.isActive != null && typeof item.isActive !== 'boolean') throw new EspnSettingsError(`Scoring item ${index + 1} has invalid isActive`);
  if (item.isDisabled != null && typeof item.isDisabled !== 'boolean') throw new EspnSettingsError(`Scoring item ${index + 1} has invalid isDisabled`);
  return {
    statId: item.statId as number,
    points: item.points,
    pointsOverrides: numericMap(item.pointsOverrides, `Scoring item ${index + 1} pointsOverrides`),
    pointsOverridesByPosition: numericMap(item.pointsOverridesByPosition, `Scoring item ${index + 1} pointsOverridesByPosition`),
    isActive: item.isActive as boolean | null ?? null,
    isDisabled: item.isDisabled as boolean | null ?? null,
    scoringPeriodId: optionalNumber(item.scoringPeriodId, `Scoring item ${index + 1} scoringPeriodId`),
    statOffset: optionalNumber(item.statOffset, `Scoring item ${index + 1} statOffset`),
    statPeriodId: optionalNumber(item.statPeriodId, `Scoring item ${index + 1} statPeriodId`),
    pointsByDistance: numericMap(item.pointsByDistance, `Scoring item ${index + 1} pointsByDistance`),
  };
}

function canonicalIdentity(value: string | number, label: string, pattern: RegExp): string {
  const result = String(value);
  if (!pattern.test(result)) throw new EspnSettingsError(`Invalid ${label}`);
  return result;
}

export function parseEspnLeagueSettings(
  value: unknown,
  expectedLeagueId?: string,
  expectedSeason?: string,
  transport: EspnLeagueSettings['transport'] = 'public-api',
): EspnLeagueSettings {
  const root = record(value);
  const settings = record(root?.settings);
  const scoringSettings = record(settings?.scoringSettings);
  const rosterSettings = record(settings?.rosterSettings);
  const rawItems = scoringSettings?.scoringItems;
  const slots = record(rosterSettings?.lineupSlotCounts);
  if (!root || !Array.isArray(rawItems) || rawItems.length > MAX_SCORING_ITEMS || !slots) {
    throw new EspnSettingsError('The ESPN response is missing scoring or lineup settings');
  }

  const leagueId = canonicalIdentity(root.id as string | number, 'league ID', /^\d{1,20}$/);
  const season = canonicalIdentity(root.seasonId as string | number, 'season', /^\d{4}$/);
  if (expectedLeagueId && leagueId !== expectedLeagueId) throw new EspnSettingsError('ESPN returned settings for a different league');
  if (expectedSeason && season !== expectedSeason) throw new EspnSettingsError('ESPN returned settings for a different season');
  if (Object.keys(slots).length > MAX_LINEUP_SLOTS) throw new EspnSettingsError('The lineup contains too many slot types');

  const lineupSlotCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(slots)) {
    if (!/^\d{1,4}$/.test(key) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new EspnSettingsError('The lineup contains an invalid slot count');
    }
    lineupSlotCounts[key] = count;
  }
  const scoringItems = rawItems.map(parseScoringItem);
  const safeSettings = {
    scoringSettings: { scoringItems },
    rosterSettings: { lineupSlotCounts },
  };
  return {
    leagueId,
    season,
    name: typeof settings?.name === 'string' && settings.name.trim() ? settings.name.trim().slice(0, 120) : `ESPN league ${leagueId}`,
    scoringItems,
    lineupSlotCounts,
    rawSettings: safeSettings,
    transport,
  };
}

export function parseEspnLeagueInput(input: string): { leagueId: string; season?: string } {
  const value = input.trim();
  if (/^\d{1,20}$/.test(value)) return { leagueId: value };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EspnSettingsError('Paste a decimal league ID or an ESPN fantasy football link');
  }
  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(['fantasy.espn.com', 'www.espn.com', 'espn.com', 'games.espn.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(host) || !/football/i.test(url.pathname)) {
    throw new EspnSettingsError('That is not an ESPN fantasy football link');
  }
  const queryId = url.searchParams.get('leagueId') ?? url.searchParams.get('leagueid');
  const pathId = url.pathname.match(/\/leagues?\/(\d{1,20})(?:\/|$)/i)?.[1];
  const leagueId = queryId ?? pathId;
  if (!leagueId || !/^\d{1,20}$/.test(leagueId)) throw new EspnSettingsError('The ESPN link does not include a decimal league ID');
  const season = url.searchParams.get('seasonId') ?? url.searchParams.get('seasonid') ?? undefined;
  if (season && !/^\d{4}$/.test(season)) throw new EspnSettingsError('The ESPN link includes an invalid season');
  return { leagueId, season };
}

export function parseEspnSettingsFile(text: string): EspnLeagueSettings {
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BYTES) throw new EspnSettingsError('The settings file exceeds 1 MB');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EspnSettingsError('The settings file is not valid JSON');
  }
  const envelope = record(parsed) as Partial<EspnSettingsFile> | null;
  if (envelope?.schemaVersion !== 1 || envelope.provider !== 'espn' || typeof envelope.leagueId !== 'string' || typeof envelope.season !== 'string') {
    throw new EspnSettingsError('The settings file has an unsupported envelope');
  }
  return parseEspnLeagueSettings(envelope.settings, envelope.leagueId, envelope.season, 'settings-file');
}

/** Settings copied from ESPN's own settings page by a signed-in user: the raw `mSettings` response. */
export function parsePastedEspnSettings(text: string, leagueId: string, season: string): EspnLeagueSettings {
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BYTES) throw new EspnSettingsError('The pasted settings exceed 1 MB. Copy only the ESPN settings page.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EspnSettingsError('That is not valid JSON. Open the settings link, select everything on the page and copy it again.');
  }
  return parseEspnLeagueSettings(parsed, leagueId, season, 'settings-file');
}
