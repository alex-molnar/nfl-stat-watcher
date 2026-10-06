import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { warren, profilesFixture } from '../test/data';
import { campStore, endCamp } from '../storage/camp';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { reloadAllStores } from '../storage/store';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const camp = () => screen.getByRole('region', { name: 'Rookie camp' });
const card = (name: string) => screen.getByRole('heading', { name }).closest('li')!;

// The last drill shows three practice players, one in every state a card can be in, and always has a highlight to press.
describe('rookie camp, the last drill', () => {
  async function start(sub = 0) {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: { events: [] } }); // the real schedule is empty: what shows is the practice games
    localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'running', step: 5, sub }));
    reloadAllStores();
    renderAt('/');
    await screen.findByRole('heading', { name: 'Cole Harlan' });
    await screen.findByRole('region', { name: 'Rookie camp' });
  }

  it('shows a card that is playing now, one still to play and a final one, which look like any other player', async () => {
    await start();
    const live = card('Cole Harlan');
    expect(live).toHaveClass('live');
    expect(live).toHaveTextContent('Q3 8:42');
    expect(live).toHaveTextContent('fantasy pts');
    expect(live.querySelector('.field')).not.toBeNull(); // the mini field with the ball
    expect(card('Marcus Teller')).toHaveTextContent(/Kickoff/);
    expect(card('Marcus Teller')).toHaveTextContent('No stats until kickoff');
    await waitFor(() => expect(card('Jalen Whitmore')).toHaveTextContent('Won 27-20 vs PRA'));
    expect(card('Jalen Whitmore')).toHaveTextContent('112'); // receiving yards
    expect(card('Jalen Whitmore').querySelector('.league-chip')).toHaveTextContent('Practice league');
  });

  it('shows only the practice players while the drill runs, not the user’s own, and all of them again when the camp ends', async () => {
    await start();
    expect(screen.queryByRole('heading', { name: 'Jaylen Warren' })).toBeNull(); // the user's own player is in the store but off the page
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Cole Harlan', 'Marcus Teller', 'Jalen Whitmore']);
    act(() => endCamp('done'));
    await screen.findByRole('heading', { name: 'Jaylen Warren' });
  });

  it('walks over the three cards with Next, then asks for the highlight, and that one is a real clip of the final game’s player', async () => {
    await start();
    expect(camp()).toHaveTextContent('playing right now');
    await userEvent.click(within(camp()).getByRole('button', { name: 'Next' }));
    expect(camp()).toHaveTextContent('has not started yet');
    await userEvent.click(within(camp()).getByRole('button', { name: 'Next' }));
    expect(camp()).toHaveTextContent('this game is over');
    await userEvent.click(within(camp()).getByRole('button', { name: 'Next' }));
    expect(camp()).toHaveTextContent('Highlights button');
    const button = await screen.findByRole('button', { name: /highlights for Jalen Whitmore, 1/i });
    expect(document.querySelectorAll('.hl-btn')).toHaveLength(1); // only the final game has a clip
    expect(camp().querySelectorAll('button')).toHaveLength(2); // only Skip drill and Leave camp: this step is done by the press
    await userEvent.click(button);
    const video = await screen.findByLabelText('Whitmore hauls in a 38-yard touchdown', {}, { timeout: 3000 });
    expect(video).toHaveAttribute('src', `${location.origin}/camp-clip.mp4`);
  });

  it('ends with the congratulation once the highlights are closed, and then leaves nothing of the practice players behind', async () => {
    await start(3);
    await userEvent.click(await screen.findByRole('button', { name: /highlights for Jalen Whitmore/i }));
    await waitFor(() => expect(campStore.get().phase).toBe('finished'), { timeout: 3000 });
    expect(screen.getByRole('heading', { name: 'Cole Harlan' })).toBeInTheDocument(); // still there behind the dialogs
    act(() => document.querySelector<HTMLDialogElement>('dialog.hl-dlg')!.close());
    const finish = await screen.findByRole('dialog', { name: 'Touchdown!' });
    await userEvent.click(within(finish).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cole Harlan' })).not.toBeInTheDocument());
    expect(profilesStore.get().map((p) => p.id)).toEqual(profilesFixture.map((p) => p.id));
    expect(followedStore.get().map((e) => e.espnId)).toEqual([warren.espnId]);
    expect(localStorage.getItem('nflsw:v1:followed')).not.toContain('camp-');
  });

  it('is gone as soon as the camp is left, in the middle of the drill', async () => {
    await start(1);
    await userEvent.click(within(camp()).getByRole('button', { name: 'Leave camp' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cole Harlan' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Jaylen Warren' })).toBeInTheDocument(); // the user's own player stays
    expect(localStorage.getItem('nflsw:v1:profiles')).not.toContain('camp-');
  });
});
