import { createStore } from './store';

/** Whether opening Players or Vs re-syncs the starters of every league ESPN lets us read without signing in. Off by default. */
export const autoSyncStore = createStore<boolean>({
  key: 'nflsw:v1:autoSync',
  fallback: () => false,
  isValid: (value): value is boolean => typeof value === 'boolean',
});
