import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../test/render';

describe('app shell', () => {
  it('shows the app name and navigates to leagues and back', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Stat Watch', level: 1 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Leagues' }));
    expect(screen.getByRole('heading', { name: 'Scoring profiles' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    expect(screen.queryByRole('heading', { name: 'Scoring profiles' })).not.toBeInTheDocument();
  });

  it('sets a title per page', async () => {
    renderAt('/');
    expect(document.title).toBe('Players · Stat Watch');
    await userEvent.click(screen.getByRole('link', { name: 'Leagues' }));
    expect(document.title).toBe('Leagues · Stat Watch');
  });

  it('toggles and stores the theme', async () => {
    document.documentElement.dataset.theme = 'light';
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('nflsw:v1:theme')).toBe('"dark"');
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
  });

  it('does not move focus on first load, including the redirect from an unknown route', () => {
    renderAt('/leagues');
    expect(document.body).toHaveFocus();
  });

  it('does not move focus when an unknown route redirects on first load', () => {
    renderAt('/nope');
    expect(document.body).toHaveFocus();
  });

  it('moves focus to the page heading after a navigation', async () => {
    renderAt('/');
    expect(document.body).toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: 'Leagues' }));
    expect(screen.getByRole('heading', { name: 'Scoring profiles' })).toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    expect(screen.getByRole('heading', { name: 'Players' })).toHaveFocus();
  });

  it('redirects unknown routes to the main page', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { name: 'Stat Watch', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page');
  });

  it('links to the matchup page between Players and Leagues, with a title and focus on its heading', async () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Players', 'Vs Mode', 'Leagues', 'Settings']);
    await userEvent.click(within(nav).getByRole('link', { name: 'Vs Mode' }));
    expect(screen.getByRole('heading', { name: 'Matchup' })).toHaveFocus();
    expect(document.title).toBe('Matchup · Stat Watch');
    // Each page renders its own Header, so look the nav up again.
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Vs Mode' })).toHaveAttribute('aria-current', 'page');
  });
});
