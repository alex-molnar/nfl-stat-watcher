import { i18n } from '../../i18n';
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

export function failure(status: number): EspnLoadError {
  if (status === 401 || status === 403) return new EspnLoadError('access-denied', i18n.t(($) => $.leagues.errors.espn.accessDenied), status);
  if (status === 404) return new EspnLoadError('not-found', i18n.t(($) => $.leagues.errors.espn.notFound), status);
  if (status === 429) return new EspnLoadError('rate-limited', i18n.t(($) => $.leagues.errors.espn.rateLimited), status);
  return new EspnLoadError('server-error', i18n.t(($) => $.leagues.errors.espn.requestFailed, { status }), status);
}

export async function fetchPublicSettings(
  leagueId: string,
  season: string,
  signal?: AbortSignal,
): Promise<EspnLeagueSettings> {
  if (!/^\d{1,20}$/.test(leagueId) || !/^\d{4}$/.test(season)) throw new EspnLoadError('malformed', i18n.t(($) => $.leagues.errors.espn.invalidIdOrSeason));
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${API}/${season}/segments/0/leagues/${leagueId}?view=mSettings`, { signal: combined });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new EspnLoadError('network-error', i18n.t(($) => $.leagues.errors.espn.timeout));
    throw new EspnLoadError('network-error', i18n.t(($) => $.leagues.errors.espn.unreachable));
  }
  if (!response.ok) throw failure(response.status);
  try {
    return parseEspnLeagueSettings(await response.json(), leagueId, season, 'public-api');
  } catch (error) {
    if (error instanceof EspnSettingsError) throw new EspnLoadError('malformed', error.message, response.status);
    throw new EspnLoadError('malformed', i18n.t(($) => $.leagues.errors.espn.invalidSettings), response.status);
  }
}

export async function loadEspnLeagueSettings(
  leagueInput: string,
  defaultSeason: string,
  signal?: AbortSignal,
): Promise<EspnLeagueSettings> {
  const parsed = parseEspnLeagueInput(leagueInput);
  const season = defaultSeason || parsed.season;
  if (!season) throw new EspnLoadError('malformed', i18n.t(($) => $.leagues.errors.espn.chooseSeason));
  try {
    return await fetchPublicSettings(parsed.leagueId, season, signal);
  } catch (error) {
    if (!(error instanceof EspnLoadError) || error.kind !== 'access-denied') throw error;
  }
  if (!isConnectorConfigured()) throw new EspnLoadError('access-denied', i18n.t(($) => $.leagues.errors.espn.privateLeague));
  let authenticated: unknown | null;
  try {
    authenticated = await loadSettingsWithBrowserSession(parsed.leagueId, season, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new EspnLoadError('access-denied', error instanceof Error ? error.message : i18n.t(($) => $.leagues.errors.espn.denied));
  }
  if (!authenticated) throw new EspnLoadError('access-denied', i18n.t(($) => $.leagues.errors.espn.connect));
  try {
    return parseEspnLeagueSettings(authenticated, parsed.leagueId, season, 'browser-session');
  } catch (error) {
    if (error instanceof EspnSettingsError) throw new EspnLoadError('malformed', error.message);
    throw error;
  }
}

export const espnSettingsQueryKey = (leagueId: string, season: string) => ['espn-settings', leagueId, season] as const;
