import { CAMP_PROFILE_ID, campEntries, setSandbox } from '../espn/campSandbox';
import { DRILLS } from '../ui/campDrills';
import { newProfile, profilesStore } from './profiles';
import { campStore, type CampState } from './camp';
import { followedStore } from './followed';

/** In the last drill (the highlight drill) and after it, the Players page shows the practice players and nothing else. */
export const showsDummiesOnly = ({ phase, step }: CampState) => (phase === 'running' && step === DRILLS.length - 1) || phase === 'finished';

/** The practice league is there from when it was chosen (or drill 1 skipped) until the camp's congratulation is dismissed, and for the last drill in any case. */
const wanted = () => {
  const camp = campStore.get();
  return (camp.phase === 'running' && !!camp.practice) || showsDummiesOnly(camp);
};

/**
 * Keeps the camp's league in step with the camp: while the practice players are wanted, a "Practice league" holds the three fake players (stored like
 * any league, so every card and page treats them as real); at any other time none of it exists. Entries go before their league: an entry without
 * one would be handed to the user's first real league. Runs at startup too, which clears what a tab closed mid-drill left behind.
 */
export function syncCampLeague() {
  const entries = followedStore.get();
  const profiles = profilesStore.get();
  const hasLeague = profiles.some((p) => p.id === CAMP_PROFILE_ID);
  if (wanted()) {
    if (!hasLeague) profilesStore.set([...profiles, { ...newProfile('Practice league', profiles), id: CAMP_PROFILE_ID }]);
    if (!entries.some((e) => e.profileId === CAMP_PROFILE_ID)) followedStore.set([...entries, ...campEntries()]);
    setSandbox(true);
    return;
  }
  setSandbox(false);
  if (entries.some((e) => e.profileId === CAMP_PROFILE_ID)) followedStore.set(entries.filter((e) => e.profileId !== CAMP_PROFILE_ID));
  if (hasLeague) profilesStore.set(profiles.filter((p) => p.id !== CAMP_PROFILE_ID));
}

syncCampLeague();
// A moment later, not at once: `reloadAllStores` reloads the camp's state first, and acting before the other stores have reloaded would write their old contents back.
campStore.subscribe(() => queueMicrotask(syncCampLeague));
