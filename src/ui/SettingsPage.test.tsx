import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mahomes, profilesFixture, warren } from '../test/data';
import { reloadAllStores } from '../storage/store';
import { renderAt, seed } from '../test/render';

const stored = () => localStorage.getItem('nflsw:v1:nameDisplay');
const radio = (name: string) => screen.getByRole('radio', { name });
const saveBtn = () => screen.queryByRole('button', { name: 'Save' });

describe('settings page', () => {
  it('offers Full, Initial and Formal, with Full selected by default', () => {
    renderAt('/settings');
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Full', 'Initial', 'Formal']);
    expect(radio('Full')).toBeChecked();
    expect(saveBtn()).not.toBeInTheDocument();
  });

  it('explains the setting and shows an example for each mode', () => {
    renderAt('/settings');
    expect(screen.getByText('How player names are shown on cards and in lists.')).toBeInTheDocument();
    expect(radio('Full')).toHaveAccessibleDescription('e.g. David Montgomery');
    expect(radio('Initial')).toHaveAccessibleDescription('e.g. D. Montgomery');
    expect(radio('Formal')).toHaveAccessibleDescription('e.g. Montgomery, David');
  });

  it('keeps a change in a working copy until Save, then stores it', async () => {
    renderAt('/settings');
    await userEvent.click(radio('Formal'));
    expect(radio('Formal')).toBeChecked();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(stored()).toBe('"full"'); // the default written back by the store; not changed yet
    await userEvent.click(saveBtn()!);
    expect(stored()).toBe('"formal"');
    expect(saveBtn()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved settings.');
  });

  it('Cancel puts the saved mode back', async () => {
    renderAt('/settings');
    await userEvent.click(radio('Initial'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(radio('Full')).toBeChecked();
    expect(stored()).toBe('"full"');
    expect(saveBtn()).not.toBeInTheDocument();
  });

  it('shows the saved mode on the next visit', () => {
    localStorage.setItem('nflsw:v1:nameDisplay', '"initial"');
    reloadAllStores();
    renderAt('/settings');
    expect(radio('Initial')).toBeChecked();
  });

  it('falls back to Full when the stored value is not a mode', () => {
    localStorage.setItem('nflsw:v1:nameDisplay', '"shouty"');
    reloadAllStores();
    renderAt('/settings');
    expect(radio('Full')).toBeChecked();
  });

  describe('Clear my data', () => {
    const openConfirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Clear my data' }));
      return screen.getByRole('dialog', { name: 'Clear all your data?' });
    };

    it('warns first and changes nothing while the dialog is open or when kept', async () => {
      seed([warren], profilesFixture);
      renderAt('/settings');
      const dialog = await openConfirm();
      expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Keep my data' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(1);
    });

    it('colours Keep as the primary choice and Clear as the danger one', async () => {
      renderAt('/settings');
      const dialog = await openConfirm();
      expect(within(dialog).getByRole('button', { name: 'Keep my data' })).toHaveClass('btn-primary');
      expect(within(dialog).getByRole('button', { name: 'Clear my data' })).toHaveClass('btn-danger');
    });

    it('clears everything, resets the stores to defaults and drops an unsaved change', async () => {
      seed([warren, mahomes], profilesFixture);
      localStorage.setItem('nflsw:v1:nameDisplay', '"formal"');
      renderAt('/settings');
      await userEvent.click(radio('Initial'));
      const dialog = await openConfirm();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear my data' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(localStorage.getItem('nflsw:v1:followed')).toBe('[]'); // back to defaults, not the old entries
      expect(JSON.parse(localStorage.getItem('nflsw:v1:profiles')!)).toHaveLength(1);
      expect(radio('Full')).toBeChecked();
      expect(saveBtn()).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Your data was cleared.');
    });
  });
});
