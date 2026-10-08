import type { EventName, Labels, VitalName, Wire } from './events';

const ENDPOINT = '/api/e';

/** Counting is off in development and tests, and for a visitor whose browser says Do Not Track or Global Privacy Control. */
export function countingAllowed(): boolean {
  if (!import.meta.env.PROD) return false;
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack !== '1' && privacy.globalPrivacyControl !== true;
}

function send(wire: Wire) {
  if (!countingAllowed()) return;
  const body = JSON.stringify(wire);
  // sendBeacon survives the page closing; fetch with keepalive is the fallback where it is missing or refuses.
  if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  void fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
}

/** Counts one anonymous usage event. Never throws and never waits: the app does not depend on it. */
export const track = <E extends EventName>(event: E, labels?: Labels<E>) => send({ e: event, l: labels as Record<string, string> | undefined });

export const trackVital = (name: VitalName, value: number) => send({ e: 'vital', l: { name }, v: value });

/** Says this tab is open and live syncing. The id is random, lives in memory and is never stored. */
export const trackBeat = (id: string) => send({ e: 'beat', id });
