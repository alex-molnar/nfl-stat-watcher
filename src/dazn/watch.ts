import { DAZN_REGION } from './links';

const WINDOW_NAME = 'stat-watch-dazn';
const LAST_KEY = 'nflsw:dazn:lastWatched'; // session only: the named window outlives a reload of this page, not the browser session

export type WatchResult = 'ok' | 'blocked';

/** A popup as large as the screen's usable area (not true fullscreen: only a click inside DAZN's page can do that). */
function features(): string {
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
 * Brings the one named DAZN window to the front on this game, from a click. window.open('', name) finds an existing
 * window without reloading it (or makes a screen-sized one), and focusing right after is what browsers honour.
 * The window is navigated only when it is new or showing another game, so a repeat click just raises it.
 */
export function watchOnDazn(path: string): WatchResult {
  const url = `https://www.dazn.com/${DAZN_REGION}${path}`;
  const target = window.open('', WINDOW_NAME, features());
  if (!target) return 'blocked';
  target.focus();
  if (isFresh(target) || lastWatched() !== url) {
    target.location.replace(url);
    rememberWatched(url);
  }
  return 'ok';
}
