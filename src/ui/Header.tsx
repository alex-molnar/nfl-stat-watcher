import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

export function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="wrap top">
      <h1 className="brand">Stat Watch</h1>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>Players</NavLink>
        <NavLink to="/vs">Vs</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <ThemeToggle />
      {actions}
    </header>
  );
}
