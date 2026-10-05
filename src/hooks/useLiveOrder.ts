import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { scoringEvent } from '../stats/events';
import { BOOST_MS, RankHolds, liveRank } from '../stats/liveOrder';
import type { GameInfo } from '../stats/scoreboard';
import type { GameStats } from '../stats/types';
import { entryKey } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';
import { SHOW_MS } from './useCelebration';
import { summaryQuery, useLeagueInjuries } from './queries';

const UNKNOWN = 40; // after every ranked card, until the game's situation arrives

type Row = { entry: FollowedEntry; game: GameInfo | null };

/**
 * A comparator that orders live cards by liveRank, from the latest data: when the ball changes hands the
 * order follows on the next refresh. A card whose own play is being celebrated keeps the rank it had before
 * that play until the celebration is over, then rises to the top of its group for BOOST_MS (never past the group
 * above it), except after a big bad play, which only holds; cards not involved in the play move at once.
 * Shares the summary cache entries the cards already subscribe to, so it adds no requests.
 */
export function useLiveOrder(rows: Row[], paused: boolean) {
  const unique = [...new Map(rows.flatMap(({ game }) => (game?.state === 'in' ? [[game.eventId, game] as const] : []))).values()];
  const summaries = useQueries({ queries: unique.map((game) => summaryQuery(game, paused)) });
  const stats = new Map(unique.map((game, i) => [game.eventId, summaries[i]?.data]));
  const league = useLeagueInjuries(paused).data;
  const holds = useRef(new RankHolds());
  const seen = useRef(new Map<string, GameStats>());
  const [, wake] = useState(0);
  const now = Date.now();

  // Compare each game's new data with the previous refresh, once per refresh, before ranking anyone.
  for (const game of unique) {
    const after = stats.get(game.eventId);
    if (!after) continue;
    const before = seen.current.get(game.eventId);
    seen.current.set(game.eventId, after);
    if (!before || before === after) continue;
    for (const row of rows) {
      if (row.game?.eventId !== game.eventId) continue;
      const event = scoringEvent(row.entry, before, after);
      if (!event) continue;
      const key = entryKey(row.entry);
      // The rank to hold is where the card sits right now, including any boost from an earlier play.
      holds.current.hold(key, holds.current.rank(key, liveRank(row.entry, game, before, league) ?? UNKNOWN, now), now + SHOW_MS, now);
      // A big bad play (an interception thrown, a fumble lost, a touchdown allowed) is held for its celebration and then
      // moves down by the normal rules; every other celebrated play, good or small, lifts the card for a while.
      if (event.tier === 'small' || event.tone === 'good') holds.current.boost(key, now + BOOST_MS);
    }
  }

  // Re-sort when the earliest hold runs out.
  useEffect(() => {
    const next = holds.current.nextExpiry(Date.now());
    if (next === null) return;
    const timer = setTimeout(() => wake((n) => n + 1), next - Date.now() + 25);
    return () => clearTimeout(timer);
  });

  const rankOf = ({ entry, game }: Row) => {
    const current = (game?.state === 'in' ? liveRank(entry, game, stats.get(game.eventId), league) : null) ?? UNKNOWN;
    return holds.current.rank(entryKey(entry), current, now);
  };
  return <T extends Row>(a: T, b: T) => rankOf(a) - rankOf(b);
}
