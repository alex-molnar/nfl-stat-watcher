import { CAMP_PROFILE_ID, sandboxOn } from '../espn/campSandbox';
import { profilesFixture, warren } from '../test/data';
import { campStore, endCamp } from './camp';
import { syncCampLeague } from './campLeague';
import { followedStore } from './followed';
import { profilesStore } from './profiles';
import { reloadAllStores } from './store';
import { DRILLS } from '../ui/campDrills';

const LAST = DRILLS.length - 1;
const camped = () => ({ league: profilesStore.get().some((p) => p.id === CAMP_PROFILE_ID), entries: followedStore.get().filter((e) => e.profileId === CAMP_PROFILE_ID).length });
const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve)); // the camp's league follows the camp a moment later

beforeEach(() => {
  localStorage.setItem('nflsw:v1:profiles', JSON.stringify(profilesFixture));
  localStorage.setItem('nflsw:v1:followed', JSON.stringify([warren]));
  reloadAllStores();
});

describe('the camp league', () => {
  it('holds three practice players from the last drill on, beside the user’s own league and players, which it leaves alone', async () => {
    campStore.set({ phase: 'running', step: LAST - 1, sub: 0 });
    await settle();
    expect(camped()).toEqual({ league: false, entries: 0 });
    expect(sandboxOn()).toBe(false);

    campStore.set({ phase: 'running', step: LAST, sub: 0 });
    await settle();
    expect(camped()).toEqual({ league: true, entries: 3 });
    expect(sandboxOn()).toBe(true);
    expect(profilesStore.get().filter((p) => p.id !== CAMP_PROFILE_ID).map((p) => p.id)).toEqual(profilesFixture.map((p) => p.id));
    expect(followedStore.get().filter((e) => e.profileId !== CAMP_PROFILE_ID)).toEqual([warren]);
  });

  it('stays through the congratulation and goes when the camp is left, done, or declined, with the user’s players still where they were', async () => {
    for (const end of [() => endCamp('declined'), () => endCamp('done')]) {
      campStore.set({ phase: 'finished', step: 0, sub: 0 });
      await settle();
      expect(camped()).toEqual({ league: true, entries: 3 }); // the highlights and the congratulation still need them
      end();
      await settle();
      expect(camped()).toEqual({ league: false, entries: 0 });
      expect(sandboxOn()).toBe(false);
      expect(followedStore.get()).toEqual([warren]); // none of them was handed to the user's league
    }
  });

  it('is gone from localStorage too, so nothing of it is left to export or to find', async () => {
    campStore.set({ phase: 'running', step: LAST, sub: 0 });
    await settle();
    expect(localStorage.getItem('nflsw:v1:followed')).toContain('camp-live-qb');
    endCamp('done');
    await settle();
    expect(localStorage.getItem('nflsw:v1:followed')).not.toContain('camp-');
    expect(localStorage.getItem('nflsw:v1:profiles')).not.toContain('camp-');
  });

  it('is cleared at startup when a tab was closed in the middle of the drill', async () => {
    campStore.set({ phase: 'running', step: LAST, sub: 0 });
    await settle();
    expect(camped().entries).toBe(3);
    localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'declined', step: 0, sub: 0 })); // the camp was left some other way
    campStore.reload(); // not through the store's own set
    syncCampLeague();
    expect(camped()).toEqual({ league: false, entries: 0 });
  });

  it('works for a user with no league at all, and leaves them with none afterwards', async () => {
    localStorage.clear();
    reloadAllStores();
    campStore.set({ phase: 'running', step: LAST, sub: 0 });
    await settle();
    expect(camped()).toEqual({ league: true, entries: 3 });
    endCamp('declined');
    await settle();
    expect(profilesStore.get()).toEqual([]);
    expect(followedStore.get()).toEqual([]);
  });
});
