import { DAZN_REGION } from './links';

const WINDOW_NAME = 'stat-watch-dazn';
const LAST_KEY = 'nflsw:dazn:lastWatched'; // session only: the named window outlives a reload of this page, not the browser session

export type WatchResult = 'ok' | 'blocked';

export const gameUrl = (path: string) => `https://www.dazn.com/${DAZN_REGION}${path}`;
/** Power mode: every game has a window of its own. */
export const gameWindowName = (eventId: string) => `${WINDOW_NAME}-${eventId}`;

/** A popup as large as the screen's usable area (not true fullscreen: only a click inside DAZN's page can do that). */
export function popupFeatures(): string {
  const { availLeft = 0, availTop = 0, availWidth, availHeight } = screen as Screen & { availLeft?: number; availTop?: number };
  return `popup=yes,left=${availLeft},top=${availTop},width=${availWidth},height=${availHeight}`;
}

/** A window we just created is still our own blank page, which we may read; a DAZN window is cross-origin and throws. */
function isFresh(w: Window): boolean {
  try {
    return w.location.href === 'about:blank';
  } catch {
    return false;
  }
}

const lastWatched = () => { try { return sessionStorage.getItem(LAST_KEY); } catch { return null; } };
const rememberWatched = (url: string) => { try { sessionStorage.setItem(LAST_KEY, url); } catch { /* the window just reloads next time */ } };

/**
 * Brings a named DAZN window to the front on this game, from a click. window.open('', name) finds an existing
 * window without reloading it (or makes a screen-sized one), and focusing right after is what browsers honour.
 * Default mode has one shared window, which is navigated only when it is new or showing another game, so a repeat
 * click just raises it. With an `eventId` (power mode) the game has its own window, which is navigated only when new.
 */
export function watchOnDazn(path: string, eventId?: string): WatchResult {
  const url = gameUrl(path);
  const target = window.open('', eventId ? gameWindowName(eventId) : WINDOW_NAME, popupFeatures());
  if (!target) return 'blocked';
  target.focus();
  if (isFresh(target) || (!eventId && lastWatched() !== url)) {
    target.location.replace(url);
    if (!eventId) rememberWatched(url);
  }
  return 'ok';
}
