import type { EspnLeagueSettings } from '../types';
import { EspnSettingsError, parseEspnLeagueInput, parseEspnLeagueSettings } from './parse';
import { isConnectorConfigured, loadSettingsWithBrowserSession } from './connection';

const API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const TIMEOUT_MS = 15_000;

export type EspnLoadFailure = 'access-denied' | 'not-found' | 'rate-limited' | 'server-error' | 'network-error' | 'malformed';

export class EspnLoadError extends Error {
  constructor(readonly kind: EspnLoadFailure, message: string, readonly status?: number) {
    super(message);
    this.name = 'EspnLoadError';
  }
}

function failure(status: number): EspnLoadError {
  if (status === 401 || status === 403) return new EspnLoadError('access-denied', 'This ESPN account cannot access this league', status);
  if (status === 404) return new EspnLoadError('not-found', 'ESPN could not find this league for that season', status);
  if (status === 429) return new EspnLoadError('rate-limited', 'ESPN is temporarily rate limiting settings requests', status);
  return new EspnLoadError('server-error', `ESPN settings request failed (${status})`, status);
}

export async function fetchPublicSettings(
  leagueId: string,
  season: string,
  signal?: AbortSignal,
): Promise<EspnLeagueSettings> {
  if (!/^\d{1,20}$/.test(leagueId) || !/^\d{4}$/.test(season)) throw new EspnLoadError('malformed', 'Invalid ESPN league ID or season');
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${API}/${season}/segments/0/leagues/${leagueId}?view=mSettings`, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new EspnLoadError('network-error', 'ESPN settings request timed out');
    throw new EspnLoadError('network-error', 'ESPN could not be reached. Check the connection and try again.');
  }
  if (!response.ok) throw failure(response.status);
  try {
    return parseEspnLeagueSettings(await response.json(), leagueId, season, 'public-api');
  } catch (error) {
    if (error instanceof EspnSettingsError) throw new EspnLoadError('malformed', error.message, response.status);
    throw new EspnLoadError('malformed', 'ESPN returned invalid settings', response.status);
  }
}

export async function loadEspnLeagueSettings(
  leagueInput: string,
  defaultSeason: string,
  signal?: AbortSignal,
): Promise<EspnLeagueSettings> {
  const parsed = parseEspnLeagueInput(leagueInput);
  const season = defaultSeason || parsed.season;
  if (!season) throw new EspnLoadError('malformed', 'Choose the fantasy season to load');
  try {
    return await fetchPublicSettings(parsed.leagueId, season, signal);
  } catch (error) {
    if (!(error instanceof EspnLoadError) || error.kind !== 'access-denied') throw error;
  }
  if (!isConnectorConfigured()) throw new EspnLoadError('access-denied', 'This league is private. Copy its settings from your signed-in ESPN tab to import it.');
  let authenticated: unknown | null;
  try {
    authenticated = await loadSettingsWithBrowserSession(parsed.leagueId, season, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new EspnLoadError('access-denied', error instanceof Error ? error.message : 'ESPN denied access to this league');
  }
  if (!authenticated) throw new EspnLoadError('access-denied', 'Connect ESPN to import this private league');
  try {
    return parseEspnLeagueSettings(authenticated, parsed.leagueId, season, 'browser-session');
  } catch (error) {
    if (error instanceof EspnSettingsError) throw new EspnLoadError('malformed', error.message);
    throw error;
  }
}

export const espnSettingsQueryKey = (leagueId: string, season: string) => ['espn-settings', leagueId, season] as const;
