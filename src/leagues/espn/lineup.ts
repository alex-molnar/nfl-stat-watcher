import { i18n } from '../../i18n';
import { EspnLoadError, failure } from './client';

const API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const TIMEOUT_MS = 15_000;
// ESPN's roster view carries every player's stats (about 3 MB for a ten team league), so the cap is generous.
const MAX_BYTES = 8_000_000;
/** Bench, injured reserve, taxi and rookie slots; everything else is a starting slot. */
const NON_STARTING_SLOTS = new Set([20, 21, 24, 25]);
const POSITIONS: Record<number, string> = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };

export interface Starter {
  kind: 'player' | 'defense';
  /** ESPN athlete id for players; NFL team id for a D/ST. The fantasy and site ids are the same. */
  espnId: string;
  name: string;
  nflTeamId: string;
  position: string;
}

export interface LeagueLineups {
  teams: { id: string; name: string }[];
  starters: Record<string, Starter[]>;
  /** Team id to the team it plays in the current matchup period. */
  opponentOf: Record<string, string>;
}

export class LineupError extends Error {}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const asId = (value: unknown): string | null => (typeof value === 'number' || typeof value === 'string') && /^-?\d{1,20}$/.test(String(value)) ? String(value) : null;

/** Reads only lineups and pairings from ESPN's roster view; every other field is ignored and nothing else is kept. */
export function parseLeagueLineups(value: unknown, leagueId: string, season: string): LeagueLineups {
  const root = record(value);
  if (!root || !Array.isArray(root.teams) || root.teams.length === 0 || root.teams.length > 40) throw new LineupError(i18n.t(($) => $.sync.lineup.noRosters));
  if (asId(root.id) !== leagueId) throw new LineupError(i18n.t(($) => $.sync.lineup.differentLeague));
  if (asId(root.seasonId) !== season) throw new LineupError(i18n.t(($) => $.sync.lineup.differentSeason));

  const teams: LeagueLineups['teams'] = [];
  const starters: LeagueLineups['starters'] = {};
  for (const raw of root.teams) {
    const team = record(raw);
    const id = asId(team?.id);
    const entries = record(team?.roster)?.entries;
    if (!team || !id || !Array.isArray(entries) || entries.length > 60) throw new LineupError(i18n.t(($) => $.sync.lineup.invalidRoster));
    teams.push({ id, name: typeof team.name === 'string' && team.name.trim() ? team.name.trim().slice(0, 80) : i18n.t(($) => $.sync.lineup.teamFallback, { id }) });
    starters[id] = entries.flatMap((rawEntry): Starter[] => {
      const entry = record(rawEntry);
      const slot = entry?.lineupSlotId;
      const player = record(record(entry?.playerPoolEntry)?.player);
      const playerId = asId(player?.id);
      const nflTeamId = asId(player?.proTeamId);
      if (typeof slot !== 'number' || NON_STARTING_SLOTS.has(slot) || !player || !playerId || !nflTeamId || nflTeamId === '0') return [];
      const position = typeof player.defaultPositionId === 'number' ? POSITIONS[player.defaultPositionId] ?? '' : '';
      const name = typeof player.fullName === 'string' ? player.fullName.trim().slice(0, 80) : '';
      if (!name) return [];
      // A D/ST has a negative id (-16000 minus the NFL team id); the site follows it by team id.
      return player.defaultPositionId === 16
        ? [{ kind: 'defense', espnId: nflTeamId, name, nflTeamId, position: 'D/ST' }]
        : [{ kind: 'player', espnId: playerId, name, nflTeamId, position }];
    });
  }

  const period = record(root.status)?.currentMatchupPeriod;
  const opponentOf: Record<string, string> = {};
  if (Array.isArray(root.schedule)) {
    for (const raw of root.schedule) {
      const match = record(raw);
      const home = asId(record(match?.home)?.teamId);
      const away = asId(record(match?.away)?.teamId);
      if (match?.matchupPeriodId === period && home && away) { opponentOf[home] = away; opponentOf[away] = home; }
    }
  }
  return { teams, starters, opponentOf };
}

export function lineupsUrl(leagueId: string, season: string): string {
  return `${API}/${season}/segments/0/leagues/${leagueId}?view=mRoster&view=mTeam&view=mMatchupScore`;
}

export async function fetchLeagueLineups(leagueId: string, season: string, signal?: AbortSignal): Promise<LeagueLineups> {
  if (!/^\d{1,20}$/.test(leagueId) || !/^\d{4}$/.test(season)) throw new EspnLoadError('malformed', i18n.t(($) => $.sync.lineup.invalidId));
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(lineupsUrl(leagueId, season), { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new EspnLoadError('network-error', i18n.t(($) => $.sync.lineup.unreachable));
  }
  if (!response.ok) throw failure(response.status);
  return readLineups(await response.text(), leagueId, season);
}

/** Shared by the fetch and by pasted text, so both go through the same size limit and validation. */
export function readLineups(text: string, leagueId: string, season: string): LeagueLineups {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new LineupError(i18n.t(($) => $.sync.lineup.tooBig));
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new LineupError(i18n.t(($) => $.sync.lineup.notJson)); }
  return parseLeagueLineups(json, leagueId, season);
}
