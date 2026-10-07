import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warren, profilesFixture } from '../test/data';
import { vi } from 'vitest';
import { reloadAllStores } from '../storage/store';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import { campStore, endCamp } from '../storage/camp';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { mascotEnabledStore } from '../storage/mascot';
import { placeCard, union } from './RookieCamp';
import { registerOpenDialog } from './dialogsOpen';

const camp = () => screen.getByRole('region', { name: 'Rookie camp' });
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:camp') ?? 'null');
const setCamp = (phase: string, step = 0, sub = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase, step, sub }));
  reloadAllStores();
};
const ring = () => document.querySelector('.camp-ring');
// The welcome dialog opens a moment after the page has loaded.
const welcomeEl = () => document.querySelector('dialog[aria-labelledby="welcome-title"]');
const finishEl = () => document.querySelector('dialog[aria-labelledby="finish-title"]');
const welcome = () => screen.findByRole('dialog', { name: /^Hi, I/ }, { timeout: 3000 });

describe('placeCard', () => {
  const rect = (left: number, top: number, w = 100, h = 30) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;

  it('sits in the bottom corner when there is nothing to point at', () => {
    expect(placeCard(null, 1000, 800)).toEqual({ left: 1000 - 340 - 12, bottom: 12, width: 340 });
  });

  it('sits below the control, lined up with it and kept on screen', () => {
    expect(placeCard(rect(50, 100), 1000, 800)).toEqual({ left: 50, top: 198, width: 340 }); // in the header
    expect(placeCard(rect(950, 100), 1000, 800).left).toBe(1000 - 340 - 12);
  });

  it('goes to the right of a small control in the page, so it does not cover the ones under it', () => {
    expect(placeCard(rect(50, 200, 200, 40), 1000, 800)).toEqual({ left: 264, top: 200, width: 340 });
    expect(placeCard(rect(50, 700, 200, 40), 1000, 800)).toEqual({ left: 264, top: 800 - 190 - 12, width: 340 });
    expect(placeCard(rect(50, 200, 200, 40), 500, 800).bottom).toBe(12); // not on a narrow screen
    expect(placeCard(rect(50, 200, 700, 40), 1100, 800).top).toBe(200 + 40 + 14 + 54); // a wide row: below it
  });

  it('goes above the control when there is no room below, and shrinks on a narrow screen', () => {
    expect(placeCard(rect(50, 700, 400), 1000, 800)).toEqual({ left: 50, bottom: 114, width: 340 });
    expect(placeCard(null, 300, 600).width).toBe(276);
  });

  it('stays at the bottom on a narrow screen, so it never covers the controls around the one it points at', () => {
    expect(placeCard(rect(50, 100), 500, 800)).toEqual({ left: 12, bottom: 12, width: 476 });
  });
});

describe('rookie camp', () => {
  describe('the welcome', () => {
    it('is a dialog from the mascot, shown after a moment to a user with no league, and Skip is remembered', async () => {
      const { unmount } = renderAt('/');
      expect(welcomeEl()).not.toHaveAttribute('open'); // not slammed in with the page
      const dialog = await welcome();
      expect(dialog).toHaveAccessibleName('Hi, I’m Fumble!');
      expect(dialog).toHaveAccessibleDescription(/football in glasses.*training camp/);
      expect(within(dialog).getByRole('button', { name: 'Enter training camp' })).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Skip' }));
      expect(welcomeEl()).toBeNull();
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
      expect(stored()).toEqual({ phase: 'declined', step: 0, sub: 0 });
      unmount();
      renderAt('/');
      expect(welcomeEl()).toBeNull();
    });

    it('treats Escape as Skip', async () => {
      renderAt('/');
      const dialog = await welcome();
      await act(async () => { (dialog as HTMLDialogElement).close(); }); // what the browser does on Escape
      expect(stored()).toEqual({ phase: 'declined', step: 0, sub: 0 });
      expect(welcomeEl()).toBeNull();
    });

    it('starts the first drill when entering the camp, and the dialog is gone', async () => {
      renderAt('/');
      await userEvent.click(within(await welcome()).getByRole('button', { name: 'Enter training camp' }));
      expect(stored()).toEqual({ phase: 'running', step: 0, sub: 0 });
      expect(welcomeEl()).toBeNull();
      expect(camp()).toHaveTextContent('First drill: a league');
    });

    it('has Enter training camp first, so it takes the focus, and a hint for each button from the mascot', async () => {
      renderAt('/');
      const dialog = await welcome();
      expect(dialog.querySelector('button')).toHaveTextContent('Enter training camp');
      expect(within(dialog).getByRole('button', { name: 'Skip' })).toHaveAttribute('data-hint', 'You can start it later from Settings.');
      expect(within(dialog).getByRole('button', { name: 'Skip and disable Fumble' })).toHaveAttribute('data-hint', 'Turns me off. You can switch me back on in Settings.');
    });

    it('has exactly three buttons, no practice league yet, and tells the user Fumble can be turned off in Settings', async () => {
      renderAt('/');
      const dialog = await welcome();
      expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Enter training camp', 'Skip', 'Skip and disable Fumble']);
      expect(dialog).toHaveAccessibleDescription(/turn me off at any point in Settings/);
    });

    it('turns the mascot off for good with Skip and disable, and the answer is remembered', async () => {
      renderAt('/');
      await userEvent.click(within(await welcome()).getByRole('button', { name: 'Skip and disable Fumble' }));
      expect(stored()).toEqual({ phase: 'declined', step: 0, sub: 0 });
      expect(mascotEnabledStore.get()).toBe(false);
      expect(localStorage.getItem('nflsw:v1:mascot')).toBe('false');
      expect(document.querySelector('.mascot')).toBeNull();
      expect(document.querySelector('dialog[open]')).toBeNull();
    });

    it('is not made to a user who already has a league', () => {
      seed([], profilesFixture);
      renderAt('/');
      expect(welcomeEl()).toBeNull();
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
    });

    it('is not made, and cannot be started from Settings, with the mascot off', async () => {
      localStorage.setItem('nflsw:v1:mascot', 'false');
      reloadAllStores();
      renderAt('/settings');
      await userEvent.click(screen.getByRole('button', { name: 'Site settings' }));
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start rookie camp' })).toBeDisabled();
    });

    it('uses the name given to the mascot', async () => {
      localStorage.setItem('nflsw:v1:mascotName', JSON.stringify('Gridley'));
      reloadAllStores();
      renderAt('/');
      expect(await welcome()).toHaveAccessibleName('Hi, I’m Gridley!');
    });
  });

  describe('the drills', () => {
    it('start from the welcome and point at the Leagues tab while the user is elsewhere', async () => {
      renderAt('/');
      await userEvent.click(within(await welcome()).getByRole('button', { name: 'Enter training camp' }));
      expect(stored()).toEqual({ phase: 'running', step: 0, sub: 0 });
      expect(camp()).toHaveTextContent('First drill: a league. Open Leagues');
      expect(camp()).toHaveTextContent('drill 1 of 6');
      expect(ring()).not.toBeNull();
    });

    it('ask for the Add a league button on the Leagues page, and go on to the editor once it is pressed', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      expect(camp()).toHaveTextContent('Press Add a league');
      await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
      expect(stored()).toEqual({ phase: 'running', step: 0, sub: 1 });
      expect(camp()).toHaveTextContent('Give it a name');
    });

    it('lets nothing else be pressed while a drill waits: only its control, the other way to do it, and the camp card', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      expect(camp()).toHaveTextContent('Press Add a league');
      await userEvent.click(screen.getByRole('button', { name: 'Import StatWatch profile' }));
      expect(screen.queryByRole('dialog', { name: /profile/i })).toBeNull(); // swallowed
      await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
      expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull(); // did not navigate
      await userEvent.click(within(camp()).getByRole('button', { name: 'Skip drill' })); // the card still works
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0, practice: true }); // skipping the league drill chooses the practice league
    });

    it('keeps Import leagues out of the league drill: it is a drill of its own', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
      expect(screen.queryByRole('dialog', { name: /import/i })).toBeNull(); // swallowed
    });

    it('do not pass over a drill because the state already satisfies it: the user does the steps', () => {
      seed([warren], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      expect(camp()).toHaveTextContent('Press Add player');
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0 });
    });

    it('ask for Vs Mode, and move on when it is opened', async () => {
      seed([warren], profilesFixture);
      setCamp('running', 2);
      renderAt('/');
      expect(camp()).toHaveTextContent('Third drill');
      await userEvent.click(screen.getByRole('link', { name: 'Vs Mode' }));
      expect(stored()).toEqual({ phase: 'running', step: 2, sub: 1 }); // the tour of the page begins
      expect(await screen.findByRole('dialog', { name: /drill 3 of 6/ })).toHaveTextContent('This is Vs Mode');
    });

    it('are done once the highlight dialog has the mascot, and the congratulation waits for that dialog to close', async () => {
      seed([warren], profilesFixture);
      setCamp('running', 5, 3);
      renderAt('/');
      const clip = document.createElement('button');
      clip.className = 'hl-btn';
      document.body.appendChild(clip);
      await userEvent.click(clip);
      expect(stored()).toEqual({ phase: 'running', step: 5, sub: 3 }); // the card stays, with its mascot, until the dialog has its own
      let leave = () => {};
      act(() => { leave = registerOpenDialog(); }); // the highlights dialog's mascot is there
      expect(stored()).toEqual({ phase: 'finished', step: 0, sub: 0 });
      expect(finishEl()).toBeNull(); // not on top of the highlights
      act(() => leave()); // the highlights dialog is closed
      expect(await screen.findByRole('dialog', { name: 'Touchdown!' })).toBeInTheDocument();
      clip.remove();
    });

    it('forget a press that opened no dialog, and stay on the drill', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seed([warren], profilesFixture);
      setCamp('running', 5, 3);
      const clip = document.createElement('button');
      clip.className = 'hl-btn';
      document.body.appendChild(clip);
      renderAt('/');
      await userEvent.click(clip);
      await act(async () => { vi.advanceTimersByTime(2500); });
      act(() => { registerOpenDialog()(); });
      expect(stored()).toEqual({ phase: 'running', step: 5, sub: 3 });
      clip.remove();
      vi.useRealTimers();
    });

    it('have a red Leave camp, and no practice league while the card points at the Leagues tab', () => {
      setCamp('running', 0);
      renderAt('/');
      expect(within(camp()).getByRole('button', { name: 'Leave camp' })).toHaveClass('btn-danger');
      expect(within(camp()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Skip drill', 'Leave camp']);
    });

    it('offer a green practice league on the Leagues page, with the extended text', () => {
      setCamp('running', 0);
      renderAt('/leagues');
      expect(camp()).toHaveTextContent('Alternatively use a practice league, to get things going.');
      expect(within(camp()).getByRole('button', { name: 'Use a practice league' })).toHaveClass('btn-primary');
    });

    it('can be skipped one drill at a time, and the congratulation ends it', async () => {
      seed([], profilesFixture);
      mockFetch({ scoreboard: { events: [] } });
      setCamp('running', 3);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      expect(await screen.findByRole('region', { name: 'Rookie camp' })).toHaveTextContent('Last drill'); // the sync drill has no ESPN league to work on, so it is passed over
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument(); // the card is gone
      const dialog = await screen.findByRole('dialog', { name: 'Touchdown!' });
      expect(dialog).toHaveTextContent('You are on the team');
      expect(ring()).toBeNull();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
      expect(stored()).toEqual({ phase: 'done', step: 0, sub: 0 });
    });

    it('can be left at any time, and the user comes back to the drill they were on after a reload', async () => {
      seed([], profilesFixture);
      setCamp('running', 2);
      const { unmount } = renderAt('/');
      unmount();
      renderAt('/');
      expect(camp()).toHaveTextContent('drill 3 of 6');
      await userEvent.click(screen.getByRole('button', { name: 'Leave camp' }));
      expect(stored()).toEqual({ phase: 'declined', step: 0, sub: 0 });
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
    });

    it('announce each drill once, in a polite live region, and never take a click', () => {
      setCamp('running', 0);
      renderAt('/');
      expect(camp().querySelector('[aria-live="polite"]')).toHaveTextContent('First drill');
      expect(ring()).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Settings', () => {
    it('starts the camp again, wherever it was left', async () => {
      seed([], profilesFixture);
      setCamp('done');
      renderAt('/settings');
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Site settings' }));
      await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Start rookie camp' })); });
      expect(stored()).toEqual({ phase: 'running', step: 0, sub: 0 }); // from the start, even with a league: the user does the steps
      expect(camp()).toHaveTextContent('First drill');
    });
  });

  describe('the practice league', () => {
    it('is on the first drill too, and ends it but not the player drill, which the user still does', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      expect(camp()).toHaveTextContent('Second drill');
      expect(profilesStore.get()).toHaveLength(1);
    });

    it('moves on in one step, so only one jump is sent', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      const steps: number[] = [];
      const off = campStore.subscribe(() => steps.push(campStore.get().step));
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      off();
      expect(steps.filter((n) => n > 0)).toEqual([1]);
    });

    it('is the camp league with two practice players, and it goes when the camp ends', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      await waitFor(() => expect(profilesStore.get().map((p) => p.name)).toEqual(['Practice league']));
      expect(followedStore.get().map((e) => e.name)).toEqual(['Cole Harlan', 'Marcus Teller']); // the third is what drill 2 adds
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0, practice: true });
      act(() => endCamp('declined'));
      await waitFor(() => expect(profilesStore.get()).toEqual([]));
      expect(followedStore.get()).toEqual([]);
    });

    it('is also what skipping the league drill chooses, from any step of it', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(within(camp()).getByRole('button', { name: 'Skip drill' }));
      await waitFor(() => expect(profilesStore.get().map((p) => p.name)).toEqual(['Practice league']));
      expect(camp()).toHaveTextContent('Second drill');
      expect(stored()).toEqual({ phase: 'running', step: 1, sub: 0, practice: true });
    });

    it('is not made by skipping another drill', async () => {
      setCamp('running', 1);
      renderAt('/');
      await userEvent.click(within(camp()).getByRole('button', { name: 'Skip drill' }));
      expect(profilesStore.get()).toEqual([]);
    });
  });

  describe('the mascot', () => {
    const mascots = () => document.querySelectorAll('.mascot');

    it('is the only one on screen in the welcome, goes to the camp card when entering, and is back on the page after Skip', async () => {
      renderAt('/');
      const dialog = await welcome();
      await waitFor(() => expect(dialog.querySelector('.mascot')).not.toBeNull()); // it jumps in once the dialog has settled
      expect(mascots()).toHaveLength(1);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Skip' }));
      expect(document.querySelector('dialog[open] .mascot')).toBeNull();
      expect(mascots()).toHaveLength(1); // the page's own is back (here the empty Players page's)
    });

    it('goes from the welcome to the first drill\'s card without a mascot of the page in between', async () => {
      renderAt('/');
      const dialog = await welcome();
      await waitFor(() => expect(dialog.querySelector('.mascot')).not.toBeNull());
      await userEvent.click(within(dialog).getByRole('button', { name: 'Enter training camp' }));
      expect(camp().querySelector('.mascot')).not.toBeNull();
      expect(document.querySelector('.brand .mascot')).toBeNull();
      expect(mascots()).toHaveLength(1);
    });

    it('is the only one during the drills too, on a page of its own', () => {
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      expect(mascots()).toHaveLength(1);
      expect(document.querySelector('.brand .mascot')).toBeNull();
    });

    it('goes to a dialog and comes back, and the page never gets a mascot of its own in between', async () => {
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Add player' }));
      await waitFor(() => expect(camp().closest('dialog')).not.toBeNull()); // the card moves into the open dialog: nothing outside a modal can be pressed
      expect(camp().querySelector('.mascot')).toBeNull(); // and the mascot is on the dialog's edge instead
      expect(mascots()).toHaveLength(1);
      expect(document.querySelector('dialog .mascot')).not.toBeNull();
      await act(async () => { document.querySelector('dialog')!.close(); });
      await waitFor(() => expect(camp().querySelector('.mascot')).not.toBeNull());
      expect(mascots()).toHaveLength(1);
    });

    it('looks worried while Skip drill or Leave camp is hovered, and calm again after', async () => {
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      const face = () => camp().querySelector('.mascot')!;
      await userEvent.hover(screen.getByRole('button', { name: 'Leave camp' }));
      expect(face()).toHaveClass('worried');
      await userEvent.unhover(screen.getByRole('button', { name: 'Leave camp' }));
      expect(face()).not.toHaveClass('worried');
    });

    it('looks pleased for a moment when a drill is done, but not when it is skipped', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      const face = () => camp().querySelector('.mascot')!;
      expect(face()).not.toHaveClass('happy');
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' })); // ends the drill
      expect(face()).toHaveClass('happy');
    });

    it('is not pleased about a skipped drill', async () => {
      seed([], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      expect(camp().querySelector('.mascot')).not.toHaveClass('happy');
    });
  });

  describe('the finish', () => {
    const hops = vi.fn();
    beforeEach(() => {
      hops.mockClear();
      (HTMLElement.prototype as { animate?: unknown }).animate = hops; // not the mascot's svg: only its perch hops
    });
    afterEach(() => { delete (HTMLElement.prototype as { animate?: unknown }).animate; });
    const finish = async () => {
      seed([], profilesFixture);
      setCamp('running', 5, 3);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      return screen.findByRole('dialog', { name: 'Touchdown!' });
    };

    it('is a dialog from the mascot, who hops once he has landed and congratulates the user', async () => {
      const dialog = await finish();
      await waitFor(() => expect(hops).toHaveBeenCalledTimes(1));
      expect(dialog.querySelector('.mascot')).not.toBeNull();
      expect(dialog).toHaveTextContent('You are on the team');
      expect(document.querySelectorAll('.mascot')).toHaveLength(1);
    });

    it('takes Done as the answer, with the focus on it, and Escape as Done', async () => {
      const dialog = await finish();
      expect(within(dialog).getByRole('button', { name: 'Done' })).toBe(dialog.querySelector('button'));
      act(() => (dialog as HTMLDialogElement).close());
      expect(stored()).toEqual({ phase: 'done', step: 0, sub: 0 });
    });

    it('only says it, with no hop, under reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
      const dialog = await finish();
      await waitFor(() => expect(dialog).toHaveTextContent('You are on the team'));
      expect(hops).not.toHaveBeenCalled();
    });

    it('is shown at once to a user who comes back after finishing, and not at all with the mascot off', async () => {
      setCamp('finished');
      const { unmount } = renderAt('/');
      expect(await screen.findByRole('dialog', { name: 'Touchdown!' })).toBeInTheDocument();
      unmount();
      localStorage.setItem('nflsw:v1:mascot', 'false');
      reloadAllStores();
      renderAt('/');
      expect(finishEl()).toBeNull();
    });
  });

  describe('union', () => {
    it('is the smallest rectangle around both controls', () => {
      const r = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;
      expect(union(r(10, 100, 200, 30), r(10, 140, 180, 30))).toMatchObject({ left: 10, top: 100, right: 210, bottom: 170, width: 200, height: 70 });
    });
  });
});
