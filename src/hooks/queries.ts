import { useEffect, useState, useSyncExternalStore } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { getAthlete, getLeagueInjuries, getScoreboard, getSummary, getTeams, searchPlayers } from '../espn/client';
import { fakeGames, sandboxOn, subscribeSandbox } from '../espn/campSandbox';
import { parseLeagueInjuries } from '../stats/injury';
import { normalizeSummary } from '../stats/normalize';
import { toGames, type GameInfo } from '../stats/scoreboard';

export const scoreboardInterval = (games: GameInfo[] | undefined) =>
  games?.some((g) => g.state === 'in') ? 60_000 : 600_000;

/** A failed scoreboard load retries in a minute, not in ten, so live games are picked up soon. */
export const scoreboardRefetch = (status: string, games: GameInfo[] | undefined, paused = false) =>
  paused ? false : status === 'error' ? 60_000 : scoreboardInterval(games);

export function summaryPolling(state: GameInfo['state'] | undefined, paused = false): {
  enabled: boolean;
  refetchInterval: number | false;
  staleTime: number;
} {
  if (state === 'in') return { enabled: true, refetchInterval: paused ? false : 10_000, staleTime: 0 };
  if (state === 'post') return { enabled: true, refetchInterval: false, staleTime: Infinity };
  // Not started yet: one fetch for the injury report, refreshed now and then because designations change before kickoff.
  if (state === 'pre') return { enabled: true, refetchInterval: paused ? false : 600_000, staleTime: 300_000 };
  return { enabled: false, refetchInterval: false, staleTime: 0 };
}

export function freshness(isError: boolean, dataUpdatedAt: number): string | null {
  if (!isError) return null;
  if (!dataUpdatedAt) return 'Live data unavailable, retrying';
  const time = new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Updated ${time}, retrying`;
}

// Paused (WCAG 2.2.2): no interval and no focus refetch, loaded data stays on screen.
export function useScoreboard(paused = false) {
  // Rookie camp's fake games ride beside the real ones while its last drill runs. They are added on the way out, not cached with the real schedule.
  const practice = useSyncExternalStore(subscribeSandbox, sandboxOn, () => false);
  return useQuery({
    queryKey: ['scoreboard'],
    queryFn: async () => toGames(await getScoreboard()),
    select: practice ? (games) => [...games, ...fakeGames()] : undefined,
    refetchInterval: (query) => scoreboardRefetch(query.state.status, query.state.data, paused),
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
  });
}

/** One cache entry per game, shared by every card and by the matchup totals, so nothing is fetched twice. */
export function summaryQuery(game: GameInfo | null, paused = false) {
  const polling = summaryPolling(game?.state, paused);
  return queryOptions({
    queryKey: ['summary', game?.eventId],
    queryFn: async () => normalizeSummary(await getSummary(game!.eventId)),
    enabled: polling.enabled && game !== null,
    refetchInterval: polling.refetchInterval,
    refetchOnWindowFocus: !paused,
    refetchOnReconnect: !paused,
    staleTime: polling.staleTime,
  });
}

export function useGameSummary(game: GameInfo | null, paused = false) {
  return useQuery(summaryQuery(game, paused));
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

/** Every player's injury designation, refreshed every five minutes while the page is open (not while paused). */
export function useLeagueInjuries(paused = false) {
  return useQuery({
    queryKey: ['injuries'],
    queryFn: async () => parseLeagueInjuries(await getLeagueInjuries()),
    staleTime: 5 * 60_000,
    refetchInterval: paused ? false : 5 * 60_000,
    refetchOnWindowFocus: !paused,
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
