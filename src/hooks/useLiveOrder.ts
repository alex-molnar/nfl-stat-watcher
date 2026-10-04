import { useQueries } from '@tanstack/react-query';
import { liveRank } from '../stats/liveOrder';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';
import { summaryQuery } from './queries';

const UNKNOWN = 40; // after every ranked card, until the game's situation arrives

/**
 * A comparator that orders live cards by liveRank, from the latest data: when the ball changes hands the
 * order follows on the next refresh. Shares the summary cache entries the cards already subscribe to, so
 * it adds no requests.
 */
export function useLiveOrder(rows: { entry: FollowedEntry; game: GameInfo | null }[], paused: boolean) {
  const unique = [...new Map(rows.flatMap(({ game }) => (game?.state === 'in' ? [[game.eventId, game] as const] : []))).values()];
  const summaries = useQueries({ queries: unique.map((game) => summaryQuery(game, paused)) });
  const stats = new Map(unique.map((game, i) => [game.eventId, summaries[i]?.data]));
  const rankOf = ({ entry, game }: { entry: FollowedEntry; game: GameInfo | null }) =>
    (game?.state === 'in' ? liveRank(entry, game, stats.get(game.eventId)) : null) ?? UNKNOWN;
  return <T extends { entry: FollowedEntry; game: GameInfo | null }>(a: T, b: T) => rankOf(a) - rankOf(b);
}
