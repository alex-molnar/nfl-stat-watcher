import { createStore } from './store';

export type Theme = 'light' | 'dark';

export const themeStore = createStore<Theme | null>({
  key: 'nflsw:v1:theme',
  fallback: () => null,
  isValid: (v): v is Theme | null => v === 'light' || v === 'dark' || v === null,
});

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  themeStore.set(theme);
}
