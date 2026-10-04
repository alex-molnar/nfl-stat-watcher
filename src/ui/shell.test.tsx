import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../test/render';

describe('app shell', () => {
  it('shows the app name and navigates to settings and back', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Stat Watch', level: 1 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Scoring profiles' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    expect(screen.queryByRole('heading', { name: 'Scoring profiles' })).not.toBeInTheDocument();
  });

  it('toggles and stores the theme', async () => {
    document.documentElement.dataset.theme = 'light';
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('nflsw:v1:theme')).toBe('"dark"');
    expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
  });
});
