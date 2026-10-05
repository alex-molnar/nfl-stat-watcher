import { createStore } from './store';

/** Settings: look up DAZN game links through our own server. Off until the user turns it on. */
export const daznEnabledStore = createStore<boolean>({
  key: 'nflsw:v1:daznEnabled',
  fallback: () => false,
  isValid: (v): v is boolean => typeof v === 'boolean',
});

/**
 * ESPN event id to DAZN path (without the region, e.g. "/home/abc/def"). `links` is what the last sync found;
 * `manual` is what the user typed in for a game, which a sync never touches and which wins over `links`.
 */
export interface DaznLinks { syncedAt: string | null; links: Record<string, string>; manual: Record<string, string> }

const isPaths = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' && v !== null && Object.values(v).every((p) => typeof p === 'string');

export const daznLinksStore = createStore<DaznLinks>({
  key: 'nflsw:v1:daznLinks',
  fallback: () => ({ syncedAt: null, links: {}, manual: {} }),
  isValid: (v): v is DaznLinks => {
    if (typeof v !== 'object' || v === null) return false;
    const { syncedAt, links, manual } = v as Partial<DaznLinks>;
    return (syncedAt === null || typeof syncedAt === 'string') && isPaths(links) && (manual === undefined || isPaths(manual));
  },
  repair: (v) => ({ ...v, manual: v.manual ?? {} }), // stored before manual links existed
});

/** The link a game uses: the user's own, else the one the sync found. */
export const daznPathFor = (stored: DaznLinks, eventId: string): string | undefined => stored.manual[eventId] ?? stored.links[eventId];

/** Sets (or, with null, removes) the user's own link for a game. */
export function setManualLink(eventId: string, path: string | null) {
  const { [eventId]: _dropped, ...rest } = daznLinksStore.get().manual;
  daznLinksStore.set({ ...daznLinksStore.get(), manual: path === null ? rest : { ...rest, [eventId]: path } });
}
