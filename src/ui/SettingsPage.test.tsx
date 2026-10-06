import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mahomes, profilesFixture, warren } from '../test/data';
import { reloadAllStores } from '../storage/store';
import { renderAt, seed } from '../test/render';
import { readFileSync } from 'node:fs';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { daznEnabledStore, daznLinksStore } from '../storage/dazn';

const stored = () => localStorage.getItem('nflsw:v1:nameDisplay');
const radio = (name: string) => screen.getByRole('radio', { name });
const saveBtn = () => screen.queryByRole('button', { name: 'Save' });

describe('settings page', () => {
  it('offers Full, Initial and Formal, with Full selected by default', () => {
    renderAt('/settings');
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="name-display"]')].map((r) => r.labels?.[0]?.textContent)).toEqual(['Full', 'Initial', 'Formal']);
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

  describe('DAZN game links', () => {
    const html = readFileSync('src/test/fixtures/dazn-schedule.html', 'utf8');
    const routes = () => {
      const f = mockFetch({ scoreboard: scoreboardFixture, standings });
      const inner = f.getMockImplementation()!;
      f.mockImplementation(async (input) => (String(input).startsWith('/dazn/') ? new Response(html) : inner(input)));
      return f;
    };
    const dazn = () => screen.getByRole('checkbox', { name: 'Expose DAZN games' });
    const syncButton = () => screen.getByRole('button', { name: 'Sync game links with DAZN' });
    const daznCalls = (f: ReturnType<typeof routes>) => f.mock.calls.filter(([u]) => String(u).startsWith('/dazn/'));

    it('is off by default, requests nothing from DAZN, and is saved with Save', async () => {
      const f = routes();
      renderAt('/settings');
      expect(dazn()).not.toBeChecked();
      expect(daznCalls(f)).toHaveLength(0);
      await userEvent.click(dazn());
      expect(localStorage.getItem('nflsw:v1:daznEnabled')).toBe('false'); // still a working copy
      await userEvent.click(saveBtn()!);
      expect(localStorage.getItem('nflsw:v1:daznEnabled')).toBe('true');
    });

    it('marks the section as experimental, and warns about the DAZN login only while the box is ticked', async () => {
      routes();
      renderAt('/settings');
      expect(screen.getByText('Experimental, untested')).toBeInTheDocument();
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
      await userEvent.click(dazn());
      expect(screen.getByRole('note')).toHaveTextContent('games are synced anyway, but opening a game on DAZN will rely on you being logged in to DAZN');
      await userEvent.click(dazn());
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    describe('this week\'s games', () => {
      const box = () => screen.getByText("This week's games and their links").closest('details')!;
      const open = async () => {
        routes();
        renderAt('/settings');
        await userEvent.click(within(box()).getByText("This week's games and their links"));
        return (await within(box()).findByText('Steelers @ Browns')).closest('li')!;
      };

      it('is collapsed by default and asks for nothing until opened', () => {
        const f = routes();
        renderAt('/settings');
        expect(box()).not.toHaveAttribute('open');
        expect(f.mock.calls.filter(([u]) => String(u).includes('scoreboard'))).toHaveLength(0);
      });

      it('lists the week\'s games, with ended ones greyed and locked', async () => {
        const ended = await open();
        expect(within(ended).getByText('Ended')).toBeInTheDocument();
        expect(ended).toHaveClass('ended');
        expect(within(ended).getByLabelText('DAZN link for Steelers @ Browns')).toBeDisabled();
        expect(within(ended).getByRole('button', { name: 'Use this link' })).toBeDisabled();
        const upcoming = within(box()).getAllByRole('listitem').find((li) => li !== ended)!;
        expect(upcoming).not.toHaveClass('ended');
        expect(within(upcoming).getByRole('textbox')).toBeEnabled();
      });

      it('sets, shows and removes the user\'s own link, ahead of the one the sync found', async () => {
        daznLinksStore.set({ syncedAt: null, links: { '401872975': '/home/found/found' }, manual: {} });
        await open();
        const row = within(box()).getAllByRole('listitem').find((li) => !li.classList.contains('ended'))!;
        expect(within(row).getByText(/Found by the sync/)).toBeInTheDocument();
        await userEvent.type(within(row).getByRole('textbox'), 'https://www.dazn.com/en-NL/home/mine/mine');
        await userEvent.click(within(row).getByRole('button', { name: 'Use this link' }));
        expect(within(row).getByText(/Your link/)).toBeInTheDocument();
        expect(daznLinksStore.get().manual).toEqual({ '401872975': '/home/mine/mine' });
        await userEvent.click(within(row).getByRole('button', { name: 'Remove my link' }));
        expect(daznLinksStore.get().manual).toEqual({});
        expect(within(row).getByText(/Found by the sync/)).toBeInTheDocument();
      });

      it('rejects text that is not a DAZN game link', async () => {
        await open();
        const row = within(box()).getAllByRole('listitem').find((li) => !li.classList.contains('ended'))!;
        await userEvent.type(within(row).getByRole('textbox'), 'https://example.com/nope');
        await userEvent.click(within(row).getByRole('button', { name: 'Use this link' }));
        expect(within(row).getByRole('alert')).toHaveTextContent('not a DAZN game link');
        expect(daznLinksStore.get().manual).toEqual({});
      });
    });

    it('greys out the sync button and the window mode until the box is ticked, and shows the mode after the games list', async () => {
      routes();
      renderAt('/settings');
      expect(syncButton()).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Default' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Power mode' })).toBeDisabled();
      expect(screen.getByRole('radiogroup', { name: 'DAZN window mode' })).toHaveClass('off');
      const games = screen.getByText("This week's games and their links");
      expect(games.compareDocumentPosition(screen.getByRole('radiogroup', { name: 'DAZN window mode' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      await userEvent.click(dazn());
      expect(syncButton()).toBeEnabled();
      expect(screen.getByRole('radio', { name: 'Power mode' })).toBeEnabled();
      expect(screen.getByRole('radiogroup', { name: 'DAZN window mode' })).not.toHaveClass('off');
    });

    it('offers Default and Power mode, saved with Save', async () => {
      routes();
      renderAt('/settings');
      await userEvent.click(dazn());
      expect(screen.getByRole('radio', { name: 'Default' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Power mode' })).toHaveAccessibleDescription(/One window per live game/);
      await userEvent.click(screen.getByRole('radio', { name: 'Power mode' }));
      expect(localStorage.getItem('nflsw:v1:daznMode')).toBe('"default"'); // still a working copy
      await userEvent.click(saveBtn()!);
      expect(localStorage.getItem('nflsw:v1:daznMode')).toBe('"power"');
    });

    it('the button syncs through our own origin and says how many games were linked', async () => {
      const f = routes();
      renderAt('/settings');
      expect(screen.getByText('Not synced yet.')).toBeInTheDocument();
      await userEvent.click(dazn());
      await userEvent.click(syncButton());
      expect(await screen.findByText('Linked 1 of 2 games with DAZN.')).toBeInTheDocument();
      expect(daznCalls(f)).toHaveLength(1);
      expect(screen.getByText(/Last synced .*: 1 games linked\./)).toBeInTheDocument();
    });

    it('shows a failed sync in the status line', async () => {
      mockFetch({ '/dazn/': status(502) });
      renderAt('/settings');
      await userEvent.click(dazn());
      await userEvent.click(syncButton());
      expect(await screen.findByText('Could not sync with DAZN: DAZN answered 502.')).toBeInTheDocument();
    });

    it('syncs once when a page loads with the setting on, and never with it off', async () => {
      const off = routes();
      renderAt('/settings');
      expect(daznCalls(off)).toHaveLength(0);
      cleanup();
      daznEnabledStore.set(true);
      const on = routes();
      renderAt('/settings');
      await screen.findByText(/Last synced/);
      expect(daznCalls(on)).toHaveLength(1);
    });
  });
});
