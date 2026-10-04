import type { DefenseStats, GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import type { ScoreLine, ScoreResult, ScoringValues } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

function collect(fill: (add: (label: string, points: number) => void) => void): ScoreResult {
  const breakdown: ScoreLine[] = [];
  fill((label, points) => {
    if (points !== 0) breakdown.push({ label, points: round2(points) });
  });
  return { total: round2(breakdown.reduce((sum, l) => sum + l.points, 0)), breakdown };
}

export function tierIndex(pointsAllowed: number): number {
  const upper = [0, 6, 13, 20, 27, 34];
  const i = upper.findIndex((max) => pointsAllowed <= max);
  return i === -1 ? 6 : i;
}

export function scorePlayer(s: PlayerStats, v: ScoringValues): ScoreResult {
  return collect((add) => {
    if (s.passing) {
      add('Passing yards', s.passing.yards * v.passYards);
      add('Passing TDs', s.passing.touchdowns * v.passTd);
      add('Interceptions thrown', s.passing.interceptions * v.interception);
    }
    if (s.rushing) {
      add('Rushing yards', s.rushing.yards * v.rushYards);
      add('Rushing TDs', s.rushing.touchdowns * v.rushTd);
    }
    if (s.receiving) {
      add('Receptions', s.receiving.receptions * v.reception);
      add('Receiving yards', s.receiving.yards * v.recYards);
      add('Receiving TDs', s.receiving.touchdowns * v.recTd);
    }
    add('2-point conversions', s.twoPointConversions * v.twoPoint);
    if (s.fumbles) add('Fumbles lost', s.fumbles.lost * v.fumbleLost);
    if (s.returns) add('Return TDs', s.returns.touchdowns * v.returnTd);
    if (s.kicking) {
      const k = s.kicking;
      for (const d of k.madeDistances.slice(0, k.fgMade)) add(`${d}-yard field goal`, d >= 50 ? v.fg50plus : d >= 40 ? v.fg40to49 : v.fg0to39);
      add('Field goals, distance unknown', Math.max(0, k.fgMade - Math.min(k.madeDistances.length, k.fgMade)) * v.fg0to39);
      add('Missed field goals', (k.fgAttempts - k.fgMade) * v.fgMissed);
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

export function scoreDefense(d: DefenseStats, v: ScoringValues): ScoreResult {
  return collect((add) => {
    add('Sacks', d.sacks * v.dstSack);
    add('Interceptions', d.interceptions * v.dstInterception);
    add('Fumble recoveries', d.fumbleRecoveries * v.dstFumbleRecovery);
    add('Safeties', d.safeties * v.dstSafety);
    add('Touchdowns', d.touchdowns * v.dstTd);
    add(`${d.pointsAllowed} points allowed`, v.pointsAllowed[tierIndex(d.pointsAllowed)] ?? 0);
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
