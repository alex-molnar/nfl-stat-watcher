import { createStore } from './store';

/** Whether private starter sync offers the bookmark setup instructions. */
export const bookmarkHelpStore = createStore<boolean>({
  key: 'nflsw:v1:bookmarkHelp',
  fallback: () => true,
  isValid: (value): value is boolean => typeof value === 'boolean',
});
