import { act, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const card = (name: string) => screen.getByText(name).closest('li')!;

describe('main page', () => {
  beforeEach(() => seed([warren, pitDefense, mahomes], profilesFixture));

  it('groups entries and shows stats and fantasy points', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    expect(await screen.findByText('15.60')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bye week' })).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('Lost 24-27 at CLE')).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('93')).toBeInTheDocument();
    expect(within(card('Pittsburgh Steelers')).getByText('6.00')).toBeInTheDocument();
    expect(within(card('Patrick Mahomes')).getByText('Bye week')).toBeInTheDocument();
  });

  it('shows the breakdown', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /15\.60 fantasy points in Office league/ }));
    expect(within(card('Jaylen Warren')).getByText('Rushing yards')).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('+9.30')).toBeInTheDocument();
  });

  it('moves an entry to another league and rescores it', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await screen.findByText('15.60');
    await userEvent.selectOptions(within(card('Jaylen Warren')).getByLabelText('League'), 'Friends league');
    expect(within(card('Jaylen Warren')).getByText('12.60')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)[0].profileId).toBe('p2');
  });

  it('removes an entry', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(screen.queryByText('Pittsburgh Steelers')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toHaveLength(2);
  });

  it('shows a retry note when the game summary fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': status(500) });
    renderAt('/');
    // Warren and the Steelers defense share the failing game.
    expect(await screen.findAllByText('Live data unavailable, retrying')).toHaveLength(2);
    expect(within(card('Jaylen Warren')).getByText('0.00')).toBeInTheDocument();
  });

  it('shows an empty state with nothing followed', async () => {
    seed([], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    expect(screen.getByText(/not following anyone yet/)).toBeInTheDocument();
  });

  it('keeps the last numbers and shows an updated note when a live refetch fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const [final, upcoming] = scoreboardFixture.events;
      const liveBoard = {
        events: [
          { ...final!, status: { period: 2, displayClock: '6:41', type: { state: 'in', completed: false, shortDetail: '2nd' } } },
          upcoming!,
        ],
      };
      const routes = { scoreboard: liveBoard };
      mockFetch({ ...routes, 'summary?event=401872964': summary });
      renderAt('/');
      expect(await screen.findByText('15.60')).toBeInTheDocument();
      expect(screen.queryByText(/retrying/)).not.toBeInTheDocument();

      mockFetch({ ...routes, 'summary?event=401872964': status(500) });
      await act(() => vi.advanceTimersByTimeAsync(10_000));

      expect(await screen.findAllByText(/Updated \d{1,2}:\d{2}.*, retrying/)).toHaveLength(2);
      expect(within(card('Jaylen Warren')).getByText('15.60')).toBeInTheDocument();
      expect(within(card('Jaylen Warren')).getByText('93')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still shows followed cards when the scoreboard fails', async () => {
    mockFetch({ scoreboard: status(500) });
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Followed' })).toBeInTheDocument();
    expect(screen.getAllByText('Game status unavailable')).toHaveLength(3);
    expect(screen.getByText('Live data unavailable, retrying')).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('0.00')).toBeInTheDocument();
  });
});
