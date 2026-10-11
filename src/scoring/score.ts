import type { DefenseStats, GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import type { Messages } from '../i18n/messages';
import type { ScoreKey, ScoreLine, ScoreResult, ScoringValues, StepStat, ValueKey } from './types';
import type { PlayerStats as Stats } from '../stats/types';
import { i18n } from '../i18n';
import { stepLabel } from './fields';

const L = (key: keyof Messages['leagues']['score'], params?: Record<string, string | number | undefined>): string => i18n.t(($) => $.leagues.score[key], params);

const round2 = (n: number) => Math.round(n * 100) / 100;

function collect(fill: (add: (label: string, points: number, key: ScoreKey) => void) => void): ScoreResult {
  const breakdown: ScoreLine[] = [];
  const byRule: Partial<Record<ScoreKey, number>> = {};
  fill((label, points, key) => {
    if (points === 0) return;
    breakdown.push({ label, points: round2(points) });
    byRule[key] = round2((byRule[key] ?? 0) + points);
  });
  return { total: round2(breakdown.reduce((sum, l) => sum + l.points, 0)), breakdown, byRule };
}

/** Switched-off rules score nothing; their stored weight is untouched. */
export function applied(v: ScoringValues): ScoringValues {
  if (!v.off?.length) return v;
  const next = { ...v };
  for (const key of v.off) next[key as ValueKey] = 0;
  return next;
}

function statFor(s: Stats, stat: StepStat): number | undefined {
  switch (stat) {
    case 'passYards': return s.passing?.yards;
    case 'passAttempt': return s.passing?.attempts;
    case 'passCompletion': return s.passing?.completions;
    case 'passIncompletion': return s.passing ? Math.max(0, s.passing.attempts - s.passing.completions) : undefined;
    case 'rushYards': return s.rushing?.yards;
    case 'rushAttempt': return s.rushing?.attempts;
    case 'recYards': return s.receiving?.yards;
    case 'reception': return s.receiving?.receptions;
    case 'tackle': return s.defense?.totalTackles;
    case 'kickReturnYards': return s.returns?.kickYards;
    case 'puntReturnYards': return s.returns?.puntYards;
  }
}

const atLeast = (list: number[] | undefined, min: number) => (list ?? []).filter((yards) => yards >= min).length;

export function tierIndex(pointsAllowed: number): number {
  const upper = [0, 6, 13, 20, 27, 34];
  const i = upper.findIndex((max) => pointsAllowed <= max);
  return i === -1 ? 6 : i;
}

export function scorePlayer(s: PlayerStats, values: ScoringValues): ScoreResult {
  const v = applied(values);
  return collect((add) => {
    if (s.passing) {
      add(L('passAttempts'), s.passing.attempts * v.passAttempt, 'passAttempt');
      add(L('passCompletions'), s.passing.completions * v.passCompletion, 'passCompletion');
      add(L('incompletePasses'), Math.max(0, s.passing.attempts - s.passing.completions) * v.passIncompletion, 'passIncompletion');
      add(L('passingYards'), s.passing.yards * v.passYards, 'passYards');
      add(L('passingTds'), s.passing.touchdowns * v.passTd, 'passTd');
      add(L('passTd40'), atLeast(s.tdYards?.pass, 40) * v.passTd40, 'passTd40');
      add(L('passTd50'), atLeast(s.tdYards?.pass, 50) * v.passTd50, 'passTd50');
      add(L('pass300'), s.passing.yards >= 300 && s.passing.yards < 400 ? v.pass300 : 0, 'pass300');
      add(L('pass400'), s.passing.yards >= 400 ? v.pass400 : 0, 'pass400');
      add(L('interceptionsThrown'), s.passing.interceptions * v.interception, 'interception');
      add(L('timesSacked'), (s.passing.sacked ?? 0) * v.sacked, 'sacked');
    }
    if (s.rushing) {
      add(L('rushAttempts'), s.rushing.attempts * v.rushAttempt, 'rushAttempt');
      add(L('rushingYards'), s.rushing.yards * v.rushYards, 'rushYards');
      add(L('rushingTds'), s.rushing.touchdowns * v.rushTd, 'rushTd');
      add(L('rushTd40'), atLeast(s.tdYards?.rush, 40) * v.rushTd40, 'rushTd40');
      add(L('rushTd50'), atLeast(s.tdYards?.rush, 50) * v.rushTd50, 'rushTd50');
      add(L('rush100'), s.rushing.yards >= 100 && s.rushing.yards < 200 ? v.rush100 : 0, 'rush100');
      add(L('rush200'), s.rushing.yards >= 200 ? v.rush200 : 0, 'rush200');
    }
    if (s.receiving) {
      add(L('targets'), s.receiving.targets * v.recTarget, 'recTarget');
      add(L('receptions'), s.receiving.receptions * v.reception, 'reception');
      add(L('receivingYards'), s.receiving.yards * v.recYards, 'recYards');
      add(L('receivingTds'), s.receiving.touchdowns * v.recTd, 'recTd');
      add(L('recTd40'), atLeast(s.tdYards?.rec, 40) * v.recTd40, 'recTd40');
      add(L('recTd50'), atLeast(s.tdYards?.rec, 50) * v.recTd50, 'recTd50');
      add(L('rec100'), s.receiving.yards >= 100 && s.receiving.yards < 200 ? v.rec100 : 0, 'rec100');
      add(L('rec200'), s.receiving.yards >= 200 ? v.rec200 : 0, 'rec200');
    }
    for (const rule of v.steps ?? []) {
      const amount = statFor(s, rule.stat);
      if (amount !== undefined) add(stepLabel(rule), Math.floor(amount / rule.every) * rule.points, rule.stat);
    }
    add(L('twoPoint'), s.twoPointConversions * v.twoPoint, 'twoPoint');
    if (s.fumbles) {
      add(L('fumbles'), s.fumbles.fumbles * v.fumble, 'fumble');
      add(L('fumblesLost'), s.fumbles.lost * v.fumbleLost, 'fumbleLost');
    }
    if (s.returns) {
      add(L('returnTds'), s.returns.touchdowns * v.returnTd, 'returnTd');
      add(L('kickReturnYards'), (s.returns.kickYards ?? 0) * v.kickReturnYards, 'kickReturnYards');
      add(L('puntReturnYards'), (s.returns.puntYards ?? 0) * v.puntReturnYards, 'puntReturnYards');
    }
    if (s.kicking) {
      const k = s.kicking;
      for (const d of k.madeDistances.slice(0, k.fgMade)) {
        const key = d >= 60 ? 'fg60plus' : d >= 50 ? 'fg50to59' : d >= 40 ? 'fg40to49' : 'fg0to39';
        add(L('fieldGoal', { distance: d }), v[key], key);
      }
      add(L('fieldGoalUnknown'), Math.max(0, k.fgMade - Math.min(k.madeDistances.length, k.fgMade)) * v.fg0to39, 'fg0to39');
      add(L('missedFieldGoals'), (k.fgAttempts - k.fgMade) * v.fgMissed, 'fgMissed');
      for (const d of k.missedDistances ?? []) {
        const key = d >= 60 ? 'fgMissed60plus' : d >= 50 ? 'fgMissed50to59' : d >= 40 ? 'fgMissed40to49' : 'fgMissed0to39';
        add(L('missedFieldGoal', { distance: d }), v[key], key);
      }
      add(L('extraPoints'), k.xpMade * v.xpMade, 'xpMade');
      add(L('missedExtraPoints'), (k.xpAttempts - k.xpMade) * v.xpMissed, 'xpMissed');
    }
    if (s.defense) {
      const d = s.defense;
      add(L('soloTackles'), d.soloTackles * v.soloTackle, 'soloTackle');
      add(L('assistedTackles'), (d.totalTackles - d.soloTackles) * v.assistedTackle, 'assistedTackle');
      add(L('sacks'), d.sacks * v.sack, 'sack');
      add(L('tacklesForLoss'), d.tacklesForLoss * v.tackleForLoss, 'tackleForLoss');
      add(L('qbHits'), d.qbHits * v.qbHit, 'qbHit');
      add(L('passesDefended'), d.passesDefended * v.passDefended, 'passDefended');
      add(L('defensiveTds'), d.touchdowns * v.defensiveTd, 'defensiveTd');
    }
    // Only pure defenders score recoveries; ESPN gives offensive players a defense line after turnovers.
    if (s.fumbles && !s.passing && !s.rushing && !s.receiving && (s.defense || s.interceptions)) add(L('fumbleRecoveries'), s.fumbles.recovered * v.fumbleRecovery, 'fumbleRecovery');
    if (s.interceptions) add(L('interceptions'), s.interceptions.interceptions * v.idpInterception, 'idpInterception');
    add(L('safeties'), s.safeties * v.safety, 'safety');
    add(L('blockedKicks'), (s.blockedKicks ?? 0) * v.blockedKick, 'blockedKick');
    add(L('forcedFumbles'), (s.forcedFumbles ?? 0) * v.forcedFumble, 'forcedFumble');
    add(L('stuffs'), (s.stuffs ?? 0) * v.stuff, 'stuff');
  });
}

const YARDS_ALLOWED_BANDS: Array<{ min: number; max: number; key: ValueKey }> = [
  { min: 0, max: 99, key: 'yardsAllowed0' }, { min: 100, max: 199, key: 'yardsAllowed100' }, { min: 200, max: 299, key: 'yardsAllowed200' },
  { min: 300, max: 349, key: 'yardsAllowed300' }, { min: 350, max: 399, key: 'yardsAllowed350' }, { min: 400, max: 449, key: 'yardsAllowed400' },
  { min: 450, max: 499, key: 'yardsAllowed450' }, { min: 500, max: 549, key: 'yardsAllowed500' }, { min: 550, max: Infinity, key: 'yardsAllowed550' },
];

export function scoreDefense(d: DefenseStats, values: ScoringValues): ScoreResult {
  const v = applied(values);
  return collect((add) => {
    add(L('sacks'), d.sacks * v.dstSack, 'dstSack');
    add(L('interceptions'), d.interceptions * v.dstInterception, 'dstInterception');
    add(L('fumbleRecoveries'), d.fumbleRecoveries * v.dstFumbleRecovery, 'dstFumbleRecovery');
    add(L('safeties'), d.safeties * v.dstSafety, 'dstSafety');
    add(L('blockedKicks'), (d.blockedKicks ?? 0) * v.dstBlockedKick, 'dstBlockedKick');
    add(L('touchdowns'), d.touchdowns * v.dstTd, 'dstTd');
    const band = v.pointsAllowedBands?.find(({ min, max }) => d.pointsAllowed >= min && (max === null || d.pointsAllowed <= max));
    const ya = d.yardsAllowed === undefined ? undefined : YARDS_ALLOWED_BANDS.find(({ min, max }) => d.yardsAllowed! >= min && d.yardsAllowed! <= max);
    if (ya) add(L('yardsAllowed', { yards: d.yardsAllowed }), v[ya.key], ya.key);
    add(L('pointsAllowed', { points: d.pointsAllowed }), band?.points ?? (v.pointsAllowedBands ? 0 : v.pointsAllowed[tierIndex(d.pointsAllowed)] ?? 0), 'pointsAllowed');
  });
}

const empty = (): ScoreResult => ({ total: 0, breakdown: [], byRule: {} });

export function scoreEntry(entry: FollowedEntry, game: GameStats | undefined, v: ScoringValues): ScoreResult {
  if (!game) return empty();
  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    return d ? scoreDefense(d, v) : empty();
  }
  const s = game.players[entry.espnId];
  return s ? scorePlayer(s, v) : empty();
}
