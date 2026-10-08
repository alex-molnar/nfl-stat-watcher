import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { applyLanguage } from '../i18n';
import { declineCamp, renderAt } from '../test/render';

beforeEach(declineCamp);

const stored = () => localStorage.getItem('nflsw:v1:language');
const radio = (name: string) => screen.getByRole('radio', { name });
function openLanguage() {
  renderAt('/settings');
  fireEvent.click(within(screen.getByRole('complementary', { name: 'Settings categories' })).getByRole('button', { name: 'Site settings' }));
}
const save = () => userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

describe('language setting', () => {
  it('offers Automatic, English and Magyar with Automatic selected, and says what Automatic does', () => {
    openLanguage();
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Automatic', 'English', 'Magyar']);
    expect(radio('Automatic')).toBeChecked();
    expect(radio('Automatic')).toHaveAccessibleDescription("Uses your browser's language if the site has it, English otherwise.");
  });

  it('keeps English until Save, then switches the page, the notice and <html lang>', async () => {
    openLanguage();
    await userEvent.click(radio('Magyar'));
    expect(screen.getByRole('heading', { name: 'Site settings' })).toBeInTheDocument();
    expect(stored()).not.toBe('"hu"');
    expect(document.documentElement.lang).not.toBe('hu');
    await save();
    expect(await screen.findByRole('heading', { name: 'Oldalbeállítások' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('A beállítások mentve.');
    expect(document.documentElement.lang).toBe('hu');
    expect(stored()).toBe('"hu"');
    expect(radio('Magyar')).toBeChecked();
    expect(document.title).toBe('Beállítások · Stat Watch');
  });

  it('Cancel reverts the choice', async () => {
    openLanguage();
    await userEvent.click(radio('Magyar'));
    await userEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Cancel' }));
    expect(radio('Automatic')).toBeChecked();
    expect(stored()).not.toBe('"hu"');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('counts as an unsaved change for the browser warning', async () => {
    openLanguage();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await userEvent.click(radio('English'));
    const warned = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(warned);
    expect(warned.defaultPrevented).toBe(true);
  });

  it('Automatic follows the browser language list', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'hu-HU', 'en']);
    await applyLanguage();
    renderAt('/settings');
    expect(await screen.findByRole('heading', { name: 'Beállítások' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hu');
    fireEvent.click(screen.getByRole('button', { name: 'Oldalbeállítások' }));
    expect(screen.getByRole('radio', { name: 'Automatikus' })).toBeChecked();
  });

  it('Automatic stays English when the browser has no language the site has', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'fr']);
    await applyLanguage();
    renderAt('/settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
