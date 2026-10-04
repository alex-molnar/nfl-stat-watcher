import type { EspnScoringItem, ImportIssue } from '../types';
import type { StepStat, ValueKey } from '../../scoring/types';

export const ESPN_SCORING_MAP_VERSION = 2;

/** ESPN lineup slot ids a rule applies to. A rule only imports when every slot in its scope agrees. */
export type Scope = 'offense' | 'idp' | 'kicker' | 'dst';

export const SCOPE_POSITIONS: Record<Scope, string[]> = {
  offense: ['0', '1', '2', '3', '4', '5', '6', '7', '23'],
  idp: ['8', '9', '10', '11', '12', '13', '14', '15'],
  kicker: ['17'],
  dst: ['16'],
};

export interface Target {
  key: ValueKey;
  scope: Scope;
  /** Points per unit of 1/N, for rules that ESPN prorates (half sacks). */
  per?: number;
  /** ESPN "every N" rules award whole steps: floor(stat / N) times the points, never a prorated amount. */
  step?: { stat: StepStat; every: number };
}

interface StatRule {
  label: string;
  targets?: Target[];
}

const t = (key: ValueKey, scope: Scope, per?: number): Target => ({ key, scope, ...(per ? { per } : {}) });
const st = (stat: StepStat, scope: Scope, every: number): Target => ({ key: 'passYards', scope, step: { stat, every } });
const every = (stat: StepStat, scope: Scope, units: number[]): Target[][] => units.map((n) => [st(stat, scope, n)]);
const rule = (label: string, ...targets: Target[]): StatRule => ({ label, targets });
const note = (label: string): StatRule => ({ label });

const [py5, py10, py20, py25, py50, py100] = every('passYards', 'offense', [5, 10, 20, 25, 50, 100]);
const [ry5, ry10, ry20, ry25, ry50, ry100] = every('rushYards', 'offense', [5, 10, 20, 25, 50, 100]);
const [rey5, rey10, rey20, rey25, rey50, rey100] = every('recYards', 'offense', [5, 10, 20, 25, 50, 100]);

/**
 * ESPN scoring stat ids, from the community-maintained `cwendt94/espn-api` constants at commit
 * 825ee9a. ESPN publishes no contract. Several ids can score the same site field (for example
 * 3 and 8 are both passing yards), and ESPN adds their awards, so targets accumulate.
 * Touchdown groups, 2-point conversions and points-allowed bands are handled in scoring.ts.
 */
export const ESPN_STAT_MAP: Readonly<Record<number, StatRule>> = {
  0: rule('pass attempts', t('passAttempt', 'offense')),
  1: rule('pass completions', t('passCompletion', 'offense')),
  2: rule('incomplete passes', t('passIncompletion', 'offense')),
  3: rule('passing yards', t('passYards', 'offense')),
  4: rule('passing touchdowns', t('passTd', 'offense')),
  5: rule('every 5 passing yards', ...py5!), 6: rule('every 10 passing yards', ...py10!), 7: rule('every 20 passing yards', ...py20!),
  8: rule('every 25 passing yards', ...py25!), 9: rule('every 50 passing yards', ...py50!), 10: rule('every 100 passing yards', ...py100!),
  11: rule('every 5 pass completions', st('passCompletion', 'offense', 5)), 12: rule('every 10 pass completions', st('passCompletion', 'offense', 10)),
  13: rule('every 5 incomplete passes', st('passIncompletion', 'offense', 5)), 14: rule('every 10 incomplete passes', st('passIncompletion', 'offense', 10)),
  15: rule('40+ yard passing touchdown bonus', t('passTd40', 'offense')),
  16: rule('50+ yard passing touchdown bonus', t('passTd50', 'offense')),
  17: rule('300-399 yard passing game', t('pass300', 'offense')),
  18: rule('400+ yard passing game', t('pass400', 'offense')),
  19: note('passing 2-point conversions'),
  20: rule('interceptions thrown', t('interception', 'offense')),
  23: rule('rush attempts', t('rushAttempt', 'offense')),
  24: rule('rushing yards', t('rushYards', 'offense')),
  25: rule('rushing touchdowns', t('rushTd', 'offense')),
  26: note('rushing 2-point conversions'),
  27: rule('every 5 rushing yards', ...ry5!), 28: rule('every 10 rushing yards', ...ry10!), 29: rule('every 20 rushing yards', ...ry20!),
  30: rule('every 25 rushing yards', ...ry25!), 31: rule('every 50 rushing yards', ...ry50!), 32: rule('every 100 rushing yards', ...ry100!),
  33: rule('every 5 rush attempts', st('rushAttempt', 'offense', 5)), 34: rule('every 10 rush attempts', st('rushAttempt', 'offense', 10)),
  35: rule('40+ yard rushing touchdown bonus', t('rushTd40', 'offense')),
  36: rule('50+ yard rushing touchdown bonus', t('rushTd50', 'offense')),
  37: rule('100-199 yard rushing game', t('rush100', 'offense')),
  38: rule('200+ yard rushing game', t('rush200', 'offense')),
  41: rule('receptions', t('reception', 'offense')),
  42: rule('receiving yards', t('recYards', 'offense')),
  43: rule('receiving touchdowns', t('recTd', 'offense')),
  44: note('receiving 2-point conversions'),
  45: rule('40+ yard receiving touchdown bonus', t('recTd40', 'offense')),
  46: rule('50+ yard receiving touchdown bonus', t('recTd50', 'offense')),
  47: rule('every 5 receiving yards', ...rey5!), 48: rule('every 10 receiving yards', ...rey10!), 49: rule('every 20 receiving yards', ...rey20!),
  50: rule('every 25 receiving yards', ...rey25!), 51: rule('every 50 receiving yards', ...rey50!), 52: rule('every 100 receiving yards', ...rey100!),
  53: rule('receptions', t('reception', 'offense')),
  54: rule('every 5 receptions', st('reception', 'offense', 5)), 55: rule('every 10 receptions', st('reception', 'offense', 10)),
  56: rule('100-199 yard receiving game', t('rec100', 'offense')),
  57: rule('200+ yard receiving game', t('rec200', 'offense')),
  58: rule('receiving targets', t('recTarget', 'offense')),
  62: note('total 2-point conversions'),
  63: rule('fumble recovered for touchdown', t('fumbleRecoveryTd', 'offense')),
  64: rule('times sacked', t('sacked', 'offense')),
  68: rule('total fumbles', t('fumble', 'offense')),
  72: rule('fumbles lost', t('fumbleLost', 'offense')),
  74: rule('50+ yard field goals made', t('fg50to59', 'kicker'), t('fg60plus', 'kicker')),
  76: rule('50+ yard field goals missed', t('fgMissed50to59', 'kicker'), t('fgMissed60plus', 'kicker')),
  77: rule('40-49 yard field goals made', t('fg40to49', 'kicker')),
  79: rule('40-49 yard field goals missed', t('fgMissed40to49', 'kicker')),
  80: rule('0-39 yard field goals made', t('fg0to39', 'kicker')),
  82: rule('0-39 yard field goals missed', t('fgMissed0to39', 'kicker')),
  83: rule('field goals made', t('fg0to39', 'kicker'), t('fg40to49', 'kicker'), t('fg50to59', 'kicker'), t('fg60plus', 'kicker')),
  85: rule('field goals missed', t('fgMissed', 'kicker')),
  86: rule('extra points made', t('xpMade', 'kicker')),
  88: rule('extra points missed', t('xpMissed', 'kicker')),
  93: note('blocked kick returned for touchdown'),
  94: note('defensive touchdowns'),
  95: rule('interceptions', t('idpInterception', 'idp'), t('dstInterception', 'dst')),
  96: rule('fumble recoveries', t('fumbleRecovery', 'idp'), t('dstFumbleRecovery', 'dst')),
  97: rule('blocked kicks', t('blockedKick', 'idp'), t('dstBlockedKick', 'dst')),
  98: rule('safeties', t('safety', 'idp'), t('dstSafety', 'dst')),
  99: rule('sacks', t('sack', 'idp'), t('dstSack', 'dst')),
  100: rule('half sacks', t('sack', 'idp', 0.5), t('dstSack', 'dst', 0.5)),
  101: note('kickoff return touchdowns'),
  102: note('punt return touchdowns'),
  103: note('interception return touchdowns'),
  104: note('fumble return touchdowns'),
  105: note('total return touchdowns'),
  106: rule('forced fumbles', t('forcedFumble', 'idp')),
  107: rule('assisted tackles', t('assistedTackle', 'idp')),
  108: rule('solo tackles', t('soloTackle', 'idp')),
  109: rule('total tackles', t('soloTackle', 'idp'), t('assistedTackle', 'idp')),
  110: rule('every 3 total tackles', st('tackle', 'idp', 3)),
  111: rule('every 5 total tackles', st('tackle', 'idp', 5)),
  112: rule('stuffs', t('tackleForLoss', 'idp')),
  113: rule('passes defended', t('passDefended', 'idp')),
  116: note('every 10 kickoff return yards'),
  117: note('every 25 kickoff return yards'),
  118: note('every 10 punt return yards'),
  119: note('every 25 punt return yards'),
  114: rule('kickoff return yards', t('kickReturnYards', 'offense')),
  115: rule('punt return yards', t('puntReturnYards', 'offense')),
  120: note('points allowed (per point)'),
  127: note('yards allowed (per yard)'),
  128: rule('under 100 yards allowed', t('yardsAllowed0', 'dst')),
  129: rule('100-199 yards allowed', t('yardsAllowed100', 'dst')),
  130: rule('200-299 yards allowed', t('yardsAllowed200', 'dst')),
  131: rule('300-349 yards allowed', t('yardsAllowed300', 'dst')),
  132: rule('350-399 yards allowed', t('yardsAllowed350', 'dst')),
  133: rule('400-449 yards allowed', t('yardsAllowed400', 'dst')),
  134: rule('450-499 yards allowed', t('yardsAllowed450', 'dst')),
  135: rule('500-549 yards allowed', t('yardsAllowed500', 'dst')),
  136: rule('550+ yards allowed', t('yardsAllowed550', 'dst')),
  187: note('D/ST points allowed (per point)'),
  198: rule('50-59 yard field goals made', t('fg50to59', 'kicker')),
  200: rule('50-59 yard field goals missed', t('fgMissed50to59', 'kicker')),
  201: rule('60+ yard field goals made', t('fg60plus', 'kicker')),
  203: rule('60+ yard field goals missed', t('fgMissed60plus', 'kicker')),
  204: rule('offensive 2-point return', t('twoPointReturn', 'dst')),
  205: rule('defensive 2-point return', t('twoPointReturn', 'dst')),
  206: rule('2-point return', t('twoPointReturn', 'dst')),
  207: rule('offensive 1-point safety', t('onePointSafety', 'dst')),
  208: rule('defensive 1-point safety', t('onePointSafety', 'dst')),
  209: rule('1-point safety', t('onePointSafety', 'dst')),
};

/** Stats whose award applies once per touchdown whatever its type; the site has one weight per group. */
export const TOUCHDOWN_GROUPS: ReadonlyArray<{ key: ValueKey; scope: Scope; statIds: number[]; label: string }> = [
  { key: 'dstTd', scope: 'dst', statIds: [93, 94, 101, 102, 103, 104, 105], label: 'defensive and return touchdowns' },
  { key: 'defensiveTd', scope: 'idp', statIds: [93, 94, 103, 104, 105], label: 'defensive touchdowns' },
  { key: 'returnTd', scope: 'offense', statIds: [101, 102], label: 'kick and punt return touchdowns' },
];

export function effectivePoints(item: EspnScoringItem, positionId?: string): number | null {
  if (item.isActive === false || item.isDisabled === true) return null;
  if (positionId !== undefined) {
    const override = item.pointsOverridesByPosition?.[positionId] ?? item.pointsOverrides?.[positionId];
    return override ?? item.points;
  }
  const overrides = { ...item.pointsOverrides, ...item.pointsOverridesByPosition };
  if (Object.values(overrides).some((value) => value !== item.points)) return null;
  return item.points;
}

export function issueForItem(item: EspnScoringItem, reason: string, code: ImportIssue['code'] = 'unrepresentable-rule'): ImportIssue {
  const definition = ESPN_STAT_MAP[item.statId];
  return {
    code,
    providerKeys: [`statId:${item.statId}`],
    message: `${definition?.label ?? `ESPN stat ${item.statId}`}: ${reason}`,
  };
}
