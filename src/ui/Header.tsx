import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Mascot } from './Mascot';
import { mascotsOnPage, subscribeMascots } from './mascotPresence';
import { ThemeToggle } from './ThemeToggle';

/**
 * Brand on the left (the title, then the mascot, unless the page is already showing one), then the page's own buttons, then the tabs and theme switch pinned to the right edge, so
 * they stay put however many page buttons there are.
 */
export function Header({ actions }: { actions?: ReactNode }) {
  const bar = useRef<HTMLElement>(null);
  const pageHasMascot = useSyncExternalStore(subscribeMascots, mascotsOnPage, mascotsOnPage) > 0;
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
        <h1 className="brand">Stat Watch{!pageHasMascot && <Mascot size={46} className="brand-mascot" entrance={false} />}</h1>
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
