import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../test/render';

describe('privacy page', () => {
  it.each(['/', '/vs', '/leagues', '/settings'])('is one click away from %s, in the footer', async (path) => {
    renderAt(path);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  it('opens from the footer, takes the focus and names the page', async () => {
    renderAt('/leagues');
    await userEvent.click(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Privacy' }));
    const heading = await screen.findByRole('heading', { level: 2, name: 'Privacy' });
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Privacy · Stat Watch');
  });

  it('says what is collected, what the other companies see and how to opt out', () => {
    renderAt('/privacy');
    const page = screen.getByRole('main');
    for (const heading of ['What stays in your browser', 'Anonymous usage counts', 'Server logs', 'Other companies', 'Your rights and contact']) {
      expect(within(page).getByRole('heading', { level: 3, name: heading })).toBeInTheDocument();
    }
    expect(page).toHaveTextContent('Do Not Track');
    expect(page).toHaveTextContent('Global Privacy Control');
    expect(page).toHaveTextContent('/api/e');
    expect(page).toHaveTextContent('ESPN');
    expect(page).toHaveTextContent('Google Fonts');
    expect(within(page).getByRole('link', { name: /github.com\/alex-molnar/ })).toHaveAttribute('href', 'https://github.com/alex-molnar/nfl-stat-watcher/issues');
  });
});
