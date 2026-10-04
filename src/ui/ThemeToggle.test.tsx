import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { followSystemTheme } from '../storage/theme';
import { ThemeToggle } from './ThemeToggle';

function mockOs(initialDark: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null;
  vi.stubGlobal('matchMedia', () => ({
    matches: initialDark,
    addEventListener: (_: string, l: typeof listener) => { listener = l; },
    removeEventListener: () => { listener = null; },
  }));
  return (dark: boolean) => act(() => listener?.({ matches: dark }));
}

describe('ThemeToggle with the OS theme', () => {
  it('relabels after an OS change and the first click flips to the opposite theme', async () => {
    document.documentElement.dataset.theme = 'light';
    const osChange = mockOs(false);
    const stop = followSystemTheme();
    try {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeInTheDocument();

    osChange(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    const btn = screen.getByRole('button', { name: 'Light mode' });

    await userEvent.click(btn);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('nflsw:v1:theme')).toBe('"light"');
    expect(screen.getByRole('button', { name: 'Dark mode' })).toBeInTheDocument();
    } finally {
      stop();
    }
  });

  it('ignores OS changes once the user has chosen a theme', async () => {
    document.documentElement.dataset.theme = 'light';
    const osChange = mockOs(false);
    const stop = followSystemTheme();
    try {
      render(<ThemeToggle />);
      await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
      osChange(false);
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
    } finally {
      stop();
    }
  });
});
