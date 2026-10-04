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

/** Follows OS theme changes until the user picks a theme. Returns a cleanup function. */
export function followSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mql = matchMedia('(prefers-color-scheme: dark)');
  const onChange = (e: { matches: boolean }) => {
    if (themeStore.get() === null) document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
