import { createStore } from './store';
import type { FollowedEntry } from './types';

export type Side = 'mine' | 'opponent';
export type EntryKey = Pick<FollowedEntry, 'kind' | 'espnId' | 'profileId' | 'side'>;

const isStr = (v: unknown): v is string => typeof v === 'string';

export function isEntry(v: unknown): v is FollowedEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    (e.kind === 'player' || e.kind === 'defense') &&
    [e.espnId, e.name, e.teamId, e.teamAbbr, e.position, e.profileId].every(isStr) &&
    (e.jersey === undefined || isStr(e.jersey)) &&
    (e.side === undefined || e.side === 'opponent')
  );
}

export const followedStore = createStore<FollowedEntry[]>({
  key: 'nflsw:v1:followed',
  fallback: () => [],
  isValid: (v): v is FollowedEntry[] => Array.isArray(v) && v.every(isEntry),
});

/** Absent `side` means mine, so data stored before vs mode needs no migration. */
export const sideOf = (e: Pick<FollowedEntry, 'side'>): Side => e.side ?? 'mine';

export const sameEntry = (a: EntryKey, b: EntryKey) =>
  a.kind === b.kind && a.espnId === b.espnId && a.profileId === b.profileId && sideOf(a) === sideOf(b);

/** My entries keep the key they had before vs mode; opponent entries get a suffix. */
export const entryKey = (e: EntryKey) => `${e.kind}:${e.espnId}:${e.profileId}${sideOf(e) === 'opponent' ? ':opponent' : ''}`;

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

/** Mine only: an opponent list belongs to its league, so opponent entries never move. */
export function moveEntry(entry: EntryKey, toProfileId: string) {
  if (sideOf(entry) === 'opponent') return;
  followedStore.set(dedupe(followedStore.get().map((e) => (sameEntry(e, entry) ? { ...e, profileId: toProfileId } : e))));
}

export function updateEntryTeam(
  espnId: string,
  patch: Pick<FollowedEntry, 'teamId' | 'teamAbbr' | 'position' | 'jersey'>,
) {
  followedStore.set(followedStore.get().map((e) => (e.kind === 'player' && e.espnId === espnId ? { ...e, ...patch } : e)));
}

/** What happens to the players of a league that is deleted: moved to another league (the opponent side too, or dropped), or deleted. */
export type PlayersHandling = { moveTo: string; opponents: boolean } | 'delete';

/** My entries of `fromId` move to `toId`; its opponent entries move along when `opponents` is set, and are removed otherwise, never merged by accident. */
export function reassignProfile(fromId: string, toId: string, opponents = false) {
  followedStore.set(
    dedupe(
      followedStore
        .get()
        .filter((e) => opponents || !(e.profileId === fromId && sideOf(e) === 'opponent'))
        .map((e) => (e.profileId === fromId ? { ...e, profileId: toId } : e)),
    ),
  );
}

/** Removes every entry of a league, on both sides. */
export function removeProfileEntries(profileId: string) {
  followedStore.set(followedStore.get().filter((e) => e.profileId !== profileId));
}

/** Orphan repair: my entries of a missing profile move to the first profile (all are dropped when there is no profile); opponent entries of a missing profile are dropped. */
export function withValidProfiles(entries: FollowedEntry[], profileIds: string[]): FollowedEntry[] {
  if (profileIds.length === 0) return []; // no league, so nothing can be followed
  const first = profileIds[0]!;
  return dedupe(
    entries.flatMap((e) => (profileIds.includes(e.profileId) ? [e] : sideOf(e) === 'opponent' ? [] : [{ ...e, profileId: first }])),
  );
}
