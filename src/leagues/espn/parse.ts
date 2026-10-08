import { i18n } from '../../i18n';
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

function numericMap(value: unknown, n: number, field: string): Record<string, number> | null {
  if (value == null) return null;
  const input = record(value);
  if (!input || Object.keys(input).length > MAX_LINEUP_SLOTS) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemMap, { n, field }));
  const out: Record<string, number> = {};
  for (const [key, points] of Object.entries(input)) {
    if (!/^\d{1,4}$/.test(key) || typeof points !== 'number' || !Number.isFinite(points)) {
      throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemMapInvalid, { n, field }));
    }
    out[key] = points;
  }
  return out;
}

function optionalNumber(value: unknown, n: number, field: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemFinite, { n, field }));
  return value;
}

function parseScoringItem(value: unknown, index: number): EspnScoringItem {
  const item = record(value);
  if (!item || !Number.isInteger(item.statId) || (item.statId as number) < 0) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemStatId, { n: index + 1 }));
  if (typeof item.points !== 'number' || !Number.isFinite(item.points)) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemPoints, { n: index + 1 }));
  if (item.isActive != null && typeof item.isActive !== 'boolean') throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemActive, { n: index + 1 }));
  if (item.isDisabled != null && typeof item.isDisabled !== 'boolean') throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.itemDisabled, { n: index + 1 }));
  return {
    statId: item.statId as number,
    points: item.points,
    pointsOverrides: numericMap(item.pointsOverrides, index + 1, 'pointsOverrides'),
    pointsOverridesByPosition: numericMap(item.pointsOverridesByPosition, index + 1, 'pointsOverridesByPosition'),
    isActive: item.isActive as boolean | null ?? null,
    isDisabled: item.isDisabled as boolean | null ?? null,
    scoringPeriodId: optionalNumber(item.scoringPeriodId, index + 1, 'scoringPeriodId'),
    statOffset: optionalNumber(item.statOffset, index + 1, 'statOffset'),
    statPeriodId: optionalNumber(item.statPeriodId, index + 1, 'statPeriodId'),
    pointsByDistance: numericMap(item.pointsByDistance, index + 1, 'pointsByDistance'),
  };
}

function canonicalIdentity(value: string | number, pattern: RegExp, invalid: () => string): string {
  const result = String(value);
  if (!pattern.test(result)) throw new EspnSettingsError(invalid());
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
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.missingSettings));
  }

  const leagueId = canonicalIdentity(root.id as string | number, /^\d{1,20}$/, () => i18n.t(($) => $.leagues.errors.espn.invalidLeagueId));
  const season = canonicalIdentity(root.seasonId as string | number, /^\d{4}$/, () => i18n.t(($) => $.leagues.errors.espn.invalidSeason));
  if (expectedLeagueId && leagueId !== expectedLeagueId) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.differentLeague));
  if (expectedSeason && season !== expectedSeason) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.differentSeason));
  if (Object.keys(slots).length > MAX_LINEUP_SLOTS) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.tooManySlots));

  const lineupSlotCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(slots)) {
    if (!/^\d{1,4}$/.test(key) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.invalidSlot));
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
    name: typeof settings?.name === 'string' && settings.name.trim() ? settings.name.trim().slice(0, 120) : i18n.t(($) => $.leagues.errors.espn.defaultName, { leagueId }),
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
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.pasteId));
  }
  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(['fantasy.espn.com', 'www.espn.com', 'espn.com', 'games.espn.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(host) || !/football/i.test(url.pathname)) {
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.notFootballLink));
  }
  const queryId = url.searchParams.get('leagueId') ?? url.searchParams.get('leagueid');
  const pathId = url.pathname.match(/\/leagues?\/(\d{1,20})(?:\/|$)/i)?.[1];
  const leagueId = queryId ?? pathId;
  if (!leagueId || !/^\d{1,20}$/.test(leagueId)) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.noLeagueId));
  const season = url.searchParams.get('seasonId') ?? url.searchParams.get('seasonid') ?? undefined;
  if (season && !/^\d{4}$/.test(season)) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.badSeason));
  return { leagueId, season };
}

export function parseEspnSettingsFile(text: string): EspnLeagueSettings {
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BYTES) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.fileTooLarge));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.fileNotJson));
  }
  const envelope = record(parsed) as Partial<EspnSettingsFile> | null;
  if (envelope?.schemaVersion !== 1 || envelope.provider !== 'espn' || typeof envelope.leagueId !== 'string' || typeof envelope.season !== 'string') {
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.fileEnvelope));
  }
  return parseEspnLeagueSettings(envelope.settings, envelope.leagueId, envelope.season, 'settings-file');
}

/** Settings copied from ESPN's own settings page by a signed-in user: the raw `mSettings` response. */
export function parsePastedEspnSettings(text: string, leagueId: string, season: string): EspnLeagueSettings {
  if (new TextEncoder().encode(text).byteLength > MAX_SETTINGS_BYTES) throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.pastedTooLarge));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new EspnSettingsError(i18n.t(($) => $.leagues.errors.espn.pastedNotJson));
  }
  return parseEspnLeagueSettings(parsed, leagueId, season, 'settings-file');
}
