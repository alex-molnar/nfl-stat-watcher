import type { DefenseStats, GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import type { ScoreLine, ScoreResult, ScoringValues, ValueKey } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

function collect(fill: (add: (label: string, points: number) => void) => void): ScoreResult {
  const breakdown: ScoreLine[] = [];
  fill((label, points) => {
    if (points !== 0) breakdown.push({ label, points: round2(points) });
  });
  return { total: round2(breakdown.reduce((sum, l) => sum + l.points, 0)), breakdown };
}

/** Switched-off rules score nothing; their stored weight is untouched. */
function applied(v: ScoringValues): ScoringValues {
  if (!v.off?.length) return v;
  const next = { ...v };
  for (const key of v.off) next[key as ValueKey] = 0;
  return next;
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
      add('Pass attempts', s.passing.attempts * v.passAttempt);
      add('Pass completions', s.passing.completions * v.passCompletion);
      add('Incomplete passes', Math.max(0, s.passing.attempts - s.passing.completions) * v.passIncompletion);
      add('Passing yards', s.passing.yards * v.passYards);
      add('Passing TDs', s.passing.touchdowns * v.passTd);
      add('40+ yard passing TDs', atLeast(s.tdYards?.pass, 40) * v.passTd40);
      add('50+ yard passing TDs', atLeast(s.tdYards?.pass, 50) * v.passTd50);
      add('300-399 yard passing game', s.passing.yards >= 300 && s.passing.yards < 400 ? v.pass300 : 0);
      add('400+ yard passing game', s.passing.yards >= 400 ? v.pass400 : 0);
      add('Interceptions thrown', s.passing.interceptions * v.interception);
    }
    if (s.rushing) {
      add('Rush attempts', s.rushing.attempts * v.rushAttempt);
      add('Rushing yards', s.rushing.yards * v.rushYards);
      add('Rushing TDs', s.rushing.touchdowns * v.rushTd);
      add('40+ yard rushing TDs', atLeast(s.tdYards?.rush, 40) * v.rushTd40);
      add('50+ yard rushing TDs', atLeast(s.tdYards?.rush, 50) * v.rushTd50);
      add('100-199 yard rushing game', s.rushing.yards >= 100 && s.rushing.yards < 200 ? v.rush100 : 0);
      add('200+ yard rushing game', s.rushing.yards >= 200 ? v.rush200 : 0);
    }
    if (s.receiving) {
      add('Targets', s.receiving.targets * v.recTarget);
      add('Receptions', s.receiving.receptions * v.reception);
      add('Receiving yards', s.receiving.yards * v.recYards);
      add('Receiving TDs', s.receiving.touchdowns * v.recTd);
      add('40+ yard receiving TDs', atLeast(s.tdYards?.rec, 40) * v.recTd40);
      add('50+ yard receiving TDs', atLeast(s.tdYards?.rec, 50) * v.recTd50);
      add('100-199 yard receiving game', s.receiving.yards >= 100 && s.receiving.yards < 200 ? v.rec100 : 0);
      add('200+ yard receiving game', s.receiving.yards >= 200 ? v.rec200 : 0);
    }
    add('2-point conversions', s.twoPointConversions * v.twoPoint);
    if (s.fumbles) {
      add('Fumbles', s.fumbles.fumbles * v.fumble);
      add('Fumbles lost', s.fumbles.lost * v.fumbleLost);
    }
    if (s.returns) add('Return TDs', s.returns.touchdowns * v.returnTd);
    if (s.kicking) {
      const k = s.kicking;
      for (const d of k.madeDistances.slice(0, k.fgMade)) add(`${d}-yard field goal`, d >= 60 ? v.fg60plus : d >= 50 ? v.fg50to59 : d >= 40 ? v.fg40to49 : v.fg0to39);
      add('Field goals, distance unknown', Math.max(0, k.fgMade - Math.min(k.madeDistances.length, k.fgMade)) * v.fg0to39);
      add('Missed field goals', (k.fgAttempts - k.fgMade) * v.fgMissed);
      for (const d of k.missedDistances ?? []) add(`${d}-yard missed field goal`, d >= 60 ? v.fgMissed60plus : d >= 50 ? v.fgMissed50to59 : d >= 40 ? v.fgMissed40to49 : v.fgMissed0to39);
      add('Extra points', k.xpMade * v.xpMade);
      add('Missed extra points', (k.xpAttempts - k.xpMade) * v.xpMissed);
    }
    if (s.defense) {
      const d = s.defense;
      add('Solo tackles', d.soloTackles * v.soloTackle);
      add('Assisted tackles', (d.totalTackles - d.soloTackles) * v.assistedTackle);
      add('Sacks', d.sacks * v.sack);
      add('Tackles for loss', d.tacklesForLoss * v.tackleForLoss);
      add('QB hits', d.qbHits * v.qbHit);
      add('Passes defended', d.passesDefended * v.passDefended);
      add('Defensive TDs', d.touchdowns * v.defensiveTd);
    }
    // Only pure defenders score recoveries; ESPN gives offensive players a defense line after turnovers.
    if (s.fumbles && !s.passing && !s.rushing && !s.receiving && (s.defense || s.interceptions)) add('Fumble recoveries', s.fumbles.recovered * v.fumbleRecovery);
    if (s.interceptions) add('Interceptions', s.interceptions.interceptions * v.idpInterception);
    add('Safeties', s.safeties * v.safety);
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
    add('Sacks', d.sacks * v.dstSack);
    add('Interceptions', d.interceptions * v.dstInterception);
    add('Fumble recoveries', d.fumbleRecoveries * v.dstFumbleRecovery);
    add('Safeties', d.safeties * v.dstSafety);
    add('Touchdowns', d.touchdowns * v.dstTd);
    const band = v.pointsAllowedBands?.find(({ min, max }) => d.pointsAllowed >= min && (max === null || d.pointsAllowed <= max));
    const ya = d.yardsAllowed === undefined ? undefined : YARDS_ALLOWED_BANDS.find(({ min, max }) => d.yardsAllowed! >= min && d.yardsAllowed! <= max);
    if (ya) add(`${d.yardsAllowed} yards allowed`, v[ya.key]);
    add(`${d.pointsAllowed} points allowed`, band?.points ?? (v.pointsAllowedBands ? 0 : v.pointsAllowed[tierIndex(d.pointsAllowed)] ?? 0));
  });
}

const empty = (): ScoreResult => ({ total: 0, breakdown: [] });

export function scoreEntry(entry: FollowedEntry, game: GameStats | undefined, v: ScoringValues): ScoreResult {
  if (!game) return empty();
  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    return d ? scoreDefense(d, v) : empty();
  }
  const s = game.players[entry.espnId];
  return s ? scorePlayer(s, v) : empty();
}
