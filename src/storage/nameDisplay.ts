import { createStore } from './store';

export const NAME_DISPLAY_MODES = ['full', 'initial', 'formal'] as const;
export type NameDisplayMode = (typeof NAME_DISPLAY_MODES)[number];

/** How player names are shown, for David Montgomery: full "David Montgomery", initial "D. Montgomery", formal "Montgomery, David". Saved from the Settings page; `displayName` (ui/format.ts) applies it. */
export const nameDisplayStore = createStore<NameDisplayMode>({
  key: 'nflsw:v1:nameDisplay',
  fallback: () => 'full',
  isValid: (v): v is NameDisplayMode => (NAME_DISPLAY_MODES as readonly unknown[]).includes(v),
});
