import { isValidScoringValues, type Profile, type ScoringValues } from '../scoring/types';

export interface EspnScoringItem {
  statId: number;
  points: number;
  pointsOverrides: Record<string, number> | null;
  pointsOverridesByPosition: Record<string, number> | null;
  isActive: boolean | null;
  isDisabled: boolean | null;
  scoringPeriodId: number | null;
  statOffset: number | null;
  statPeriodId: number | null;
  pointsByDistance: Record<string, number> | null;
}

export interface EspnLeagueSettings {
  leagueId: string;
  season: string;
  name: string;
  scoringItems: EspnScoringItem[];
  lineupSlotCounts: Record<string, number>;
  rawSettings: {
    scoringSettings: { scoringItems: EspnScoringItem[] };
    rosterSettings: { lineupSlotCounts: Record<string, number> };
  };
  transport: 'public-api' | 'browser-session' | 'settings-file';
}

export type ImportIssueCode = 'unknown-rule' | 'unrepresentable-rule' | 'stat-limitation';

export interface ImportIssue {
  code: ImportIssueCode;
  providerKeys: string[];
  message: string;
}

export interface LeagueSource {
  provider: 'espn';
  leagueId: string;
  season: string;
  transport: EspnLeagueSettings['transport'];
  importedAt: string;
  mappingVersion: number;
  rawSettings: EspnLeagueSettings['rawSettings'];
  baselineValues: ScoringValues;
  lineupSlotCounts: Record<string, number>;
  issues: ImportIssue[];
  /** The user's fantasy team in this league, chosen when importing starters. */
  teamId?: string;
  /** Whether syncing starters also removes followed players who are not starters; remembered per league. */
  removeNonStarters?: boolean;
}

export interface LeagueImportDraft {
  source: LeagueSource;
  name: string;
  values: ScoringValues;
}

export interface EspnSettingsFile {
  schemaVersion: 1;
  provider: 'espn';
  leagueId: string;
  season: string;
  settings: unknown;
}

export interface LeagueImportResult {
  importedIds: string[];
  persisted: boolean;
}

export function isLeagueSource(value: unknown): value is LeagueSource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Partial<LeagueSource>;
  return source.provider === 'espn'
    && typeof source.leagueId === 'string'
    && /^\d{1,20}$/.test(source.leagueId)
    && typeof source.season === 'string'
    && /^\d{4}$/.test(source.season)
    && ['public-api', 'browser-session', 'settings-file'].includes(source.transport ?? '')
    && typeof source.importedAt === 'string'
    && Number.isFinite(Date.parse(source.importedAt))
    && Number.isInteger(source.mappingVersion)
    && validRawSettings(source.rawSettings)
    && validLineupSlots(source.lineupSlotCounts)
    && (source.teamId === undefined || (typeof source.teamId === 'string' && /^\d{1,4}$/.test(source.teamId)))
    && (source.removeNonStarters === undefined || typeof source.removeNonStarters === 'boolean')
    && Array.isArray(source.issues)
    && source.issues.length <= 500
    && source.issues.every((issue) => validImportIssue(issue))
    && isValidScoringValues(source.baselineValues);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validLineupSlots(value: unknown): value is Record<string, number> {
  const slots = isRecord(value) ? value : null;
  if (!slots || Object.keys(slots).length > 100) return false;
  return Object.entries(slots).every(([key, count]) => /^\d{1,4}$/.test(key) && typeof count === 'number' && Number.isInteger(count) && count >= 0);
}

function validNumericMap(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length > 100) return false;
  return Object.entries(value).every(([key, points]) => /^\d{1,4}$/.test(key) && typeof points === 'number' && Number.isFinite(points));
}

function validScoringItem(item: unknown): boolean {
  if (!isRecord(item)) return false;
  const allowed = new Set(['statId', 'points', 'pointsOverrides', 'pointsOverridesByPosition', 'isActive', 'isDisabled', 'scoringPeriodId', 'statOffset', 'statPeriodId', 'pointsByDistance']);
  return Object.keys(item).every((key) => allowed.has(key))
    && typeof item.statId === 'number' && Number.isInteger(item.statId) && item.statId >= 0
    && typeof item.points === 'number' && Number.isFinite(item.points)
    && validNumericMap(item.pointsOverrides)
    && validNumericMap(item.pointsOverridesByPosition)
    && validNumericMap(item.pointsByDistance)
    && (item.isActive === null || typeof item.isActive === 'boolean')
    && (item.isDisabled === null || typeof item.isDisabled === 'boolean')
    && (item.scoringPeriodId === null || (typeof item.scoringPeriodId === 'number' && Number.isFinite(item.scoringPeriodId)))
    && (item.statOffset === null || (typeof item.statOffset === 'number' && Number.isFinite(item.statOffset)))
    && (item.statPeriodId === null || (typeof item.statPeriodId === 'number' && Number.isFinite(item.statPeriodId)));
}

function validRawSettings(value: unknown): value is LeagueSource['rawSettings'] {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !['scoringSettings', 'rosterSettings'].includes(key))) return false;
  const scoringSettings = isRecord(value.scoringSettings) ? value.scoringSettings : null;
  const rosterSettings = isRecord(value.rosterSettings) ? value.rosterSettings : null;
  if (!scoringSettings || Object.keys(scoringSettings).some((key) => key !== 'scoringItems')) return false;
  if (!rosterSettings || Object.keys(rosterSettings).some((key) => key !== 'lineupSlotCounts')) return false;
  const scoring = scoringSettings.scoringItems;
  const roster = rosterSettings.lineupSlotCounts;
  return Array.isArray(scoring) && scoring.length <= 300
    && scoring.every(validScoringItem)
    && validLineupSlots(roster);
}

function validImportIssue(value: unknown): value is ImportIssue {
  if (!isRecord(value)) return false;
  return ['unknown-rule', 'unrepresentable-rule', 'stat-limitation'].includes(String(value.code))
    && Array.isArray(value.providerKeys) && value.providerKeys.length <= 100
    && value.providerKeys.every((key) => typeof key === 'string' && key.length <= 100)
    && typeof value.message === 'string' && value.message.length <= 1_000;
}

export type ImportedProfile = Profile & { source: LeagueSource };
