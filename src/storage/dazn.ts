import { createStore } from './store';

/** Settings: look up DAZN game links through our own server. Off until the user turns it on. */
export const daznEnabledStore = createStore<boolean>({
  key: 'nflsw:v1:daznEnabled',
  fallback: () => false,
  isValid: (v): v is boolean => typeof v === 'boolean',
});

/** The last sync: ESPN event id to the game's DAZN path (without the region, e.g. "/home/abc/def"). Nothing reads the links yet. */
export interface DaznLinks { syncedAt: string | null; links: Record<string, string> }

export const daznLinksStore = createStore<DaznLinks>({
  key: 'nflsw:v1:daznLinks',
  fallback: () => ({ syncedAt: null, links: {} }),
  isValid: (v): v is DaznLinks => {
    if (typeof v !== 'object' || v === null) return false;
    const { syncedAt, links } = v as Partial<DaznLinks>;
    return (syncedAt === null || typeof syncedAt === 'string') && typeof links === 'object' && links !== null && Object.values(links).every((p) => typeof p === 'string');
  },
});
