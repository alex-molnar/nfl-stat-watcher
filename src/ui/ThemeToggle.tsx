import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getEffectiveTheme, setTheme, subscribeTheme } from '../storage/theme';

// The accessible name states the action and always follows the effective theme, so it never lies.
export function ThemeToggle() {
  const { t } = useTranslation();
  const dark = useSyncExternalStore(subscribeTheme, getEffectiveTheme, () => 'light') === 'dark';
  return (
    <button type="button" className={`theme-toggle press${dark ? ' is-dark' : ''}`} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t(($) => $.shell.theme.light) : t(($) => $.shell.theme.dark)}>
      <svg className="tt-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <svg className="tt-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor" />
      </svg>
      <span className="tt-thumb" aria-hidden="true" />
    </button>
  );
}
