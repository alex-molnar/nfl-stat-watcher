import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { profilesFixture } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { scoreboardFixture } from '../test/data';
import { renderAt, seed } from '../test/render';
import * as flight from './mascotFlight';

// Every mascot that appears or leaves is reported; a jump needs exactly one of each, in the same moment.
vi.mock('./mascotFlight', () => ({ mascotAppeared: vi.fn(), mascotLeft: vi.fn(), resetMascotFlight: vi.fn(), isMascotFlying: () => false, subscribeMascotFlight: () => () => {} }));
const appeared = () => vi.mocked(flight.mascotAppeared);
const left = () => vi.mocked(flight.mascotLeft);
const goTo = (name: string) => userEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name }));
import { within } from '@testing-library/react';

beforeEach(() => { vi.clearAllMocks(); mockFetch({ scoreboard: scoreboardFixture }); });

describe('the mascot is placed once, where it will stay', () => {
  it('opening a page with no league puts the mascot on the page only, so nothing jumps', () => {
    seed([], []);
    renderAt('/');
    expect(document.querySelector('.brand .mascot')).toBeNull();
    expect(document.querySelector('.mascot-says .mascot')).not.toBeNull();
    expect(appeared()).toHaveBeenCalledTimes(1); // the page's mascot, and no header mascot before it
    expect(left()).not.toHaveBeenCalled();
  });

  it('opening a page with a league puts the mascot in the header only', () => {
    seed([], profilesFixture);
    renderAt('/settings');
    expect(document.querySelector('.brand .mascot')).not.toBeNull();
    expect(appeared()).toHaveBeenCalledTimes(1);
    expect(left()).not.toHaveBeenCalled();
  });

  it('going from one empty state to another is one mascot leaving and one arriving, not two jumps', async () => {
    seed([], []);
    renderAt('/');
    vi.clearAllMocks();
    await goTo('Leagues');
    expect(document.querySelector('.brand .mascot')).toBeNull();
    expect(left()).toHaveBeenCalledTimes(1);
    expect(appeared()).toHaveBeenCalledTimes(1);
  });

  it('going from an empty state to a page with the mascot in the header is one move', async () => {
    seed([], []);
    renderAt('/');
    vi.clearAllMocks();
    await goTo('Settings');
    expect(document.querySelector('.brand .mascot')).not.toBeNull();
    expect(left()).toHaveBeenCalledTimes(1);
    expect(appeared()).toHaveBeenCalledTimes(1);
  });

  it('going from the header to an empty state is one move too', async () => {
    seed([], []);
    renderAt('/settings'); // no league, so the header's mascot is here
    expect(document.querySelector('.brand .mascot')).not.toBeNull();
    vi.clearAllMocks();
    await goTo('Players');
    expect(document.querySelector('.brand .mascot')).toBeNull();
    expect(document.querySelector('.mascot-says .mascot')).not.toBeNull();
    expect(left()).toHaveBeenCalledTimes(1);
    expect(appeared()).toHaveBeenCalledTimes(1);
  });

  it('adding the first league moves the mascot from the page to the header in one step', async () => {
    seed([], []);
    renderAt('/leagues');
    vi.clearAllMocks();
    await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
    expect(document.querySelector('.mascot-says')).toBeNull();
    expect(document.querySelector('.brand .mascot')).not.toBeNull();
    expect(left()).toHaveBeenCalledTimes(1);
    expect(appeared()).toHaveBeenCalledTimes(1);
  });
});
