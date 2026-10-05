import { useEffect, useRef } from 'react';
import { syncDaznLinks } from '../dazn/links';
import { daznEnabledStore } from '../storage/dazn';

/** With the DAZN setting on, syncs once per page load (not periodically). Renders nothing. */
export function DaznAutoSync() {
  const started = useRef(false); // StrictMode runs effects twice on mount; the ref survives that
  useEffect(() => {
    if (started.current || !daznEnabledStore.get()) return;
    started.current = true;
    syncDaznLinks().catch((cause: unknown) => console.warn('Stat Watch: DAZN sync failed', cause));
  }, []);
  return null;
}
