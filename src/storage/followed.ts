import { createStore } from './store';
import type { FollowedEntry } from './types';

const isStr = (v: unknown): v is string => typeof v === 'string';

function isEntry(v: unknown): v is FollowedEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    (e.kind === 'player' || e.kind === 'defense') &&
    [e.espnId, e.name, e.teamId, e.teamAbbr, e.position, e.profileId].every(isStr) &&
    (e.jersey === undefined || isStr(e.jersey))
  );
}

export const followedStore = createStore<FollowedEntry[]>({
  key: 'nflsw:v1:followed',
  fallback: () => [],
  isValid: (v): v is FollowedEntry[] => Array.isArray(v) && v.every(isEntry),
});

type EntryKey = Pick<FollowedEntry, 'kind' | 'espnId' | 'profileId'>;

export const sameEntry = (a: EntryKey, b: EntryKey) =>
  a.kind === b.kind && a.espnId === b.espnId && a.profileId === b.profileId;

function dedupe(entries: FollowedEntry[]): FollowedEntry[] {
  return entries.filter((e, i) => entries.findIndex((x) => sameEntry(x, e)) === i);
}

export function addEntry(entry: FollowedEntry) {
  const list = followedStore.get();
  if (!list.some((e) => sameEntry(e, entry))) followedStore.set([...list, entry]);
}

export function removeEntry(entry: EntryKey) {
  followedStore.set(followedStore.get().filter((e) => !sameEntry(e, entry)));
}

export function moveEntry(entry: EntryKey, toProfileId: string) {
  followedStore.set(dedupe(followedStore.get().map((e) => (sameEntry(e, entry) ? { ...e, profileId: toProfileId } : e))));
}

export function updateEntryTeam(
  espnId: string,
  patch: Pick<FollowedEntry, 'teamId' | 'teamAbbr' | 'position' | 'jersey'>,
) {
  followedStore.set(followedStore.get().map((e) => (e.kind === 'player' && e.espnId === espnId ? { ...e, ...patch } : e)));
}

export function reassignProfile(fromId: string, toId: string) {
  followedStore.set(dedupe(followedStore.get().map((e) => (e.profileId === fromId ? { ...e, profileId: toId } : e))));
}

/** Entries that point at a profile that no longer exists move to the first profile. */
export function withValidProfiles(entries: FollowedEntry[], profileIds: string[]): FollowedEntry[] {
  const first = profileIds[0] ?? '';
  return dedupe(entries.map((e) => (profileIds.includes(e.profileId) ? e : { ...e, profileId: first })));
}
