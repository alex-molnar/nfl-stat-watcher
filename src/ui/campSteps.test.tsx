import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { campStore } from '../storage/camp';
import { profilesStore } from '../storage/profiles';
import { reloadAllStores } from '../storage/store';
import standings from '../test/fixtures/standings.json';
import { profilesFixture, scoreboardFixture } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import { DRILLS, type Drill } from './campDrills';
import { union } from './RookieCamp';

const camp = () => screen.getByRole('region', { name: 'Rookie camp' });
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:camp') ?? 'null');
const setCamp = (phase: string, step = 0, sub = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase, step, sub }));
  reloadAllStores();
};
const next = () => within(camp()).getByRole('button', { name: /^(Next|Complete drill)$/ });

describe('rookie camp steps', () => {
  describe('the engine', () => {
    // A drill of its own on the last place of the list, made of the page's header, so each piece can be tried alone.
    const drill = (steps: Drill['steps']) => { DRILLS.push({ steps }); return DRILLS.length - 1; };
    afterEach(() => { DRILLS.length = 4; });
    const step = { target: ['header'], text: 'Look at the header.' };

    it('has a Next button before Skip drill and Leave camp, and Complete drill on the last step', async () => {
      const at = drill([{ ...step, next: 'Next' }, { ...step, text: 'And again.', next: 'Next' }]);
      seed([], profilesFixture);
      setCamp('running', at);
      renderAt('/');
      expect(within(camp()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Next', 'Skip drill', 'Leave camp']);
      await userEvent.click(next());
      expect(stored()).toEqual({ phase: 'running', step: at, sub: 1 });
      expect(camp()).toHaveTextContent('And again.');
      expect(next()).toHaveTextContent('Complete drill');
      await userEvent.click(next());
      expect(stored()).toEqual({ phase: 'finished', step: 0, sub: 0 }); // the last drill of the list: the congratulation
    });

    it('moves on by itself when a step is done by the page (a `when`), and passes over a step that says so (`skipIf`)', async () => {
      let ready = false;
      const at = drill([{ ...step, skipIf: () => true }, { ...step, text: 'Wait for it.', when: () => ready }, { ...step, text: 'Done.', next: 'Next' }]);
      seed([], profilesFixture);
      setCamp('running', at);
      renderAt('/');
      await waitFor(() => expect(camp()).toHaveTextContent('Wait for it.'));
      expect(stored()).toMatchObject({ sub: 1 });
      ready = true;
      await waitFor(() => expect(camp()).toHaveTextContent('Done.'), { timeout: 1500 });
    });

    it('passes over an optional step whose control never comes, and steps back from a step whose control has gone', async () => {
      const at = drill([{ ...step, next: 'Next', text: 'First.' }, { target: ['#never'], text: 'Gone.' }]);
      seed([], profilesFixture);
      setCamp('running', at, 1);
      renderAt('/');
      await waitFor(() => expect(camp()).toHaveTextContent('First.'), { timeout: 2000 }); // back from the step whose control is not there
      DRILLS[at] = { steps: [{ target: ['#never'], optional: true, text: 'Maybe.' }, { ...step, text: 'After.', next: 'Next' }] };
      act(() => setCamp('running', at, 0));
      await waitFor(() => expect(camp()).toHaveTextContent('After.'), { timeout: 2000 }); // on, because it was optional
    });

    it('rings the union of what a step points at, and the card follows it', () => {
      const rects: Record<string, DOMRect> = {
        '[data-camp="add-dialog-search"]': { left: 100, top: 200, right: 300, bottom: 240, width: 200, height: 40 } as DOMRect,
        '[data-camp="add-dialog-league"]': { left: 100, top: 260, right: 300, bottom: 300, width: 200, height: 40 } as DOMRect,
      };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const key = this.getAttribute('data-camp');
        return rects[`[data-camp="${key}"]`] ?? ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect);
      });
      seed([], profilesFixture);
      setCamp('running', 1, 1);
      // the dialog is closed, so what is in it is not on the page yet: no ring until it opens
      renderAt('/');
      expect(document.querySelector('.camp-ring')).toBeNull();
      const a = rects['[data-camp="add-dialog-search"]']!;
      const b = rects['[data-camp="add-dialog-league"]']!;
      expect(union(a, b)).toMatchObject({ left: 100, top: 200, right: 300, bottom: 300, width: 200, height: 100 });
    });

    it('keeps its progress in the store, and a state saved before steps existed starts the drill from its first step', () => {
      localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'running', step: 1 }));
      reloadAllStores();
      expect(campStore.get()).toEqual({ phase: 'running', step: 1, sub: 0 });
      localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'running', step: 1, sub: -3 }));
      reloadAllStores();
      expect(campStore.get()).toEqual({ phase: 'idle', step: 0, sub: 0 }); // invalid: the default
      localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'running', step: 2, sub: 4 }));
      reloadAllStores();
      expect(campStore.get()).toEqual({ phase: 'running', step: 2, sub: 4 });
    });
  });

  describe('drill 1: a league, step by step', () => {
    it('goes through the editor, and ends when the league is saved', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
      expect(camp()).toHaveTextContent('Give it a name'); // name
      await userEvent.click(next());
      expect(camp()).toHaveTextContent('Pick a color');
      await userEvent.click(next());
      expect(camp()).toHaveTextContent('Start from a preset');
      await userEvent.selectOptions(screen.getByLabelText('Preset'), 'half'); // picking one is enough
      await waitFor(() => expect(camp()).toHaveTextContent('Press Apply preset'));
      await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Every rule is a number')); // first setting
      await userEvent.click(next());
      expect(camp()).toHaveTextContent('switched off with its checkbox');
      await userEvent.click(next());
      expect(camp()).toHaveTextContent('Press Save');
      expect(within(camp()).queryByRole('button', { name: /^Next$/ })).toBeNull(); // saving is what ends it
      await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);
      expect(profilesStore.get()).toHaveLength(1);
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0 });
      expect(camp()).toHaveTextContent('Second drill');
    });

    it('lets the user type in the name field and nothing else of the page while the step waits', async () => {
      setCamp('running', 0, 1);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Add a league' })); // swallowed: not what the step points at
      expect(camp()).toHaveTextContent('Give it a name');
      expect(profilesStore.get()).toHaveLength(0);
    });
  });

  describe('drill 2: following a player, step by step', () => {
    const maye = { athlete: { id: '4431452', displayName: 'Drake Maye', jersey: '10', position: { abbreviation: 'QB' }, team: { id: '17', abbreviation: 'NE' } } };

    it('opens the dialog, shows the fields, finds Maye, adds him and closes the dialog, with the card inside the dialog', async () => {
      mockFetch({ scoreboard: scoreboardFixture, 'search?query=Maye': { items: [{ id: '4431452', displayName: 'Drake Maye', league: 'nfl' }] }, 'athletes/4431452': maye, standings });
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      expect(camp()).toHaveTextContent('Press Add player');
      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Add player' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Search for a player'));
      expect(camp()).toHaveTextContent('Leagues matter because each one scores differently');
      expect(camp()).toHaveTextContent('Maye');
      await waitFor(() => expect(camp().closest('dialog')).not.toBeNull()); // a modal dialog blocks what is outside it, so the card is in it

      await userEvent.click(screen.getByRole('button', { name: 'Close' })); // not what the step is about: swallowed
      expect(document.querySelector('dialog[open]')).not.toBeNull();

      await userEvent.type(screen.getByLabelText('Search'), 'Maye');
      await waitFor(() => expect(camp()).toHaveTextContent('There he is, Drake Maye'), { timeout: 3000 });
      await userEvent.click(await screen.findByRole('button', { name: 'Add Drake Maye, NE QB' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Close the dialog with the X'));
      expect(camp()).toHaveTextContent('click anywhere outside it');
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Third drill'));
      expect(stored()).toEqual({ phase: 'running', step: 2, sub: 0 });
    });

    it('swallows a click on the area around the dialog, except in the step about closing it', async () => {
      mockFetch({ scoreboard: scoreboardFixture, standings });
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Add player' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Search for a player'));
      const dialog = document.querySelector('dialog')!;
      await userEvent.click(dialog); // the backdrop: swallowed
      expect(dialog).toHaveAttribute('open');
      act(() => setCamp('running', 1, 3));
      await waitFor(() => expect(camp()).toHaveTextContent('Close the dialog with the X'));
      await userEvent.click(dialog); // now it is what the step asks for
      expect(dialog).not.toHaveAttribute('open');
    });

    it('is not skipped after a practice league: the user still does it', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      expect(camp()).toHaveTextContent('Second drill');
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0 });
    });

    it('goes back to the step that opens the dialog when the dialog is closed with Escape', async () => {
      mockFetch({ scoreboard: scoreboardFixture, standings });
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Add player' }));
      await waitFor(() => expect(camp()).toHaveTextContent('Search for a player'));
      await act(async () => { document.querySelector('dialog')!.close(); }); // what Escape does
      await waitFor(() => expect(camp()).toHaveTextContent('Press Add player'), { timeout: 2000 });
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0 });
    });
  });
});
