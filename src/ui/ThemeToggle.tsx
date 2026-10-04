import { setTheme, themeStore } from '../storage/theme';
import { useStore } from '../storage/useStore';

export function ThemeToggle() {
  useStore(themeStore); // re-render when the theme changes
  const dark = document.documentElement.dataset.theme === 'dark';
  return (
    <button type="button" className="btn press" onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
