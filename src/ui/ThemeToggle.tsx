import { useSyncExternalStore } from 'react';
import { getEffectiveTheme, setTheme, subscribeTheme } from '../storage/theme';

// The label names the action and always follows the effective theme, so it never lies.
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, getEffectiveTheme, () => 'light') === 'dark';
  return (
    <button type="button" className="btn press" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
