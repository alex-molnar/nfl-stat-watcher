import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

/** The tab icon, drawn inline so it matches /favicon.svg. */
function Football() {
  return (
    <svg className="brand-ball" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#14532D" />
      <g transform="rotate(-35 32 32)">
        <ellipse cx="32" cy="32" rx="25" ry="15" fill="#9A4F24" />
        <path d="M12 26 Q9 32 12 38 M52 26 Q55 32 52 38 M22 32 H42 M26 27.5 V36.5 M32 27.5 V36.5 M38 27.5 V36.5" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Brand on the left, then the page's own buttons, then the tabs and theme switch pinned to the right edge, so
 * they stay put however many page buttons there are.
 */
export function Header({ actions }: { actions?: ReactNode }) {
  const bar = useRef<HTMLElement>(null);
  // The header is pinned to the top, so it publishes its height: other sticky parts and focus scrolling sit below it (WCAG 2.4.11).
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--header-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--header-h');
    };
  }, []);
  return (
    <header ref={bar} className="top-bar">
      <div className="wrap top">
        <h1 className="brand"><Football />Stat Watch</h1>
        {actions}
        <div className="top-end">
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Players</NavLink>
            <NavLink to="/vs">Vs Mode</NavLink>
            <NavLink to="/leagues">Leagues</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
