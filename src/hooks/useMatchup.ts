import { useQueries } from '@tanstack/react-query';
import { scoreEntry } from '../scoring/score';
import type { Profile } from '../scoring/types';
import { gameForTeam, type GameInfo } from '../stats/scoreboard';
import { followedStore, sideOf, withValidProfiles } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { useStore } from '../storage/useStore';
import { summaryQuery, useScoreboard } from './queries';

export interface MatchupRow { entry: FollowedEntry; game: GameInfo | null; points: number }

export interface Matchup {
  profile: Profile;
  mine: MatchupRow[];
  opponent: MatchupRow[];
  totals: { mine: number; opponent: number };
  scoreboard: ReturnType<typeof useScoreboard>;
  /** False while the scoreboard or any needed summary is still loading, so totals may still jump. */
  settled: boolean;
}

// Live first, then final, later and bye: the order of the Players page groups.
const ORDER = ['in', 'post', 'pre', 'none'] as const;
const rank = (game: GameInfo | null) => ORDER.indexOf(game?.state ?? 'none');
const sum = (rows: MatchupRow[]) => Math.round(rows.reduce((t, r) => t + r.points, 0) * 100) / 100;

/**
 * Both sides of one league's matchup, scored with that league's profile. Summaries come from the
 * same ['summary', eventId] cache entries the cards subscribe to, one query per game.
 */
export function useMatchup(profileId: string, paused: boolean): Matchup {
  const profiles = useStore(profilesStore);
  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0]!;
  const entries = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id)).filter((e) => e.profileId === profile.id);
  const scoreboard = useScoreboard(paused);
  const games = scoreboard.data ?? [];
  const placed = entries
    .map((entry) => ({ entry, game: gameForTeam(games, entry.teamId) }))
    .sort((a, b) => rank(a.game) - rank(b.game));
  // Deduplicated: useQueries warns about duplicate keys, and both sides often share a game.
  const unique = [...new Map(placed.flatMap(({ game }) => (game ? [[game.eventId, game] as const] : []))).values()];
  const summaries = useQueries({ queries: unique.map((g) => summaryQuery(g, paused)) });
  const stats = new Map(unique.map((g, i) => [g.eventId, summaries[i]?.data]));
  const rows = placed.map(({ entry, game }) => ({
    entry,
    game,
    points: scoreEntry(entry, game ? stats.get(game.eventId) : undefined, profile.values).total,
  }));
  const mine = rows.filter((r) => sideOf(r.entry) === 'mine');
  const opponent = rows.filter((r) => sideOf(r.entry) === 'opponent');
  return { profile, mine, opponent, totals: { mine: sum(mine), opponent: sum(opponent) }, scoreboard, settled: rows.length === 0 || (!scoreboard.isLoading && !summaries.some((q) => q.isLoading)) };
}
