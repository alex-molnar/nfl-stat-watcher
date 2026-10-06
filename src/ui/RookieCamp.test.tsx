import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warren, profilesFixture } from '../test/data';
import { vi } from 'vitest';
import { reloadAllStores } from '../storage/store';
import { renderAt, seed } from '../test/render';
import { DEMO_LEAGUE, addDemoLeague } from '../storage/demoLeague';
import { campStore } from '../storage/camp';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { placeCard } from './RookieCamp';

const camp = () => screen.getByRole('region', { name: 'Rookie camp' });
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:camp') ?? 'null');
const setCamp = (phase: string, step = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase, step }));
  reloadAllStores();
};
const ring = () => document.querySelector('.camp-ring');
// The welcome dialog opens a moment after the page has loaded.
const welcomeEl = () => document.querySelector('dialog[aria-labelledby="welcome-title"]');
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
      expect(stored()).toEqual({ phase: 'declined', step: 0 });
      unmount();
      renderAt('/');
      expect(welcomeEl()).toBeNull();
    });

    it('treats Escape as Skip', async () => {
      renderAt('/');
      const dialog = await welcome();
      await act(async () => { (dialog as HTMLDialogElement).close(); }); // what the browser does on Escape
      expect(stored()).toEqual({ phase: 'declined', step: 0 });
      expect(welcomeEl()).toBeNull();
    });

    it('starts the first drill when entering the camp, and the dialog is gone', async () => {
      renderAt('/');
      await userEvent.click(within(await welcome()).getByRole('button', { name: 'Enter training camp' }));
      expect(stored()).toEqual({ phase: 'running', step: 0 });
      expect(welcomeEl()).toBeNull();
      expect(camp()).toHaveTextContent('First drill: a league');
    });

    it('has Enter training camp first, so it takes the focus, and a hint for each button from the mascot', async () => {
      renderAt('/');
      const dialog = await welcome();
      expect(dialog.querySelector('button')).toHaveTextContent('Enter training camp');
      expect(within(dialog).getByRole('button', { name: 'Skip' })).toHaveAttribute('data-hint', 'You can start it later from Settings.');
      expect(within(dialog).getByRole('button', { name: 'Use a practice league' })).toHaveAttribute('data-hint');
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
      expect(stored()).toEqual({ phase: 'running', step: 0 });
      expect(camp()).toHaveTextContent('First drill: a league. Open Leagues');
      expect(camp()).toHaveTextContent('drill 1 of 4');
      expect(ring()).not.toBeNull();
    });

    it('ask for the Add a league button on the Leagues page, and move on when a league exists', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      expect(camp()).toHaveTextContent('Press Add a league');
      await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
      expect(camp()).toHaveTextContent('Second drill');
      expect(stored()).toEqual({ phase: 'running', step: 1 });
    });

    it('skip a drill that is already done', () => {
      seed([], profilesFixture);
      setCamp('running', 0);
      renderAt('/');
      expect(camp()).toHaveTextContent('Second drill');
    });

    it('ask for Vs Mode once a player is followed, and move on when it is opened', async () => {
      seed([warren], profilesFixture);
      setCamp('running', 1);
      renderAt('/');
      expect(camp()).toHaveTextContent('Third drill');
      await userEvent.click(screen.getByRole('link', { name: 'Vs Mode' }));
      expect(camp()).toHaveTextContent('Last drill');
    });

    it('end when a highlight is opened', async () => {
      seed([warren], profilesFixture);
      setCamp('running', 3);
      renderAt('/');
      const clip = document.createElement('button');
      clip.className = 'hl-btn';
      document.body.appendChild(clip);
      await userEvent.click(clip);
      clip.remove();
      expect(camp()).toHaveTextContent('That is practice done');
      expect(stored()).toEqual({ phase: 'finished', step: 0 });
    });

    it('can be skipped one drill at a time, and the congratulation ends it', async () => {
      seed([], profilesFixture);
      setCamp('running', 2);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      expect(camp()).toHaveTextContent('Last drill');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
      expect(camp()).toHaveTextContent('You are on the team');
      expect(ring()).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(stored()).toEqual({ phase: 'done', step: 0 });
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
    });

    it('can be left at any time, and the user comes back to the drill they were on after a reload', async () => {
      seed([], profilesFixture);
      setCamp('running', 2);
      const { unmount } = renderAt('/');
      unmount();
      renderAt('/');
      expect(camp()).toHaveTextContent('drill 3 of 4');
      await userEvent.click(screen.getByRole('button', { name: 'Leave camp' }));
      expect(stored()).toEqual({ phase: 'declined', step: 0 });
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
      await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Start rookie camp' })); });
      expect(stored()).toEqual({ phase: 'running', step: 1 }); // the league drill is skipped: there already is one
      expect(camp()).toHaveTextContent('Second drill');
    });
  });

  describe('the practice league', () => {
    it('is offered in the welcome, and starts the camp with the league and players already there', async () => {
      renderAt('/');
      await userEvent.click(within(await welcome()).getByRole('button', { name: 'Use a practice league' }));
      expect(profilesStore.get().map((p) => p.name)).toEqual([DEMO_LEAGUE]);
      expect(followedStore.get().map((e) => e.name)).toEqual(['Patrick Mahomes', 'Jaylen Warren', 'Pittsburgh Steelers']);
      expect(camp()).toHaveTextContent('Third drill'); // the league and the player drills are done
    });

    it('is on the first drill too, and counts it and the player drill as done', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      expect(camp()).toHaveTextContent('Third drill');
      expect(profilesStore.get()).toHaveLength(1);
    });

    it('moves past both done drills in one step, so only one jump is sent', async () => {
      setCamp('running', 0);
      renderAt('/leagues');
      const steps: number[] = [];
      const off = campStore.subscribe(() => steps.push(campStore.get().step));
      await userEvent.click(screen.getByRole('button', { name: 'Use a practice league' }));
      off();
      expect(steps.filter((n) => n > 0)).toEqual([2]);
    });

    it('is an ordinary league, and asking again does not make a second one', () => {
      addDemoLeague();
      addDemoLeague();
      expect(profilesStore.get().map((p) => p.name)).toEqual([DEMO_LEAGUE]);
      expect(followedStore.get()).toHaveLength(3);
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
      seed([warren], profilesFixture);
      setCamp('running', 3);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Add player' }));
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument());
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
      await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
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
      setCamp('running', 3);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Skip drill' }));
    };

    it('has the mascot hop and say Touchdown!, then settle on the congratulation', async () => {
      await finish();
      expect(camp().querySelector('.camp-td')).toHaveTextContent('Touchdown!');
      expect(hops).toHaveBeenCalledTimes(1);
      expect(camp().querySelector('.mascot')).toHaveClass('happy');
      expect(camp()).toHaveTextContent('You are on the team');
    });

    it('announces the congratulation once, and the bubble is not read out as well', async () => {
      await finish();
      expect(camp().querySelectorAll('[aria-live]')).toHaveLength(1);
      expect(camp().querySelector('.camp-td')!.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('only says it, with no hop, under reduced motion', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
      await finish();
      expect(camp().querySelector('.camp-td')).toHaveTextContent('Touchdown!');
      expect(hops).not.toHaveBeenCalled();
    });
  });
});
