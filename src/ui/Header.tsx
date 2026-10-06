import { useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { mascotEnabledStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { Mascot, SEAT_Y } from './Mascot';
import { ThemeToggle } from './ThemeToggle';

const SEAT_SIZE = 82; // px, the mascot's size when it sits on the edge
const WIDE = '(min-width: 1000px)';
const subscribeWide = (onChange: () => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isWide = () => typeof matchMedia === 'function' && matchMedia(WIDE).matches;

/**
 * Brand on the left (the title, then the mascot, unless the page is already showing one), then the page's own buttons, then the tabs and theme switch pinned to the right edge, so
 * they stay put however many page buttons there are.
 */
export function Header({ actions, pageMascot = false }: { actions?: ReactNode; /** The page shows its own mascot, so the header's steps aside. The page knows this when it renders, which a header could only learn too late. */ pageMascot?: boolean }) {
  const bar = useRef<HTMLElement>(null);
  const mascotOn = useStore(mascotEnabledStore);
  // On a wide screen the mascot sits on the bottom edge of the header with its legs hanging over it; on a narrower one it stands beside the title.
  const seated = useSyncExternalStore(subscribeWide, isWide, () => false);
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
        <h1 className="brand">
          Stat Watch
          {mascotOn && !pageMascot && (
            // The seat holds the space beside the title; the mascot is hung from the header's bottom edge by `--hang`, the part of the drawing below the body.
            <span className={`brand-seat${seated ? ' is-seated' : ''}`} style={{ '--seat': `${SEAT_SIZE}px`, '--hang': `${(SEAT_SIZE * (200 - SEAT_Y)) / 200}px` } as CSSProperties}>
              <Mascot size={seated ? SEAT_SIZE : 52} className="brand-mascot" entrance={false} seated={seated} />
            </span>
          )}
        </h1>
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
