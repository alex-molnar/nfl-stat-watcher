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

/** Profile delete: my entries move to `toId`; the deleted league's opponent entries are removed, never merged into another league. */
export function reassignProfile(fromId: string, toId: string) {
  followedStore.set(
    dedupe(
      followedStore
        .get()
        .filter((e) => !(e.profileId === fromId && sideOf(e) === 'opponent'))
        .map((e) => (e.profileId === fromId ? { ...e, profileId: toId } : e)),
    ),
  );
}

/** Orphan repair: my entries of a missing profile move to the first profile; opponent entries of a missing profile are dropped. */
export function withValidProfiles(entries: FollowedEntry[], profileIds: string[]): FollowedEntry[] {
  const first = profileIds[0] ?? '';
  return dedupe(
    entries.flatMap((e) => (profileIds.includes(e.profileId) ? [e] : sideOf(e) === 'opponent' ? [] : [{ ...e, profileId: first }])),
  );
}
