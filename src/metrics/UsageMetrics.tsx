import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { onCLS, onINP, onLCP } from 'web-vitals';
import { followedStore } from '../storage/followed';
import { isPaused, subscribePause } from '../storage/pause';
import { useStore } from '../storage/useStore';
import type { Labels } from './events';
import { countingAllowed, track, trackBeat, trackVital } from './track';

const BEAT_MS = 60_000; // the collector counts a tab as active for 90 s after its last beat
const MAX_ERRORS = 5; // per page load, so one broken render loop cannot flood the counter

const ROUTES: Record<string, Labels<'page_view'>['route']> = { '/': 'players', '/vs': 'vs', '/leagues': 'leagues', '/settings': 'settings', '/privacy': 'privacy' };

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isVisible = () => document.visibilityState === 'visible';

/** Reports anonymous usage (see docs/metrics.md and the Privacy page): page loads and views, how fast and how broken the page is, and how many tabs are live syncing. Renders nothing. */
export function UsageMetrics() {
  const { pathname } = useLocation();
  const following = useStore(followedStore).length > 0;
  const paused = useSyncExternalStore(subscribePause, isPaused, isPaused);
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, () => true);
  const [tab] = useState(() => crypto.randomUUID()); // in memory only: never written anywhere, gone when the tab closes

  useEffect(() => track('visit'), []);

  useEffect(() => {
    const route = ROUTES[pathname];
    if (route) track('page_view', { route });
  }, [pathname]);

  useEffect(() => {
    if (!countingAllowed()) return;
    onLCP(({ value }) => trackVital('LCP', value));
    onINP(({ value }) => trackVital('INP', value));
    onCLS(({ value }) => trackVital('CLS', value));
    let errors = 0;
    const count = () => {
      if (errors++ < MAX_ERRORS) track('js_error');
    };
    window.addEventListener('error', count);
    window.addEventListener('unhandledrejection', count);
    return () => {
      window.removeEventListener('error', count);
      window.removeEventListener('unhandledrejection', count);
    };
  }, []);

  // Live syncing is on while the tab is on screen, updates are not paused and something is followed.
  const syncing = visible && !paused && following;
  useEffect(() => {
    if (!syncing) return;
    trackBeat(tab);
    const timer = setInterval(() => trackBeat(tab), BEAT_MS);
    return () => clearInterval(timer);
  }, [syncing, tab]);

  return null;
}
