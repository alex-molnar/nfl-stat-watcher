import { useQueries } from '@tanstack/react-query';
import { getClipAthletes } from '../espn/client';
import type { GameStats, Highlight } from '../stats/types';
import type { FollowedEntry } from '../storage/types';

/**
 * The game's highlight clips that are tagged with this card's player, newest first. The summary the card already
 * polls lists the clips; each clip's tags are fetched once and cached for good, shared by every card on the page.
 * Team defenses have no player tag, so they get none.
 */
export function useHighlights(entry: FollowedEntry, stats: GameStats | undefined): Highlight[] {
  const clips = entry.kind === 'player' ? stats?.highlights ?? [] : [];
  const tags = useQueries({
    queries: clips.map((clip) => ({ queryKey: ['clip', clip.id], queryFn: () => getClipAthletes(clip.id), staleTime: Infinity, retry: 1 })),
  });
  return clips.filter((_, i) => tags[i]?.data?.includes(entry.espnId));
}
