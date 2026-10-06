import { PRESETS } from '../scoring/presets';
import { isHexColor, nextLeagueColor } from '../scoring/leagueColor';
import { isValidScoringValues, type Profile } from '../scoring/types';
import { uniqueName } from '../scoring/uniqueName';
import { isEntry, sameEntry } from '../storage/followed';
import { repairValues } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { isLeagueSource } from './types';

export const PROFILE_APP = 'stat-watch';
export const PROFILE_VERSION = 1;
const MAX_BYTES = 5_000_000;
const MAX_LEAGUES = 50;
const MAX_PLAYERS = 2000; // per league

export type ExportedPlayer = Omit<FollowedEntry, 'profileId'>;
export interface ExportedLeague extends Omit<Profile, 'color'> { color?: string; players: ExportedPlayer[] }
export interface ProfileFile { app: typeof PROFILE_APP; version: typeof PROFILE_VERSION; exportedAt: string; leagues: ExportedLeague[] }

/** A file the user gave us that cannot be imported; the message says why, in words they can act on. */
export class ProfileFileError extends Error {}

/** Every league with its settings and the players followed in it, on both sides. */
export function exportProfile(profiles: Profile[], followed: FollowedEntry[], now = new Date()): ProfileFile {
  return {
    app: PROFILE_APP,
    version: PROFILE_VERSION,
    exportedAt: now.toISOString(),
    leagues: profiles.map((profile) => ({
      ...profile,
      players: followed.filter((entry) => entry.profileId === profile.id).map(({ profileId: _profileId, ...player }) => player),
    })),
  };
}

export const serializeProfile = (file: ProfileFile) => JSON.stringify(file, null, 2);

const fail = (message: string): never => { throw new ProfileFileError(message); };

function readLeague(raw: unknown, position: number): ExportedLeague {
  const where = `League ${position}`;
  if (typeof raw !== 'object' || raw === null) return fail(`${where} is not an object.`);
  const league = raw as Record<string, unknown>;
  if (typeof league.id !== 'string' || !/^[\w-]{1,64}$/.test(league.id)) return fail(`${where} has no valid id.`);
  if (typeof league.name !== 'string' || !league.name.trim() || league.name.length > 120) return fail(`${where} has no valid name.`);
  if (league.preset !== 'custom' && !(typeof league.preset === 'string' && league.preset in PRESETS)) return fail(`${league.name} has an unknown scoring preset.`);
  if (!isValidScoringValues(league.values)) return fail(`${league.name} has invalid scoring settings.`);
  if (league.color !== undefined && !isHexColor(league.color)) return fail(`${league.name} has an invalid color.`);
  if (league.source !== undefined && !isLeagueSource(league.source)) return fail(`${league.name} has an invalid ESPN source.`);
  if (!Array.isArray(league.players) || league.players.length > MAX_PLAYERS) return fail(`${league.name} has an invalid player list.`);
  const players = league.players.map((player: unknown) => {
    const entry = { ...(typeof player === 'object' && player !== null ? player : {}), profileId: league.id };
    if (!isEntry(entry)) return fail(`${league.name} has an invalid player.`);
    const { profileId: _profileId, kind, espnId, name, teamId, teamAbbr, position: role, jersey, side } = entry;
    return { kind, espnId, name, teamId, teamAbbr, position: role, ...(jersey !== undefined ? { jersey } : {}), ...(side ? { side } : {}) };
  });
  return {
    id: league.id,
    name: league.name.trim(),
    preset: league.preset as Profile['preset'], // checked above
    values: repairValues(league.values),
    ...(league.color !== undefined ? { color: league.color } : {}),
    ...(league.source !== undefined ? { source: league.source } : {}),
    players,
  };
}

/** Checks the whole file before anything is used: one bad entry rejects it all. */
export function parseProfileFile(text: string): ProfileFile {
  if (text.length > MAX_BYTES) return fail('That file is too large to be a StatWatch profile.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('That is not valid JSON.');
  }
  const file = json as Partial<ProfileFile> | null;
  if (typeof file !== 'object' || file === null || file.app !== PROFILE_APP) return fail('That is not a StatWatch profile.');
  if (file.version !== PROFILE_VERSION) return fail(`This profile has version ${String(file.version)}, which this app cannot read.`);
  if (!Array.isArray(file.leagues) || file.leagues.length === 0 || file.leagues.length > MAX_LEAGUES) return fail(`A profile holds 1 to ${MAX_LEAGUES} leagues.`);
  const leagues = file.leagues.map(readLeague);
  if (new Set(leagues.map((league) => league.id)).size !== leagues.length) return fail('Two leagues in this profile share an id.');
  return { app: PROFILE_APP, version: PROFILE_VERSION, exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '', leagues };
}

export interface MergeSummary {
  leagues: { id: string; name: string; kind: 'update' | 'add'; players: number }[];
  updated: number;
  added: number;
  /** Players the file brings that are not followed yet. */
  players: number;
  /** With override: what was here and is deleted. */
  removed: { leagues: number; players: number } | null;
}

/**
 * Merges a profile file into what is here. A league with an id we already have is replaced (name, color, scoring, source)
 * and gains the players it was missing; any other league is added under its own id with a name nobody else has.
 * Nothing is removed, unless `override` is set: then every league and followed player here is deleted first and the
 * file's take their place.
 */
export function mergeProfile(file: ProfileFile, profiles: Profile[], followed: FollowedEntry[], override = false): { profiles: Profile[]; followed: FollowedEntry[]; summary: MergeSummary } {
  let nextProfiles = override ? [] : [...profiles];
  const nextFollowed = override ? [] : [...followed];
  const summary: MergeSummary = { leagues: [], updated: 0, added: 0, players: 0, removed: override ? { leagues: profiles.length, players: followed.length } : null };
  for (const league of file.leagues) {
    const existing = nextProfiles.find((p) => p.id === league.id);
    const others = nextProfiles.filter((p) => p.id !== league.id);
    const profile: Profile = {
      id: league.id,
      name: uniqueName(league.name, others),
      preset: league.preset,
      values: league.values,
      color: league.color ?? existing?.color ?? nextLeagueColor(nextProfiles.map((p) => p.color)),
      ...(league.source ? { source: league.source } : {}),
    };
    nextProfiles = existing ? nextProfiles.map((p) => (p.id === league.id ? profile : p)) : [...nextProfiles, profile];
    let gained = 0;
    for (const player of league.players) {
      const entry: FollowedEntry = { ...player, profileId: league.id };
      if (nextFollowed.some((have) => sameEntry(have, entry))) continue;
      nextFollowed.push(entry);
      gained++;
    }
    summary.leagues.push({ id: league.id, name: profile.name, kind: existing ? 'update' : 'add', players: gained });
    summary[existing ? 'updated' : 'added']++;
    summary.players += gained;
  }
  return { profiles: nextProfiles, followed: nextFollowed, summary };
}
