import { fakeAthlete, fakeClipAthletes, fakeSummary } from './campSandbox';
import type {
  EspnAthleteResponse,
  EspnScoreboard,
  EspnSearchItem,
  EspnSummary,
  EspnStandings,
  EspnTeamRef,
} from './types';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const WEB = 'https://site.web.api.espn.com/apis/common/v3';

export class EspnError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`ESPN request failed with ${status}: ${url}`);
    this.name = 'EspnError';
    this.status = status;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new EspnError(res.status, url);
  return (await res.json()) as T;
}

export async function searchPlayers(query: string): Promise<EspnSearchItem[]> {
  const res = await getJson<{ items?: EspnSearchItem[] }>(
    `${WEB}/search?query=${encodeURIComponent(query)}&limit=10&type=player`,
  );
  return (res.items ?? []).filter((item) => item.league === 'nfl');
}

export const getAthlete = async (id: string) =>
  fakeAthlete(id) ?? getJson<EspnAthleteResponse>(`${WEB}/sports/football/nfl/athletes/${id}`);

// ESPN's /teams endpoint sends no CORS headers, so a browser cannot call it. Standings does and lists all 32 teams.
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings';

export async function getTeams(): Promise<EspnTeamRef[]> {
  const res = await getJson<EspnStandings>(STANDINGS);
  return res.children.flatMap((c) => c.standings.entries.map((e) => e.team));
}

/** The athletes a highlight clip is tagged with. The summary lists clips without tags; this per-clip call has them. */
export async function getClipAthletes(clipId: string): Promise<string[]> {
  const fake = fakeClipAthletes(clipId); // Rookie camp's practice clip
  if (fake) return fake;
  const res = await getJson<{ videos?: { categories?: { type?: string; athleteId?: number }[] }[] }>(
    `https://content.core.api.espn.com/v1/video/clips/${encodeURIComponent(clipId)}`,
  );
  return (res.videos?.[0]?.categories ?? []).flatMap((c) => (c.type === 'athlete' && c.athleteId ? [String(c.athleteId)] : []));
}

/** The whole league's injury report: about 350 KB over the wire, complete for every team. */
export const getLeagueInjuries = () => getJson<unknown>(`${SITE}/injuries`);

export const getScoreboard = () => getJson<EspnScoreboard>(`${SITE}/scoreboard`);

export const getSummary = async (eventId: string) =>
  fakeSummary(eventId) ?? getJson<EspnSummary>(`${SITE}/summary?event=${eventId}`);
