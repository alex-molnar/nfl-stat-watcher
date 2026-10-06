import { createStore } from './store';

/** Whether the mascot is shown. Off, every page uses plain text instead (and the Leagues menu hints become tooltips). Saved from the Settings page. */
export const mascotEnabledStore = createStore<boolean>({
  key: 'nflsw:v1:mascot',
  fallback: () => true,
  isValid: (v): v is boolean => typeof v === 'boolean',
});
