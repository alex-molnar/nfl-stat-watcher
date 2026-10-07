import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mahomes, profilesFixture, warren } from '../test/data';
import { reloadAllStores } from '../storage/store';
import { renderAt, seed, declineCamp } from '../test/render';
import { DEFAULT_POSITION_ORDER } from '../stats/positionOrder';
import { positionOrderStore } from '../storage/positionOrder';

beforeEach(declineCamp);

const stored = () => localStorage.getItem('nflsw:v1:nameDisplay');
const radio = (name: string) => screen.getByRole('radio', { name });
const sidebar = () => screen.getByRole('complementary', { name: 'Settings categories' });
const saveBtn = () => within(sidebar()).queryByRole('button', { name: 'Save' });
const cancelBtn = () => within(sidebar()).getByRole('button', { name: 'Cancel' });
const pickCategory = (name: string) => fireEvent.click(within(sidebar()).getByRole('button', { name }));
function renderCategory(category = 'General') {
  const result = renderAt('/settings');
  pickCategory(category);
  return result;
}
const renderSettings = () => renderCategory();

describe('settings page', () => {
  describe('category sidebar', () => {
    it('defaults to General and shows the settings for the selected category', async () => {
      renderSettings();
      expect(within(sidebar()).getAllByRole('button').map((button) => button.textContent)).toEqual(['General', 'Position order', 'Site settings']);
      const general = within(sidebar()).getByRole('button', { name: 'General' });
      expect(general).toHaveAttribute('aria-current', 'true');
      expect(screen.getByRole('region', { name: 'General' })).toContainElement(radio('Full'));
      expect(screen.queryByRole('list', { name: 'Position order' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Show the mascot' })).not.toBeInTheDocument();
      await userEvent.click(within(sidebar()).getByRole('button', { name: 'Position order' }));
      expect(general).not.toHaveAttribute('aria-current');
      expect(screen.getByRole('region', { name: 'Position order' })).toContainElement(screen.getByRole('list', { name: 'Position order' }));
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      await userEvent.click(within(sidebar()).getByRole('button', { name: 'Site settings' }));
      const site = screen.getByRole('region', { name: 'Site settings' });
      expect(within(site).getByRole('checkbox', { name: 'Show the mascot' })).toBeInTheDocument();
      expect(within(site).getByRole('button', { name: 'Start rookie camp' })).toBeInTheDocument();
      expect(within(site).getByRole('button', { name: 'Clear my data' })).toBeInTheDocument();
      expect(saveBtn()).not.toBeInTheDocument();
    });

    it('keeps drafts when changing category and saves every changed category from the sidebar', async () => {
      renderSettings();
      await userEvent.click(radio('Formal'));
      await userEvent.click(within(sidebar()).getByRole('button', { name: 'Position order' }));
      await userEvent.click(screen.getByRole('button', { name: 'Move WR up' }));
      await userEvent.click(within(sidebar()).getByRole('button', { name: 'Site settings' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Show the mascot' }));
      expect(stored()).toBe('"full"');
      expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
      await userEvent.click(within(sidebar()).getByRole('button', { name: 'General' }));
      expect(radio('Formal')).toBeChecked();
      expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
      await userEvent.click(saveBtn()!);
      expect(stored()).toBe('"formal"');
      expect(positionOrderStore.get().slice(0, 3)).toEqual(['QB', 'WR', 'RB']);
      expect(localStorage.getItem('nflsw:v1:mascot')).toBe('false');
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });

    it('Cancel at the end of a category discards changes across categories', async () => {
      renderSettings();
      await userEvent.click(radio('Initial'));
      pickCategory('Position order');
      await userEvent.click(screen.getByRole('button', { name: 'Move RB up' }));
      const formActions = screen.getByRole('group', { name: 'Save or cancel changes, end of form' });
      await userEvent.click(within(formActions).getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Move QB up' })).toBeDisabled();
      pickCategory('General');
      expect(radio('Full')).toBeChecked();
      expect(saveBtn()).not.toBeInTheDocument();
    });
  });
  describe('position order', () => {
    const renderSettings = () => renderCategory('Position order');
    const positions = () => within(screen.getByRole('list', { name: 'Position order' })).getAllByRole('listitem').map((li) => li.querySelector('span')!.textContent);

    it('shows all nine positions in default order and disables moving past either end', () => {
      renderSettings();
      expect(positions()).toEqual(['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB', 'Team defenses']);
      expect(screen.getByRole('button', { name: 'Move QB up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move Team defenses down' })).toBeDisabled();
    });

    it('supports moving both ways, Cancel, Save and restoring the saved order on the next visit', async () => {
      const { unmount } = renderSettings();
      await userEvent.click(screen.getByRole('button', { name: 'Move WR up' }));
      expect(positions().slice(0, 3)).toEqual(['QB', 'WR', 'RB']);
      expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
      await userEvent.click(screen.getByRole('button', { name: 'Move WR down' }));
      expect(saveBtn()).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Move RB up' }));
      await userEvent.click(cancelBtn());
      expect(positions()[0]).toBe('QB');
      await userEvent.click(screen.getByRole('button', { name: 'Move WR up' }));
      await userEvent.click(saveBtn()!);
      expect(positionOrderStore.get().slice(0, 3)).toEqual(['QB', 'WR', 'RB']);
      unmount();
      reloadAllStores();
      renderSettings();
      expect(positions().slice(0, 3)).toEqual(['QB', 'WR', 'RB']);
    });

    it('resets a custom order only after Save', async () => {
      positionOrderStore.set([...DEFAULT_POSITION_ORDER].reverse());
      renderSettings();
      await userEvent.click(screen.getByRole('button', { name: 'Reset position order' }));
      expect(positions()[0]).toBe('QB');
      expect(positionOrderStore.get()[0]).toBe('D/ST');
      await userEvent.click(saveBtn()!);
      expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
    });

    describe('dragging positions', () => {
      const pointer = (target: Element, type: string, x: number, y: number, pointerType = 'mouse') => {
        const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
        Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType } });
        fireEvent(target, event);
      };
      function layout() {
        const list = screen.getByRole('list', { name: 'Position order' });
        const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 360, width: 360, height, x: 0, y: top, toJSON() {} });
        vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(0, 450));
        within(list).getAllByRole('listitem').forEach((row, index) => vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect(index * 50, 50)));
        return list;
      }
      function handle(position: string) {
        const button = screen.getByRole('button', { name: `Drag ${position} to reorder` });
        button.setPointerCapture = vi.fn();
        return button;
      }

      it('drags a position across multiple rows, previews the drop, then saves the draft', async () => {
        renderSettings();
        layout();
        const button = handle('QB');
        pointer(button, 'pointerdown', 20, 25);
        pointer(button, 'pointermove', 20, 190);
        expect(document.querySelector('.drop-before')).toHaveTextContent('K');
        expect(positions()).toEqual(['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB', 'Team defenses']); // preview only
        pointer(button, 'pointerup', 20, 190);
        expect(positions().slice(0, 4)).toEqual(['RB', 'WR', 'TE', 'QB']);
        expect(document.querySelector('.drop-before')).toBeNull();
        expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
        await userEvent.click(saveBtn()!);
        positionOrderStore.reload();
        expect(positionOrderStore.get().slice(0, 4)).toEqual(['RB', 'WR', 'TE', 'QB']);
      });

      it('supports touch dragging to the top, and Cancel restores the saved order', async () => {
        renderSettings();
        layout();
        const button = handle('Team defenses');
        pointer(button, 'pointerdown', 20, 425, 'touch');
        pointer(button, 'pointermove', 20, 5, 'touch');
        pointer(button, 'pointerup', 20, 5, 'touch');
        expect(positions()[0]).toBe('Team defenses');
        expect(new Set(positions()).size).toBe(9);
        await userEvent.click(cancelBtn());
        expect(positions()[0]).toBe('QB');
      });

      it('can drop at the bottom while preserving other unsaved settings', async () => {
        renderSettings();
        pickCategory('General');
        await userEvent.click(radio('Formal'));
        pickCategory('Position order');
        layout();
        const button = handle('QB');
        pointer(button, 'pointerdown', 20, 25);
        pointer(button, 'pointermove', 20, 445);
        expect(document.querySelector('.drop-after')).toHaveTextContent('Team defenses');
        pointer(button, 'pointerup', 20, 445);
        expect(positions().at(-1)).toBe('QB');
        pickCategory('General');
        expect(radio('Formal')).toBeChecked();
        await userEvent.click(saveBtn()!);
        expect(stored()).toBe('"formal"');
        expect(positionOrderStore.get().at(-1)).toBe('QB');
      });

      it.each(['pointercancel', 'lostpointercapture', 'escape', 'outside', 'click'])('leaves the draft unchanged after %s', (ending) => {
        renderSettings();
        layout();
        const button = handle('QB');
        pointer(button, 'pointerdown', 20, 25);
        if (ending !== 'click') pointer(button, 'pointermove', 20, 190);
        if (ending === 'escape') fireEvent.keyDown(button, { key: 'Escape' });
        else if (ending !== 'outside' && ending !== 'click') pointer(button, ending, 20, 190);
        pointer(button, 'pointerup', ending === 'outside' ? 400 : 20, ending === 'click' ? 25 : 190);
        expect(positions()[0]).toBe('QB');
        expect(saveBtn()).not.toBeInTheDocument();
        expect(document.querySelector('.drop-before')).toBeNull();
      });
    });
  });
  it('offers Full, Initial and Formal, with Full selected by default', () => {
    renderSettings();
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Full', 'Initial', 'Formal']);
    expect(radio('Full')).toBeChecked();
    expect(saveBtn()).not.toBeInTheDocument();
  });

  it('explains the setting and shows an example for each mode', () => {
    renderSettings();
    expect(screen.getByText('How player names are shown on cards and in lists.')).toBeInTheDocument();
    expect(radio('Full')).toHaveAccessibleDescription('e.g. David Montgomery');
    expect(radio('Initial')).toHaveAccessibleDescription('e.g. D. Montgomery');
    expect(radio('Formal')).toHaveAccessibleDescription('e.g. Montgomery, David');
  });

  it('keeps a change in a working copy until Save, then stores it', async () => {
    renderSettings();
    await userEvent.click(radio('Formal'));
    expect(radio('Formal')).toBeChecked();
    expect(within(sidebar()).getByText('Unsaved changes')).toBeInTheDocument();
    expect(stored()).toBe('"full"'); // the default written back by the store; not changed yet
    await userEvent.click(saveBtn()!);
    expect(stored()).toBe('"formal"');
    expect(saveBtn()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved settings.');
  });

  it('Cancel puts the saved mode back', async () => {
    renderSettings();
    await userEvent.click(radio('Initial'));
    await userEvent.click(cancelBtn());
    expect(radio('Full')).toBeChecked();
    expect(stored()).toBe('"full"');
    expect(saveBtn()).not.toBeInTheDocument();
  });

  it('shows the saved mode on the next visit', () => {
    localStorage.setItem('nflsw:v1:nameDisplay', '"initial"');
    reloadAllStores();
    renderSettings();
    expect(radio('Initial')).toBeChecked();
  });

  it('falls back to Full when the stored value is not a mode', () => {
    localStorage.setItem('nflsw:v1:nameDisplay', '"shouty"');
    reloadAllStores();
    renderSettings();
    expect(radio('Full')).toBeChecked();
  });

  describe('Clear my data', () => {
    const renderSettings = () => renderCategory('Site settings');
    const openConfirm = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Clear my data' }));
      return screen.getByRole('dialog', { name: 'Clear all your data?' });
    };

    it('warns first and changes nothing while the dialog is open or when kept', async () => {
      seed([warren], profilesFixture);
      renderSettings();
      const dialog = await openConfirm();
      expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Keep my data' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(1);
    });

    it('colours Keep as the primary choice and Clear as the danger one', async () => {
      renderSettings();
      const dialog = await openConfirm();
      expect(within(dialog).getByRole('button', { name: 'Keep my data' })).toHaveClass('btn-primary');
      expect(within(dialog).getByRole('button', { name: 'Clear my data' })).toHaveClass('btn-danger');
    });

    it('Clear my data keeps how far Rookie camp got, so the training camp is not offered again', async () => {
      localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'done', step: 0 }));
      reloadAllStores();
      renderSettings();
      await userEvent.click(within(await openConfirm()).getByRole('button', { name: 'Clear my data' }));
      expect(JSON.parse(localStorage.getItem('nflsw:v1:camp')!)).toEqual({ phase: 'done', step: 0 });
      expect(localStorage.getItem('nflsw:v1:followed')).toBe('[]'); // everything else is gone
    });

    it('clears everything, resets the stores to defaults and drops an unsaved change', async () => {
      seed([warren, mahomes], profilesFixture);
      localStorage.setItem('nflsw:v1:nameDisplay', '"formal"');
      renderSettings();
      pickCategory('General');
      await userEvent.click(radio('Initial'));
      pickCategory('Site settings');
      const dialog = await openConfirm();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Clear my data' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(localStorage.getItem('nflsw:v1:followed')).toBe('[]'); // back to defaults, not the old entries
      expect(JSON.parse(localStorage.getItem('nflsw:v1:profiles')!)).toEqual([]); // no league until the user adds one
      pickCategory('General');
      expect(radio('Full')).toBeChecked();
      expect(saveBtn()).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Your data was cleared.');
    });
  });

  describe('the mascot setting', () => {
    const renderSettings = () => renderCategory('Site settings');
    const box = () => screen.getByRole('checkbox', { name: 'Show the mascot' });

    it('is on by default and explained', () => {
      renderSettings();
      expect(box()).toBeChecked();
      expect(box()).toHaveAccessibleDescription(/plain text instead/);
    });

    it('is a working copy: Save stores it, Cancel puts it back', async () => {
      renderSettings();
      await userEvent.click(box());
      expect(box()).not.toBeChecked();
      expect(localStorage.getItem('nflsw:v1:mascot')).toBe('true'); // not saved yet
      expect(within(sidebar()).getByText('Unsaved changes')).toBeInTheDocument();
      await userEvent.click(cancelBtn());
      expect(box()).toBeChecked();
      await userEvent.click(box());
      await userEvent.click(saveBtn()!);
      expect(localStorage.getItem('nflsw:v1:mascot')).toBe('false');
    });

    it('is called Fumble unless you name it', async () => {
      renderSettings();
      const field = screen.getByRole('textbox', { name: 'Name' });
      expect(field).toHaveValue('Fumble');
      await userEvent.clear(field);
      await userEvent.type(field, 'Gridley');
      expect(localStorage.getItem('nflsw:v1:mascotName')).toBe('"Fumble"'); // a working copy until Save
      await userEvent.click(saveBtn()!);
      expect(localStorage.getItem('nflsw:v1:mascotName')).toBe('"Gridley"');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Gridley');
    });

    it('goes back to Fumble when the name is saved blank', async () => {
      localStorage.setItem('nflsw:v1:mascotName', JSON.stringify('Gridley'));
      reloadAllStores();
      renderSettings();
      await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
      await userEvent.click(saveBtn()!);
      expect(localStorage.getItem('nflsw:v1:mascotName')).toBe('"Fumble"');
    });

    it('takes the mascot out of the header at once when it is saved off', async () => {
      renderSettings();
      expect(document.querySelector('.brand .mascot')).not.toBeNull();
      await userEvent.click(box());
      expect(document.querySelector('.brand .mascot')).not.toBeNull(); // still a working copy
      await userEvent.click(saveBtn()!);
      expect(document.querySelector('.brand .mascot')).toBeNull();
    });
  });
});
