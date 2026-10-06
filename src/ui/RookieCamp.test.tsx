import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warren, profilesFixture } from '../test/data';
import { reloadAllStores } from '../storage/store';
import { renderAt, seed } from '../test/render';
import { placeCard } from './RookieCamp';

const camp = () => screen.getByRole('region', { name: 'Rookie camp' });
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:camp') ?? 'null');
const setCamp = (phase: string, step = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase, step }));
  reloadAllStores();
};
const ring = () => document.querySelector('.camp-ring');

describe('placeCard', () => {
  const rect = (left: number, top: number, w = 100, h = 30) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;

  it('sits in the bottom corner when there is nothing to point at', () => {
    expect(placeCard(null, 1000, 800)).toEqual({ left: 1000 - 340 - 12, bottom: 12, width: 340 });
  });

  it('sits below the control, lined up with it and kept on screen', () => {
    expect(placeCard(rect(50, 100), 1000, 800)).toEqual({ left: 50, top: 144, width: 340 });
    expect(placeCard(rect(950, 100), 1000, 800).left).toBe(1000 - 340 - 12);
  });

  it('goes above the control when there is no room below, and shrinks on a narrow screen', () => {
    expect(placeCard(rect(50, 700), 1000, 800)).toEqual({ left: 50, bottom: 114, width: 340 });
    expect(placeCard(null, 300, 600).width).toBe(276);
  });

  it('stays at the bottom on a narrow screen, so it never covers the controls around the one it points at', () => {
    expect(placeCard(rect(50, 100), 500, 800)).toEqual({ left: 12, bottom: 12, width: 476 });
  });
});

describe('rookie camp', () => {
  describe('the offer', () => {
    it('is made to a user with no league, and declining is remembered', async () => {
      const { unmount } = renderAt('/');
      expect(camp()).toHaveTextContent('Want a quick practice?');
      expect(camp()).toHaveTextContent('Fumble');
      await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
      expect(stored()).toEqual({ phase: 'declined', step: 0 });
      unmount();
      renderAt('/');
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
    });

    it('is not made to a user who already has a league', () => {
      seed([], profilesFixture);
      renderAt('/');
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
    });

    it('is not made, and cannot be started from Settings, with the mascot off', async () => {
      localStorage.setItem('nflsw:v1:mascot', 'false');
      reloadAllStores();
      renderAt('/settings');
      expect(screen.queryByRole('region', { name: 'Rookie camp' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start rookie camp' })).toBeDisabled();
    });

    it('uses the name given to the mascot', () => {
      localStorage.setItem('nflsw:v1:mascotName', JSON.stringify('Gridley'));
      reloadAllStores();
      renderAt('/');
      expect(camp()).toHaveTextContent('Gridley');
    });
  });

  describe('the drills', () => {
    it('start from the offer and point at the Leagues tab while the user is elsewhere', async () => {
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Start' }));
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
});
