import type { GameInfo } from '../stats/scoreboard';
import { gameUrl, gameWindowName, popupFeatures } from './watch';

const OPENED_KEY = 'nflsw:dazn:powerOpened'; // session only, like the windows themselves

/** Event ids whose window this browser session opened. */
export function readOpened(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(OPENED_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
export function writeOpened(ids: string[]) {
  try { sessionStorage.setItem(OPENED_KEY, JSON.stringify(ids)); } catch { /* the next page load asks again */ }
}

/**
 * What power mode should do now: offer the live games that have a link and no window yet (and were not turned down),
 * and close the windows of games that have ended.
 */
export function planPower(games: GameInfo[], pathOf: (eventId: string) => string | undefined, opened: ReadonlySet<string>, dismissed: ReadonlySet<string>) {
  return {
    offer: games.filter((game) => game.state === 'in' && pathOf(game.eventId) && !opened.has(game.eventId) && !dismissed.has(game.eventId)),
    close: games.filter((game) => game.state === 'post' && opened.has(game.eventId)).map((game) => game.eventId),
  };
}

/**
 * Opens a window per game, from one click. A browser normally lets one click open one popup, so what it blocks
 * comes back in `blocked` for the user to allow and retry. Our own window is focused again after each one, which
 * keeps the new windows behind where the browser honours it.
 */
export function openGameWindows(games: GameInfo[], pathOf: (eventId: string) => string | undefined): { opened: string[]; blocked: string[] } {
  const result = { opened: [] as string[], blocked: [] as string[] };
  for (const game of games) {
    const path = pathOf(game.eventId);
    const popup = path ? window.open(gameUrl(path), gameWindowName(game.eventId), popupFeatures()) : null;
    if (popup) {
      result.opened.push(game.eventId);
      window.focus();
    } else {
      result.blocked.push(game.eventId);
    }
  }
  return result;
}

/** Closes a game's window if there is one. Finding it by name makes a blank popup when the user already closed it, which is closed again at once. */
export function closeGameWindow(eventId: string) {
  window.open('', gameWindowName(eventId), popupFeatures())?.close();
}
