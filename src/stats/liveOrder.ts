import { isOffense, isRedZone } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameInfo } from './scoreboard';
import { isOut } from './injury';
import type { GameStats } from './types';

/** Within a bucket: skill players, then quarterbacks, then kickers, then defenses and IDP. */
function tier(entry: FollowedEntry): number {
  if (entry.kind === 'defense' || !isOffense(entry.position)) return 3;
  if (entry.position === 'K' || entry.position === 'PK') return 2;
  return entry.position === 'QB' ? 1 : 0;
}

/** After every other rank, including cards whose situation is still unknown (40). */
export const OUT_RANK = 50;

/** Whether the card's side of the ball is on the field: offense with possession, defense without it. */
export function onRightSide(entry: FollowedEntry, situation: { possessionTeamId: string; driveOver?: true }): boolean {
  if (situation.driveOver) return false; // between drives nobody is on offense or defense yet
  const hasBall = situation.possessionTeamId === entry.teamId;
  return entry.kind === 'player' && isOffense(entry.position) ? hasBall : !hasBall;
}

/**
 * Sort rank for a card in a live game: red zone first, then players whose side has the ball (offense
 * with possession, defense without), then everyone else. Null until the game's situation is known.
 * Lower sorts first; the tens digit is the bucket and the ones digit is the position tier.
 */
export function liveRank(entry: FollowedEntry, game: GameInfo, stats: GameStats | undefined): number | null {
  // A player ruled out goes to the back whatever the ball is doing, even before the situation is known.
  if (entry.kind === 'player' && isOut(stats?.injuries?.[entry.espnId])) return OUT_RANK;
  const situation = stats?.situation;
  if (!situation) return null;
  const bucket = isRedZone(entry, game, stats) ? 0 : onRightSide(entry, situation) ? 1 : 2;
  return bucket * 10 + tier(entry);
}

/**
 * Keeps a card at the rank it had before its own play for a few seconds, so a card whose celebration is playing
 * does not slide away mid-animation. Cards not involved in the play are never held and move at once.
 */
export class RankHolds {
  private held = new Map<string, { rank: number; until: number }>();

  /** Hold `rank` until `until` (ms). A hold already running keeps its original rank and only lasts longer. */
  hold(key: string, rank: number, until: number, now: number) {
    const existing = this.held.get(key);
    if (existing && existing.until > now) existing.until = Math.max(existing.until, until);
    else this.held.set(key, { rank, until });
  }

  /** The held rank while a hold is running, else the current one. */
  rank(key: string, current: number, now: number): number {
    const hold = this.held.get(key);
    if (!hold) return current;
    if (now >= hold.until) {
      this.held.delete(key);
      return current;
    }
    return hold.rank;
  }

  /** When the next running hold ends, so the caller can re-sort then; null when none is running. */
  nextExpiry(now: number): number | null {
    const ends = [...this.held.values()].map((hold) => hold.until).filter((until) => until > now);
    return ends.length ? Math.min(...ends) : null;
  }
}
