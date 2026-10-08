import { screen } from '@testing-library/react';
import { inHungarian, renderAt } from '../test/render';

describe('privacy page in Hungarian', () => {
  it('shows the title, date and all five sections', async () => {
    await inHungarian();
    renderAt('/privacy');
    expect(await screen.findByRole('heading', { level: 2, name: 'Adatvédelem' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Ami a böngésződben marad',
      'Névtelen használati számlálók',
      'Szervernaplók',
      'Más cégek',
      'Jogaid és kapcsolat',
    ]);
    expect(screen.getByText(/Utolsó frissítés: 2026\. október 8\./)).toBeInTheDocument();
    expect(document.title).toBe('Adatvédelem · Stat Watch');
  });

  it('keeps the code, bold names and the GitHub link', async () => {
    await inHungarian();
    renderAt('/privacy');
    expect((await screen.findByText('/api/e')).tagName).toBe('CODE');
    expect(screen.getByText('ESPN.').tagName).toBe('STRONG');
    expect(screen.getByText('Google Fonts.').tagName).toBe('STRONG');
    const link = screen.getByRole('link', { name: 'github.com/alex-molnar/nfl-stat-watcher' });
    expect(link).toHaveAttribute('href', 'https://github.com/alex-molnar/nfl-stat-watcher/issues');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
