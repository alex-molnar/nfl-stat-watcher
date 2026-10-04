/** Every flat per-stat weight. Order is irrelevant; grouping and labels live in fields.ts. */
export const VALUE_KEYS = [
  'passAttempt', 'passCompletion', 'passIncompletion', 'passYards', 'passTd', 'passTd40', 'passTd50', 'pass300', 'pass400', 'interception', 'sacked',
  'rushAttempt', 'rushYards', 'rushTd', 'rushTd40', 'rushTd50', 'rush100', 'rush200',
  'recTarget', 'reception', 'recYards', 'recTd', 'recTd40', 'recTd50', 'rec100', 'rec200',
  'twoPoint', 'fumble', 'fumbleLost', 'fumbleRecoveryTd', 'returnTd', 'kickReturnYards', 'puntReturnYards',
  'fg0to39', 'fg40to49', 'fg50to59', 'fg60plus', 'fgMissed', 'fgMissed0to39', 'fgMissed40to49', 'fgMissed50to59', 'fgMissed60plus', 'xpMade', 'xpMissed',
  'soloTackle', 'assistedTackle', 'sack', 'tackleForLoss', 'qbHit', 'passDefended', 'idpInterception', 'fumbleRecovery', 'forcedFumble', 'defensiveTd', 'safety', 'blockedKick',
  'dstSack', 'dstInterception', 'dstFumbleRecovery', 'dstSafety', 'dstTd', 'dstBlockedKick', 'twoPointReturn', 'onePointSafety',
  'yardsAllowed0', 'yardsAllowed100', 'yardsAllowed200', 'yardsAllowed300', 'yardsAllowed350', 'yardsAllowed400', 'yardsAllowed450', 'yardsAllowed500', 'yardsAllowed550',
] as const;

export type ValueKey = (typeof VALUE_KEYS)[number];

export type ScoringValues = Record<ValueKey, number> & {
  pointsAllowed: number[]; // 7 tiers, see POINTS_ALLOWED_TIERS
  pointsAllowedBands?: PointsAllowedBand[];
  /** Rules switched off for this profile. Their weight is kept so switching one back on restores it. */
  off?: ValueKey[];
};

export interface PointsAllowedBand {
  min: number;
  max: number | null;
  points: number;
}

export type PresetId = 'standard' | 'half' | 'ppr';

export interface Profile {
  id: string;
  name: string;
  preset: PresetId | 'custom';
  values: ScoringValues;
  source?: import('../leagues/types').LeagueSource;
}

export interface ScoreLine { label: string; points: number }
export interface ScoreResult { total: number; breakdown: ScoreLine[] }

export const POINTS_ALLOWED_TIERS = ['0', '1-6', '7-13', '14-20', '21-27', '28-34', '35+'] as const;

export function isValidPointsAllowedBands(value: unknown): value is PointsAllowedBand[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return false;
  let expectedMin = 0;
  for (let index = 0; index < value.length; index += 1) {
    const band = value[index] as Partial<PointsAllowedBand> | null;
    if (!band || !Number.isInteger(band.min) || band.min !== expectedMin || band.min < 0
      || (band.max !== null && (typeof band.max !== 'number' || !Number.isInteger(band.max) || band.max < band.min))
      || typeof band.points !== 'number' || !Number.isFinite(band.points)) return false;
    if (index === value.length - 1) {
      if (band.max !== null) return false;
    } else {
      if (band.max === null) return false;
      expectedMin = band.max + 1;
    }
  }
  return true;
}

export function isValidScoringValues(value: unknown): value is ScoringValues {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  // Fields added after profiles were first saved are optional so older snapshots stay valid; repair fills them.
  const legacy: readonly string[] = ['passYards', 'passTd', 'interception', 'rushYards', 'rushTd', 'reception', 'recYards', 'recTd', 'twoPoint', 'fumbleLost', 'returnTd',
    'fg0to39', 'fg40to49', 'fgMissed', 'xpMade', 'xpMissed', 'soloTackle', 'assistedTackle', 'sack', 'tackleForLoss', 'qbHit', 'passDefended', 'idpInterception',
    'fumbleRecovery', 'defensiveTd', 'safety', 'dstSack', 'dstInterception', 'dstFumbleRecovery', 'dstSafety', 'dstTd'];
  const numericFields = VALUE_KEYS.filter((key) => legacy.includes(key));
  if (VALUE_KEYS.some((key) => input[key] !== undefined && (typeof input[key] !== 'number' || !Number.isFinite(input[key])))) return false;
  if (input.off !== undefined && (!Array.isArray(input.off) || !input.off.every((key) => (VALUE_KEYS as readonly unknown[]).includes(key)))) return false;
  if (numericFields.some((key) => typeof input[key] !== 'number' || !Number.isFinite(input[key]))) return false;
  if (!Array.isArray(input.pointsAllowed) || input.pointsAllowed.length !== 7
    || !input.pointsAllowed.every((points) => typeof points === 'number' && Number.isFinite(points))) return false;
  return input.pointsAllowedBands === undefined || isValidPointsAllowedBands(input.pointsAllowedBands);
}
