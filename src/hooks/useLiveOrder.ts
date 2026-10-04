import { useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { liveRank } from '../stats/liveOrder';
import type { GameInfo } from '../stats/scoreboard';
import { entryKey } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';
import { summaryQuery } from './queries';

const UNKNOWN = 40; // after every ranked card, until the game's situation arrives

/**
 * A comparator that orders live cards by liveRank. Each card's rank is read once, the first time its
 * game's situation is known, and then kept: cards never reshuffle while the page is open, and a reload
 * (a new mount) ranks again. Shares the summary cache entries the cards already subscribe to.
 */
export function useLiveOrder(rows: { entry: FollowedEntry; game: GameInfo | null }[], paused: boolean) {
  const live = rows.filter((row): row is { entry: FollowedEntry; game: GameInfo } => row.game?.state === 'in');
  const unique = [...new Map(live.map(({ game }) => [game.eventId, game] as const)).values()];
  const summaries = useQueries({ queries: unique.map((game) => summaryQuery(game, paused)) });
  const stats = new Map(unique.map((game, i) => [game.eventId, summaries[i]?.data]));
  const frozen = useRef(new Map<string, number>());
  for (const { entry, game } of live) {
    const key = entryKey(entry);
    if (frozen.current.has(key)) continue;
    const rank = liveRank(entry, game, stats.get(game.eventId));
    if (rank !== null) frozen.current.set(key, rank);
  }
  const rankOf = (entry: FollowedEntry) => frozen.current.get(entryKey(entry)) ?? UNKNOWN;
  return <T extends { entry: FollowedEntry }>(a: T, b: T) => rankOf(a.entry) - rankOf(b.entry);
}
