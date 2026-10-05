import { getScoreboard, getTeams } from '../espn/client';
import type { EspnTeamRef } from '../espn/types';
import { toGames, type GameInfo } from '../stats/scoreboard';
import { daznLinksStore, type DaznLinks } from '../storage/dazn';

export const DAZN_REGION = 'en-NL';
/** nginx forwards /dazn/ to www.dazn.com (the browser cannot call DAZN itself: no CORS headers). */
const SCHEDULE_URL = `/dazn/${DAZN_REGION}/competition/Competition:wy3kluvb4efae1of0d8146c1?tab=schedule`;
/** The schedule page's row of this week's games, as worded in the region above. */
const RAIL_HEADING = 'Live and Coming Up';

export interface DaznTile { title: string; path: string }

/** The tiles of the "Live and Coming Up" row: a title such as "Lions @ Panthers" and its game path without the region. */
export function parseScheduleTiles(html: string): DaznTile[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rail = [...doc.querySelectorAll('[data-testid="standard-rail"]')].find(
    (candidate) => candidate.querySelector('[data-testid="standard-rail__h2-heading"]')?.textContent?.trim() === RAIL_HEADING,
  );
  if (!rail) throw new Error(`the "${RAIL_HEADING}" row was not found on the DAZN schedule page`);
  const prefix = `/${DAZN_REGION}/home/`;
  return [...rail.querySelectorAll<HTMLAnchorElement>('a[data-testid="standard-rail__tile__link"]')].flatMap((anchor) => {
    const href = anchor.getAttribute('href') ?? '';
    const title = anchor.querySelector('[data-testid="standard-rail__tile__name"]')?.textContent?.trim();
    return title && href.startsWith(prefix) ? [{ title, path: href.slice(`/${DAZN_REGION}`.length) }] : [];
  });
}

/**
 * ESPN event id to DAZN path. A tile counts only when its title is exactly "<away nickname> @ <home nickname>",
 * so the variants (Spanish broadcast, Prime Vision, Manningcast, previews) never match.
 */
export function mapGames(tiles: DaznTile[], games: GameInfo[], teams: EspnTeamRef[]): Record<string, string> {
  const nickname = new Map(teams.map((team) => [team.id, team.name]));
  const byTitle = new Map<string, string>();
  for (const tile of tiles) if (!byTitle.has(tile.title)) byTitle.set(tile.title, tile.path);
  const links: Record<string, string> = {};
  for (const game of games) {
    const path = byTitle.get(`${nickname.get(game.away.id)} @ ${nickname.get(game.home.id)}`);
    if (path) links[game.eventId] = path;
  }
  return links;
}

/** A pasted DAZN game link (full address, or just the path) as "/home/<id>/<id>"; null when it is not one. */
export function parseDaznGameLink(text: string): string | null {
  const match = text.trim().match(/^(?:https:\/\/(?:www\.)?dazn\.com)?(?:\/[a-z]{2}-[A-Z]{2})?(\/home\/[A-Za-z0-9]+\/[A-Za-z0-9]+)\/?(?:[?#].*)?$/);
  return match ? match[1]! : null;
}

/** Reads DAZN's schedule through our own origin, maps this week's ESPN games to it and saves the result. */
export async function syncDaznLinks(): Promise<{ stored: DaznLinks; games: number }> {
  const response = await fetch(SCHEDULE_URL);
  if (!response.ok) throw new Error(`DAZN answered ${response.status}`);
  const tiles = parseScheduleTiles(await response.text());
  const [scoreboard, teams] = await Promise.all([getScoreboard(), getTeams()]);
  const games = toGames(scoreboard);
  const stored = { ...daznLinksStore.get(), syncedAt: new Date().toISOString(), links: mapGames(tiles, games, teams) }; // the user's own links stay
  daznLinksStore.set(stored);
  return { stored, games: games.length };
}
