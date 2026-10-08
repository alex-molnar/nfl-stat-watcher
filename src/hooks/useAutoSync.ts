import { useEffect } from 'react';
import { syncPublicLeagues } from '../leagues/autoSync';
import { autoSyncStore } from '../storage/autoSync';
import type { Side } from '../storage/followed';
import { useStore } from '../storage/useStore';
import { useTeams } from './queries';

/** With "Sync public leagues automatically" on, re-syncs the given sides when the page that calls it opens. */
export function useAutoSync(sides: Side[]) {
  const enabled = useStore(autoSyncStore);
  const teams = useTeams().data;
  const key = sides.join();
  useEffect(() => {
    if (!enabled || !teams) return;
    const controller = new AbortController();
    void syncPublicLeagues(key.split(',') as Side[], teams, controller.signal);
    return () => controller.abort();
  }, [enabled, teams, key]);
}
