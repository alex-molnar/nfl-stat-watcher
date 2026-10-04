import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAthlete, getScoreboard, getSummary, getTeams, searchPlayers } from '../espn/client';
import { normalizeSummary } from '../stats/normalize';
import { toGames, type GameInfo } from '../stats/scoreboard';

export const scoreboardInterval = (games: GameInfo[] | undefined) =>
  games?.some((g) => g.state === 'in') ? 60_000 : 600_000;

export function summaryPolling(state: GameInfo['state'] | undefined): {
  enabled: boolean;
  refetchInterval: number | false;
  staleTime: number;
} {
  if (state === 'in') return { enabled: true, refetchInterval: 10_000, staleTime: 0 };
  if (state === 'post') return { enabled: true, refetchInterval: false, staleTime: Infinity };
  return { enabled: false, refetchInterval: false, staleTime: 0 };
}

export function freshness(isError: boolean, dataUpdatedAt: number): string | null {
  if (!isError) return null;
  if (!dataUpdatedAt) return 'Live data unavailable, retrying';
  const time = new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Updated ${time}, retrying`;
}

export function useScoreboard() {
  return useQuery({
    queryKey: ['scoreboard'],
    queryFn: async () => toGames(await getScoreboard()),
    refetchInterval: (query) => scoreboardInterval(query.state.data),
  });
}

export function useGameSummary(game: GameInfo | null) {
  const polling = summaryPolling(game?.state);
  return useQuery({
    queryKey: ['summary', game?.eventId],
    queryFn: async () => normalizeSummary(await getSummary(game!.eventId)),
    enabled: polling.enabled && game !== null,
    refetchInterval: polling.refetchInterval,
    staleTime: polling.staleTime,
  });
}

export function useAthlete(id: string | undefined) {
  return useQuery({
    queryKey: ['athlete', id],
    queryFn: () => getAthlete(id!),
    enabled: id !== undefined,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: Infinity,
  });
}

export function usePlayerSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchPlayers(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
