import { isOffense, isRedZone } from '../ui/format';
import type { FollowedEntry } from '../storage/types';
import type { GameInfo } from './scoreboard';
import { injuryOf, isOut } from './injury';
import type { GameStats, Injury } from './types';

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
export function liveRank(entry: FollowedEntry, game: GameInfo, stats: GameStats | undefined, league?: Record<string, Injury>): number | null {
  // A player ruled out goes to the back whatever the ball is doing, even before the situation is known.
  if (entry.kind === 'player' && isOut(injuryOf(entry.espnId, stats, league))) return OUT_RANK;
  const situation = stats?.situation;
  if (!situation) return null;
  const bucket = isRedZone(entry, game, stats) ? 0 : onRightSide(entry, situation) ? 1 : 2;
  return bucket * 10 + tier(entry);
}

/** How long a card stays at the top of its group after a celebrated play of its own. */
export const BOOST_MS = 30_000;

/**
 * A rank moved to the top of its own group: ahead of everyone else in the same bucket (red zone, on the field, or
 * the rest), keeping the position order among boosted cards, but never past the bucket above. Unranked and
 * ruled-out cards (rank 40 and up) are left alone.
 */
export function boostedRank(rank: number): number {
  const bucket = Math.floor(rank / 10);
  if (bucket >= 4) return rank;
  return bucket * 10 - 1 + (rank % 10) / 10;
}

/**
 * Per-card timing on top of liveRank. A hold keeps a card at the rank it had before its own play for a few
 * seconds, so a card whose celebration is playing does not slide away mid-animation. A boost then lifts the card
 * to the top of its group for a while. Cards not involved in a play are never held or boosted and move at once.
 */
export class RankHolds {
  private held = new Map<string, { rank: number; until: number }>();
  private boosted = new Map<string, number>();

  /** Hold `rank` until `until` (ms). A hold already running keeps its original rank and only lasts longer. */
  hold(key: string, rank: number, until: number, now: number) {
    const existing = this.held.get(key);
    if (existing && existing.until > now) existing.until = Math.max(existing.until, until);
    else this.held.set(key, { rank, until });
  }

  /** Lift the card to the top of its group until `until` (ms); another play extends it. */
  boost(key: string, until: number) {
    this.boosted.set(key, Math.max(until, this.boosted.get(key) ?? 0));
  }

  /**
   * The current rank, lifted to the top of its group while a boost runs. While a hold runs the card never sits lower
   * than its held rank: a hold stops a card sliding away mid-celebration, it never delays one moving up.
   */
  rank(key: string, current: number, now: number): number {
    let settled = current;
    const boostUntil = this.boosted.get(key);
    if (boostUntil !== undefined) {
      if (now < boostUntil) settled = boostedRank(current);
      else this.boosted.delete(key);
    }
    const hold = this.held.get(key);
    if (hold) {
      if (now < hold.until) return Math.min(hold.rank, settled);
      this.held.delete(key);
    }
    return settled;
  }

  /** When the next running hold or boost ends, so the caller can re-sort then; null when none is running. */
  nextExpiry(now: number): number | null {
    const ends = [...[...this.held.values()].map((hold) => hold.until), ...this.boosted.values()].filter((until) => until > now);
    return ends.length ? Math.min(...ends) : null;
  }
}
