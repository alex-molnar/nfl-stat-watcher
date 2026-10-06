import { act, screen, waitFor, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import teams from '../test/fixtures/standings.json';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
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
    await userEvent.click(await screen.findByRole('button', { name: /^15\.60 fantasy pts, Office league breakdown$/ }));
    expect(within(card('Jaylen Warren')).getByRole('button', { name: /fantasy pts, Office league breakdown/ })).toHaveAttribute('aria-expanded', 'true');
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

  it('keeps focus on the moved card league select after a league change', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await screen.findByText('15.60');
    await userEvent.selectOptions(within(card('Jaylen Warren')).getByLabelText('League'), 'Friends league');
    expect(within(card('Jaylen Warren')).getByLabelText('League')).toHaveFocus();
  });

  it('moves focus to the next card, else the previous, else Add player after Remove', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    const pts = (name: string) => within(card(name)).getByRole('button', { name: /fantasy pts/ });
    await screen.findByText('15.60');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    expect(pts('Pittsburgh Steelers')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Patrick Mahomes from Friends league' }));
    expect(pts('Pittsburgh Steelers')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Add player' })).toHaveFocus();
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

  it('shows the retry note while the browser is offline', async () => {
    onlineManager.setOnline(false);
    try {
      mockFetch({ scoreboard: status(500) });
      renderAt('/');
      expect(await screen.findByText('Live data unavailable, retrying')).toBeInTheDocument();
    } finally {
      onlineManager.setOnline(true);
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

  it('names the points button after its visible text', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    const btn = await screen.findByRole('button', { name: /^15\.60 fantasy pts/ });
    expect(btn).toHaveTextContent('15.60fantasy pts');
  });

  it('gives each card a heading and the team abbreviation in text', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Jaylen Warren', level: 3 })).toBeInTheDocument();
    expect(within(card('Jaylen Warren')).getByText('PIT RB, at CLE')).toBeInTheDocument();
  });

  it('keeps a page-level status region that announces the retry note', async () => {
    mockFetch({ scoreboard: status(500) });
    renderAt('/');
    const region = screen.getAllByRole('status').find((el) => el.classList.contains('page-note'))!;
    expect(region).toBeInTheDocument();
    expect(await screen.findByText('Live data unavailable, retrying')).toBe(region);
  });

  it('keeps the same status element mounted while loading finishes', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    const region = screen.getByText('Loading games');
    expect(region).toHaveAttribute('role', 'status');
    await screen.findByText('15.60');
    expect(region.isConnected).toBe(true);
    expect(region).toBeEmptyDOMElement();
  });

  it('focuses the header Add player button when the dialog closes and the opener is gone', async () => {
    seed([], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=bills': { items: [] }, standings: teams });
    renderAt('/');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add player' })[1]!);
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    await userEvent.click(await screen.findByRole('button', { name: /^Add Buffalo Bills/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Add player' })).toHaveFocus();
  });
});

describe('pause live updates', () => {
  beforeEach(() => seed([warren, pitDefense, mahomes], profilesFixture));
  const [final, upcoming] = scoreboardFixture.events;
  const liveBoard = {
    events: [
      { ...final!, status: { period: 2, displayClock: '6:41', type: { state: 'in', completed: false, shortDetail: '2nd' } } },
      upcoming!,
    ],
  };
  const calls = (f: ReturnType<typeof mockFetch>, part: string) => f.mock.calls.filter(([u]) => String(u).includes(part)).length;

  it('toggles with aria-pressed, shows a note, stops polling, and resumes with an immediate refetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const routes = { scoreboard: liveBoard, 'summary?event=401872964': summary };
      const f = mockFetch(routes);
      renderAt('/');
      expect(await screen.findByText('15.60')).toBeInTheDocument();
      const pause = screen.getByRole('button', { name: 'Pause live updates' });
      expect(pause).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(pause);
      const resume = screen.getByRole('button', { name: 'Resume live updates' });
      expect(resume).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/Live updates are paused/)).toBeInTheDocument();

      const summaries = calls(f, 'summary');
      const boards = calls(f, 'scoreboard');
      await act(() => vi.advanceTimersByTimeAsync(120_000));
      expect(calls(f, 'summary')).toBe(summaries);
      expect(calls(f, 'scoreboard')).toBe(boards);
      expect(within(card('Jaylen Warren')).getByText('15.60')).toBeInTheDocument();

      await userEvent.click(resume);
      expect(screen.queryByText(/Live updates are paused/)).not.toBeInTheDocument();
      await waitFor(() => expect(calls(f, 'summary')).toBeGreaterThan(summaries));
      await waitFor(() => expect(calls(f, 'scoreboard')).toBeGreaterThan(boards));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pause details', () => {
  beforeEach(() => seed([warren, pitDefense, mahomes], profilesFixture));

  it('survives leaving the page and coming back', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await screen.findByText('15.60');
    await userEvent.click(screen.getByRole('button', { name: 'Pause live updates' }));
    await userEvent.click(screen.getByRole('link', { name: 'Leagues' }));
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    expect(screen.getByRole('button', { name: 'Resume live updates' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides the card retry note while paused', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': status(500) });
    renderAt('/');
    expect(await screen.findAllByText('Live data unavailable, retrying')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Pause live updates' }));
    expect(screen.queryByText('Live data unavailable, retrying')).not.toBeInTheDocument();
  });
});

describe('orphaned entries', () => {
  const orphan = { ...warren, profileId: 'deleted' };

  it('can be removed after being repaired to the first league', async () => {
    seed([orphan], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    expect(screen.queryByText('Jaylen Warren')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)).toEqual([]);
  });

  it('can be moved with the league select', async () => {
    seed([orphan], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    await screen.findByText('15.60');
    await userEvent.selectOptions(within(card('Jaylen Warren')).getByLabelText('League'), 'Friends league');
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)[0].profileId).toBe('p2');
  });
});

describe('opponent entries on the Players page', () => {
  it('never show as cards', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/');
    expect(await screen.findByText('15.60')).toBeInTheDocument();
    expect(screen.queryByText('Pittsburgh Steelers')).not.toBeInTheDocument();
  });

  it('do not count as followed for the empty state', () => {
    seed([opponent(warren)], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    expect(screen.getByText(/not following anyone yet/)).toBeInTheDocument();
    expect(screen.queryByText('Loading games')).not.toBeInTheDocument();
  });
});

describe('with no league yet', () => {
  const NEED = 'Add a scoring league first to add players';

  it('shows Add player and Sync starters as not clickable, with a message on hover', async () => {
    seed([], []);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    for (const name of ['Add player', 'Sync starters']) {
      const button = screen.getAllByRole('button', { name })[0]!; // the header ones
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('title', NEED);
      await userEvent.click(button);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // clicking did nothing
    expect(screen.getByText('Add a scoring league first to start following players.')).toBeInTheDocument();
  });

  it('offers Go to Leagues in the empty state instead of a greyed-out Add player', () => {
    seed([], []);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    const empty = document.querySelector('.empty') as HTMLElement;
    expect(within(empty).getByRole('link', { name: 'Go to Leagues' })).toHaveAttribute('href', '/leagues');
    expect(within(empty).queryByRole('button', { name: 'Add player' })).not.toBeInTheDocument();
  });

  it('does not mark them once a league exists', () => {
    seed([], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    expect(screen.getAllByRole('button', { name: 'Add player' })[0]).not.toHaveAttribute('aria-disabled');
  });

  it('shows a way to the Leagues page on the Vs screen instead of a matchup', () => {
    seed([], []);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/vs');
    expect(screen.getByText('Add a scoring league first to compare a matchup.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Leagues' })).toHaveAttribute('href', '/leagues');
  });
});

describe('live ordering', () => {
  const sf = (espnId: string, name: string, position: string, teamId = '25', teamAbbr = 'SF') =>
    ({ ...warren, espnId, name, position, teamId, teamAbbr, profileId: 'p1' });
  const liveBoard = {
    events: scoreboardFixture.events.map((e) => e.id === '401872975' ? { ...e, status: { ...e.status, type: { ...e.status.type, state: 'in' as const } } } : e),
  };
  // SF has the ball at DEN 12, so SF offense is in the red zone.
  const liveSummary = {
    header: { id: '401872975', competitions: [{ competitors: [] }] },
    boxscore: { players: [] },
    drives: { current: { plays: [{ id: '1', text: 'run', start: { team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '1st & 10' } }] } },
  };
  const names = () => [...document.querySelectorAll('.card .nm')].map((n) => n.textContent);

  it('orders live cards red zone first, then the side with the ball, then the rest, by position within each', async () => {
    seed([
      sf('1', 'DEN receiver', 'WR', '7', 'DEN'),
      sf('2', 'SF kicker', 'K'),
      sf('3', 'SF quarterback', 'QB'),
      { ...pitDefense, espnId: '7', name: 'Denver D/ST', teamId: '7', teamAbbr: 'DEN' },
      sf('4', 'SF runner', 'RB'),
      { ...pitDefense, espnId: '25', name: 'SF D/ST', teamId: '25', teamAbbr: 'SF' },
    ], profilesFixture);
    mockFetch({ scoreboard: liveBoard, 'summary?event=401872975': liveSummary, standings: teams });
    renderAt('/');
    await screen.findByText('SF runner');
    await waitFor(() => expect(names()).toEqual(['SF runner', 'SF quarterback', 'SF kicker', 'Denver D/ST', 'DEN receiver', 'SF D/ST']));
  });

  it('styles the right side of the ball, and pulses a red zone card only until the page is paused', async () => {
    seed([sf('4', 'SF runner', 'RB'), { ...pitDefense, espnId: '7', name: 'Denver D/ST', teamId: '7', teamAbbr: 'DEN' }, sf('1', 'DEN receiver', 'WR', '7', 'DEN')], profilesFixture);
    mockFetch({ scoreboard: liveBoard, 'summary?event=401872975': liveSummary, standings: teams });
    renderAt('/');
    const card = (name: string) => screen.getByText(name).closest('.card')!;
    await waitFor(() => expect(card('SF runner')).toHaveClass('is-rz'));
    expect(card('SF runner')).not.toHaveClass('on-field');
    expect(within(card('SF runner') as HTMLElement).getByText('Offense on the field')).toBeInTheDocument();
    expect(card('Denver D/ST')).toHaveClass('on-field');
    expect(card('Denver D/ST')).not.toHaveClass('is-rz');
    expect(card('DEN receiver')).not.toHaveClass('on-field');
    expect(within(card('Denver D/ST') as HTMLElement).getByText('Defense on the field')).toBeInTheDocument();
    expect(card('SF runner')).not.toHaveClass('still');
    await userEvent.click(screen.getByRole('button', { name: /Pause live updates/ }));
    expect(card('SF runner')).toHaveClass('still');
  });
});

describe('injury designations', () => {
  const sf = (espnId: string, name: string, position: string) => ({ ...warren, espnId, name, position, teamId: '25', teamAbbr: 'SF', profileId: 'p1' });
  const liveBoard = {
    events: scoreboardFixture.events.map((e) => e.id === '401872975' ? { ...e, status: { ...e.status, type: { ...e.status.type, state: 'in' as const } } } : e),
  };
  // SF has the ball at DEN 12: SF offense is in the red zone.
  const liveSummary = {
    header: { id: '401872975', competitions: [{ competitors: [] }] },
    boxscore: { players: [] },
    drives: { current: { plays: [{ id: '1', text: 'run', start: { team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '1st & 10' } }] } },
    injuries: [{ team: { id: '25' }, injuries: [
      { status: 'Out', athlete: { id: '1' }, details: { type: 'Ankle' } },
      { status: 'Questionable', athlete: { id: '2' }, details: { type: 'Hamstring' } },
    ] }],
  };
  const names = () => [...document.querySelectorAll('.card .nm')].map((n) => n.textContent);

  it('marks every designation on the card and sends an out player to the back without red zone styling', async () => {
    seed([sf('1', 'Hurt runner', 'RB'), sf('2', 'Iffy receiver', 'WR'), sf('3', 'Healthy quarterback', 'QB')], profilesFixture);
    mockFetch({ scoreboard: liveBoard, 'summary?event=401872975': liveSummary, standings: teams });
    renderAt('/');
    await waitFor(() => expect(screen.getByText('Out · Ankle')).toBeInTheDocument());
    expect(screen.getByText('Questionable · Hamstring')).toBeInTheDocument();
    expect(screen.getByText('Questionable · Hamstring').parentElement).toHaveClass('inj-row'); // its own row, not squeezed beside the name
    expect(within(screen.getByText('Healthy quarterback').closest('.card') as HTMLElement).queryByText(/Questionable|Out/)).not.toBeInTheDocument(); // no row when healthy
    await waitFor(() => expect(names()).toEqual(['Iffy receiver', 'Healthy quarterback', 'Hurt runner']));
    const hurt = screen.getByText('Hurt runner').closest('.card')!;
    expect(hurt).not.toHaveClass('is-rz');
    expect(hurt).not.toHaveClass('on-field');
    expect(screen.getByText('Iffy receiver').closest('.card')).toHaveClass('is-rz');
  });

  it('shows the designation on a game that has not started yet', async () => {
    seed([{ ...warren, espnId: '9', name: 'Later player', teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1' }], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872975': { ...liveSummary, injuries: [{ team: { id: '25' }, injuries: [{ status: 'Doubtful', athlete: { id: '9' } }] }] }, standings: teams });
    renderAt('/');
    expect(await screen.findByText('Doubtful')).toHaveClass('inj-doubtful');
  });
});

describe('injury designations from the league report', () => {
  const sf = (espnId: string, name: string, position: string) => ({ ...warren, espnId, name, position, teamId: '25', teamAbbr: 'SF', profileId: 'p1' });
  const liveBoard = {
    events: scoreboardFixture.events.map((e) => e.id === '401872975' ? { ...e, status: { ...e.status, type: { ...e.status.type, state: 'in' as const } } } : e),
  };
  // The game's own report lists nobody (ESPN truncates it to five players per team); SF has the ball in the red zone.
  const liveSummary = {
    header: { id: '401872975', competitions: [{ competitors: [] }] },
    boxscore: { players: [] },
    drives: { current: { plays: [{ id: '1', text: 'run', start: { team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '1st & 10' } }] } },
    injuries: [{ team: { id: '25' }, injuries: [] }],
  };
  const league = { injuries: [{ displayName: 'SF', injuries: [
    { status: 'Out', athlete: { links: [{ rel: ['playercard'], href: 'https://www.espn.com/nfl/player/_/id/1/hurt' }] }, details: { type: 'Toe' } },
    { status: 'Questionable', athlete: { links: [{ rel: ['playercard'], href: 'https://www.espn.com/nfl/player/_/id/2/iffy' }] }, details: { type: 'Hamstring' } },
  ] }] };
  const names = () => [...document.querySelectorAll('.card .nm')].map((n) => n.textContent);

  it('marks a player the game report does not list, and ranks one who is out last', async () => {
    seed([sf('1', 'Hurt runner', 'RB'), sf('2', 'Iffy receiver', 'WR'), sf('3', 'Healthy quarterback', 'QB')], profilesFixture);
    mockFetch({ scoreboard: liveBoard, 'summary?event=401872975': liveSummary, 'nfl/injuries': league, standings: teams });
    renderAt('/');
    await waitFor(() => expect(screen.getByText('Out · Toe')).toBeInTheDocument());
    expect(screen.getByText('Questionable · Hamstring')).toBeInTheDocument();
    await waitFor(() => expect(names()).toEqual(['Iffy receiver', 'Healthy quarterback', 'Hurt runner']));
    expect(screen.getByText('Hurt runner').closest('.card')).not.toHaveClass('is-rz');
  });

  it('marks a player on a bye or in a finished game too', async () => {
    seed([{ ...warren, espnId: '1' }], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary, 'nfl/injuries': league, standings: teams });
    renderAt('/');
    expect(await screen.findByText('Out · Toe')).toHaveClass('inj-out');
  });
});

describe('league tag colour', () => {
  it('shows the tag in the league colour with readable text, and uncoloured when a league has none', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary, standings: teams });
    seed([warren, mahomes], [{ ...profilesFixture[0]!, color: '#ffeb3b' }, { ...profilesFixture[1]!, color: '#0b1d51' }]);
    renderAt('/');
    const tag = async (name: string) => (await screen.findByText(name)).closest('.card')!.querySelector('.league-chip') as HTMLElement;
    expect(await tag('Jaylen Warren')).toHaveStyle({ background: '#ffeb3b', color: '#000000' }); // dark text on a light colour
    expect(await tag('Patrick Mahomes')).toHaveStyle({ background: '#0b1d51', color: '#ffffff' }); // light text on a dark one
  });
});
