import { isOffense, isRedZone } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameInfo } from './scoreboard';
import type { GameStats } from './types';

/** Within a bucket: skill players, then quarterbacks, then kickers, then defenses and IDP. */
function tier(entry: FollowedEntry): number {
  if (entry.kind === 'defense' || !isOffense(entry.position)) return 3;
  if (entry.position === 'K' || entry.position === 'PK') return 2;
  return entry.position === 'QB' ? 1 : 0;
}

/**
 * Sort rank for a card in a live game: red zone first, then players whose side has the ball (offense
 * with possession, defense without), then everyone else. Null until the game's situation is known.
 * Lower sorts first; the tens digit is the bucket and the ones digit is the position tier.
 */
export function liveRank(entry: FollowedEntry, game: GameInfo, stats: GameStats | undefined): number | null {
  const situation = stats?.situation;
  if (!situation) return null;
  const hasBall = situation.possessionTeamId === entry.teamId;
  const onField = entry.kind === 'player' && isOffense(entry.position) ? hasBall : !hasBall;
  const bucket = isRedZone(entry, game, stats) ? 0 : onField ? 1 : 2;
  return bucket * 10 + tier(entry);
}
