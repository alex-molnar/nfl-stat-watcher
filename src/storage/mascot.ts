import { createStore } from './store';

/** Whether the mascot is shown. Off, every page uses plain text instead (and the Leagues menu hints become tooltips). Saved from the Settings page. */
export const mascotEnabledStore = createStore<boolean>({
  key: 'nflsw:v1:mascot',
  fallback: () => true,
  isValid: (v): v is boolean => typeof v === 'boolean',
});

export const DEFAULT_MASCOT_NAME = 'Fumble';
export const MAX_MASCOT_NAME = 20;

/** What the mascot is called. Saved from the Settings page; a blank name is not kept, it goes back to the default. */
export const mascotNameStore = createStore<string>({
  key: 'nflsw:v1:mascotName',
  fallback: () => DEFAULT_MASCOT_NAME,
  isValid: (v): v is string => typeof v === 'string' && v.trim() !== '' && v.length <= MAX_MASCOT_NAME,
});
