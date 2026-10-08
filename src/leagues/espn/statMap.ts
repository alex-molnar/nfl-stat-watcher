import { en } from '../../i18n/en';
import { i18n } from '../../i18n';
import { fieldLabel } from '../../scoring/fields';
import type { EspnScoringItem, ImportIssue, IssueReason } from '../types';
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
  targets?: Target[];
}

const t = (key: ValueKey, scope: Scope, per?: number): Target => ({ key, scope, ...(per ? { per } : {}) });
const st = (stat: StepStat, scope: Scope, every: number): Target => ({ key: 'passYards', scope, step: { stat, every } });
const every = (stat: StepStat, scope: Scope, units: number[]): Target[][] => units.map((n) => [st(stat, scope, n)]);
const rule = (...targets: Target[]): StatRule => ({ targets });
const note = (): StatRule => ({});

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
  0: rule(t('passAttempt', 'offense')),
  1: rule(t('passCompletion', 'offense')),
  2: rule(t('passIncompletion', 'offense')),
  3: rule(t('passYards', 'offense')),
  4: rule(t('passTd', 'offense')),
  5: rule(...py5!), 6: rule(...py10!), 7: rule(...py20!),
  8: rule(...py25!), 9: rule(...py50!), 10: rule(...py100!),
  11: rule(st('passCompletion', 'offense', 5)), 12: rule(st('passCompletion', 'offense', 10)),
  13: rule(st('passIncompletion', 'offense', 5)), 14: rule(st('passIncompletion', 'offense', 10)),
  15: rule(t('passTd40', 'offense')),
  16: rule(t('passTd50', 'offense')),
  17: rule(t('pass300', 'offense')),
  18: rule(t('pass400', 'offense')),
  19: note(),
  20: rule(t('interception', 'offense')),
  23: rule(t('rushAttempt', 'offense')),
  24: rule(t('rushYards', 'offense')),
  25: rule(t('rushTd', 'offense')),
  26: note(),
  27: rule(...ry5!), 28: rule(...ry10!), 29: rule(...ry20!),
  30: rule(...ry25!), 31: rule(...ry50!), 32: rule(...ry100!),
  33: rule(st('rushAttempt', 'offense', 5)), 34: rule(st('rushAttempt', 'offense', 10)),
  35: rule(t('rushTd40', 'offense')),
  36: rule(t('rushTd50', 'offense')),
  37: rule(t('rush100', 'offense')),
  38: rule(t('rush200', 'offense')),
  41: rule(t('reception', 'offense')),
  42: rule(t('recYards', 'offense')),
  43: rule(t('recTd', 'offense')),
  44: note(),
  45: rule(t('recTd40', 'offense')),
  46: rule(t('recTd50', 'offense')),
  47: rule(...rey5!), 48: rule(...rey10!), 49: rule(...rey20!),
  50: rule(...rey25!), 51: rule(...rey50!), 52: rule(...rey100!),
  53: rule(t('reception', 'offense')),
  54: rule(st('reception', 'offense', 5)), 55: rule(st('reception', 'offense', 10)),
  56: rule(t('rec100', 'offense')),
  57: rule(t('rec200', 'offense')),
  58: rule(t('recTarget', 'offense')),
  62: note(),
  63: rule(t('fumbleRecoveryTd', 'offense')),
  64: rule(t('sacked', 'offense')),
  68: rule(t('fumble', 'offense')),
  72: rule(t('fumbleLost', 'offense')),
  74: rule(t('fg50to59', 'kicker'), t('fg60plus', 'kicker')),
  76: rule(t('fgMissed50to59', 'kicker'), t('fgMissed60plus', 'kicker')),
  77: rule(t('fg40to49', 'kicker')),
  79: rule(t('fgMissed40to49', 'kicker')),
  80: rule(t('fg0to39', 'kicker')),
  82: rule(t('fgMissed0to39', 'kicker')),
  83: rule(t('fg0to39', 'kicker'), t('fg40to49', 'kicker'), t('fg50to59', 'kicker'), t('fg60plus', 'kicker')),
  85: rule(t('fgMissed', 'kicker')),
  86: rule(t('xpMade', 'kicker')),
  88: rule(t('xpMissed', 'kicker')),
  93: note(),
  94: note(),
  95: rule(t('idpInterception', 'idp'), t('dstInterception', 'dst')),
  96: rule(t('fumbleRecovery', 'idp'), t('dstFumbleRecovery', 'dst')),
  97: rule(t('blockedKick', 'idp'), t('dstBlockedKick', 'dst')),
  98: rule(t('safety', 'idp'), t('dstSafety', 'dst')),
  99: rule(t('sack', 'idp'), t('dstSack', 'dst')),
  100: rule(t('sack', 'idp', 0.5), t('dstSack', 'dst', 0.5)),
  101: note(),
  102: note(),
  103: note(),
  104: note(),
  105: note(),
  106: rule(t('forcedFumble', 'idp')),
  107: rule(t('assistedTackle', 'idp')),
  108: rule(t('soloTackle', 'idp')),
  109: rule(t('soloTackle', 'idp'), t('assistedTackle', 'idp')),
  110: rule(st('tackle', 'idp', 3)),
  111: rule(st('tackle', 'idp', 5)),
  112: rule(t('stuff', 'idp')),
  113: rule(t('passDefended', 'idp')),
  116: rule(st('kickReturnYards', 'offense', 10)),
  117: rule(st('kickReturnYards', 'offense', 25)),
  118: rule(st('puntReturnYards', 'offense', 10)),
  119: rule(st('puntReturnYards', 'offense', 25)),
  114: rule(t('kickReturnYards', 'offense')),
  115: rule(t('puntReturnYards', 'offense')),
  120: note(),
  127: note(),
  128: rule(t('yardsAllowed0', 'dst')),
  129: rule(t('yardsAllowed100', 'dst')),
  130: rule(t('yardsAllowed200', 'dst')),
  131: rule(t('yardsAllowed300', 'dst')),
  132: rule(t('yardsAllowed350', 'dst')),
  133: rule(t('yardsAllowed400', 'dst')),
  134: rule(t('yardsAllowed450', 'dst')),
  135: rule(t('yardsAllowed500', 'dst')),
  136: rule(t('yardsAllowed550', 'dst')),
  187: note(),
  198: rule(t('fg50to59', 'kicker')),
  200: rule(t('fgMissed50to59', 'kicker')),
  201: rule(t('fg60plus', 'kicker')),
  203: rule(t('fgMissed60plus', 'kicker')),
  204: rule(t('twoPointReturn', 'dst')),
  205: rule(t('twoPointReturn', 'dst')),
  206: rule(t('twoPointReturn', 'dst')),
  207: rule(t('onePointSafety', 'dst')),
  208: rule(t('onePointSafety', 'dst')),
  209: rule(t('onePointSafety', 'dst')),
};

/** Stats whose award applies once per touchdown whatever its type; the site has one weight per group. */
export const TOUCHDOWN_GROUPS: ReadonlyArray<{ key: 'dstTd' | 'defensiveTd' | 'returnTd'; scope: Scope; statIds: number[] }> = [
  { key: 'dstTd', scope: 'dst', statIds: [93, 94, 101, 102, 103, 104, 105] },
  { key: 'defensiveTd', scope: 'idp', statIds: [93, 94, 103, 104, 105] },
  { key: 'returnTd', scope: 'offense', statIds: [101, 102] },
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

/** What the site calls an ESPN stat id (our own wording, not ESPN's), in the page's language or the given one. */
export function statLabel(statId: number, lng?: string): string {
  if (!ESPN_STAT_MAP[statId]) return i18n.t(($) => $.leagues.unknownStat, { id: statId, lng });
  return i18n.t(($) => ($.leagues.espnStats as Record<number, string>)[statId], { lng });
}

/**
 * An issue's text in the page's language (or `lng`). An issue saves its reason, not words, so it reads in the language of
 * whoever looks at it; one saved before reasons existed has only its English `message`.
 */
export function issueText(issue: ImportIssue, lng?: string): string {
  const reason = issue.reason;
  if (!reason || !Object.hasOwn(en.leagues.issues, reason.key)) return issue.message;
  const group = reason.group;
  const lower = reason.key === 'playText'; // the approximate stats are listed in the middle of a sentence
  return i18n.t(($) => $.leagues.issues[reason.key], {
    lng,
    label: reason.statId === undefined ? undefined : statLabel(reason.statId, lng),
    group: group ? i18n.t(($) => $.leagues.touchdownGroups[group], { lng }) : undefined,
    stats: reason.stats?.map((key) => (lower ? fieldLabel(key, lng).toLowerCase() : fieldLabel(key, lng))).join(', '),
  });
}

/** A new issue. Its `message` is the English text, so tests, older readers and a saved profile always have words. */
export function newIssue(code: ImportIssue['code'], providerKeys: string[], reason: IssueReason): ImportIssue {
  const issue: ImportIssue = { code, providerKeys, message: '', reason };
  issue.message = issueText(issue, 'en');
  return issue;
}

export function issueForItem(item: EspnScoringItem, reason: IssueReason['key'], code: ImportIssue['code'] = 'unrepresentable-rule', extra: Pick<IssueReason, 'group'> = {}): ImportIssue {
  return newIssue(code, [`statId:${item.statId}`], { key: reason, statId: item.statId, ...extra });
}
