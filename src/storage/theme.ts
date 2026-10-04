import { createStore } from './store';

export type Theme = 'light' | 'dark';

export const themeStore = createStore<Theme | null>({
  key: 'nflsw:v1:theme',
  fallback: () => null,
  isValid: (v): v is Theme | null => v === 'light' || v === 'dark' || v === null,
});

// The effective theme is whatever data-theme says: the stored choice, else the OS preference.
const listeners = new Set<() => void>();
export const subscribeTheme = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const getEffectiveTheme = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  themeStore.set(theme);
  listeners.forEach((l) => l());
}

/** Follows OS theme changes until the user picks a theme. Returns a cleanup function. */
export function followSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mql = matchMedia('(prefers-color-scheme: dark)');
  const onChange = (e: { matches: boolean }) => {
    if (themeStore.get() !== null) return;
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    listeners.forEach((l) => l());
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
