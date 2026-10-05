import { act, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import teams from '../test/fixtures/standings.json';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { addEntry } from '../storage/followed';
import { renderAt, seed } from '../test/render';

const routes = { scoreboard: scoreboardFixture, 'summary?event=401872964': summary };
const column = (name: 'Your players' | 'Opponent players') => screen.getByRole('region', { name });
const mineCol = () => column('Your players');
const oppCol = () => column('Opponent players');
const bar = () => document.querySelector('.score-bar')!;
const picker = () => document.querySelector<HTMLSelectElement>('.vs-league select')!;
const statusLine = () => document.querySelector('main [role="status"]')!;
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]');
const pts = (col: HTMLElement, name: string) =>
  within(within(col).getByText(name).closest('li')!).getByRole('button', { name: /fantasy pts/ });

describe('vs page grouping', () => {
  const sf = { ...warren, espnId: '1', name: 'Brock Purdy', teamId: '25', teamAbbr: 'SF', position: 'QB' };
  const live = {
    events: scoreboardFixture.events.map((event) => event.id === '401872975' ? { ...event, status: { ...event.status, type: { ...event.status.type, state: 'in' as const } } } : event),
  };

  it('puts live games first with bigger cards, then the rest under their own headings, in each column', async () => {
    seed([warren, sf, opponent(pitDefense), opponent({ ...sf, espnId: '2', name: 'Bo Nix', teamId: '7', teamAbbr: 'DEN' })], profilesFixture);
    mockFetch({ ...routes, scoreboard: live });
    renderAt('/vs');
    await within(mineCol()).findByText('Jaylen Warren');
    const headings = (col: HTMLElement) => [...col.querySelectorAll('.group-title')].map((h) => h.textContent);
    expect(headings(mineCol())).toEqual(['Live now', 'Final']);
    expect(headings(oppCol())).toEqual(['Live now', 'Final']);
    const liveList = within(mineCol()).getByRole('region', { name: 'Live now' }).querySelector('ul')!;
    expect(liveList).toHaveClass('live');
    expect(within(liveList).getByText('Brock Purdy')).toBeInTheDocument();
    expect(within(within(mineCol()).getByRole('region', { name: 'Final' })).getByText('Jaylen Warren')).toBeInTheDocument();
  });
});

describe('vs page live ordering', () => {
  const player = (espnId: string, name: string, position: string, teamId: string, teamAbbr: string) => ({ ...warren, espnId, name, position, teamId, teamAbbr });
  const board = {
    events: scoreboardFixture.events.map((event) => event.id === '401872975' ? { ...event, status: { ...event.status, type: { ...event.status.type, state: 'in' as const } } } : event),
  };
  const liveSummary = {
    header: { id: '401872975', competitions: [{ competitors: [] }] },
    boxscore: { players: [] },
    drives: { current: { plays: [{ id: '1', text: 'run', start: { team: { id: '25' }, yardsToEndzone: 12, downDistanceText: '1st & 10' } }] } },
  };
  const names = (col: HTMLElement) => [...col.querySelectorAll('.card .nm')].map((n) => n.textContent);

  it('orders each column on its own: red zone, then the side with the ball, then the rest', async () => {
    seed([
      player('1', 'DEN receiver', 'WR', '7', 'DEN'), player('2', 'SF runner', 'RB', '25', 'SF'),
      opponent(player('3', 'SF defense', 'LB', '25', 'SF')), opponent(player('4', 'SF quarterback', 'QB', '25', 'SF')), opponent(player('5', 'DEN linebacker', 'LB', '7', 'DEN')),
    ], profilesFixture);
    mockFetch({ ...routes, scoreboard: board, 'summary?event=401872975': liveSummary });
    renderAt('/vs');
    await waitFor(() => expect(names(mineCol())).toEqual(['SF runner', 'DEN receiver']));
    await waitFor(() => expect(names(oppCol())).toEqual(['SF quarterback', 'DEN linebacker', 'SF defense']));
  });
});

describe('vs page', () => {
  it('shows both sides of the first league with totals and who leads', async () => {
    seed([warren, opponent(pitDefense), mahomes], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    expect(await within(mineCol()).findByText('15.60')).toBeInTheDocument();
    expect(within(oppCol()).getByText('Pittsburgh Steelers')).toBeInTheDocument();
    expect(screen.queryByText('Patrick Mahomes')).not.toBeInTheDocument();
    expect(bar()).toHaveTextContent('You 15.60 You lead by 9.60 Opponent 6.00');
    expect(picker()).toHaveValue('p1');
    expect(screen.getByLabelText('Matchup league')).toBe(picker());
  });

  it('has no league select on any card, so a keypress can never move a card out of the matchup', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    expect(within(mineCol()).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(oppCol()).queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('says when the opponent leads', async () => {
    seed([pitDefense, opponent(warren)], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(oppCol()).findByText('15.60');
    expect(bar()).toHaveTextContent('You 6.00 Opponent leads by 9.60 Opponent 15.60');
  });

  it('switches the matchup with the league picker and stores nothing new', async () => {
    seed([warren, opponent(pitDefense), mahomes], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    await userEvent.selectOptions(picker(), 'Friends league');
    expect(within(mineCol()).getByText('Patrick Mahomes')).toBeInTheDocument();
    expect(within(oppCol()).getByText('No opponent players yet')).toBeInTheDocument();
    expect(bar()).toHaveTextContent('You 0.00 Tied Opponent 0.00');
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys.every((k) => ['nflsw:v1:followed', 'nflsw:v1:profiles', 'nflsw:v1:theme', 'nflsw:v1:nameDisplay', 'nflsw:v1:daznEnabled', 'nflsw:v1:daznMode', 'nflsw:v1:daznLinks'].includes(k!))).toBe(true);
  });

  it('renders an empty matchup as a tie with both Add buttons, silent in the status line', async () => {
    seed([], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await waitFor(() => expect(bar()).toHaveTextContent('You 0.00 Tied Opponent 0.00'));
    expect(statusLine()).toHaveTextContent(/^$/);
    expect(within(mineCol()).getByText('No players on your side yet')).toBeInTheDocument();
    expect(within(oppCol()).getByText('No opponent players yet')).toBeInTheDocument();
    expect(within(mineCol()).getByRole('button', { name: 'Add player to your side' })).toBeInTheDocument();
    expect(within(oppCol()).getByRole('button', { name: 'Add player to opponent side' })).toBeInTheDocument();
  });

  it('keeps the same player on both sides apart and removes only one', async () => {
    seed([warren, opponent(warren)], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(oppCol()).findByText('15.60');
    expect(bar()).toHaveTextContent('Tied');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from opponent side, Office league' }));
    expect(within(oppCol()).getByText('No opponent players yet')).toBeInTheDocument();
    expect(within(mineCol()).getByText('Jaylen Warren')).toBeInTheDocument();
    expect(stored()).toEqual([warren]);
    expect(screen.getByRole('button', { name: 'Add player to opponent side' })).toHaveFocus();
  });

  it('moves focus to the next card in the column, else the previous, else the column Add button after Remove', async () => {
    seed([warren, pitDefense, opponent({ ...mahomes, profileId: 'p1' })], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    expect(pts(mineCol(), 'Pittsburgh Steelers')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(screen.getByRole('button', { name: 'Add player to your side' })).toHaveFocus();
  });

  it('moves focus to the previous card when the last card in a column is removed', async () => {
    seed([warren, pitDefense], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(pts(mineCol(), 'Jaylen Warren')).toHaveFocus();
  });

  it('focuses the next card after Remove once the removal has rendered, and scrolls it clear of the bar', async () => {
    seed([warren, pitDefense], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    const target = pts(mineCol(), 'Pittsburgh Steelers');
    expect(target).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scroll.mock.contexts.at(-1)).toBe(target);
  });

  it('scrolls the opening Add button into view when the dialog closes', async () => {
    seed([], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    const add = screen.getByRole('button', { name: 'Add player to your side' });
    await userEvent.click(add);
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(add).toHaveFocus();
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(add);
  });

  it('joins the page note and the leader phrase into one status string', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: status(500) });
    renderAt('/vs');
    await waitFor(() => expect(statusLine()).toHaveTextContent(/^Live data unavailable, retrying\. Tied$/));
  });

  it('shows Loading instead of a lead until the matchup has settled', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    expect(bar()).toHaveTextContent('You 0.00 Loading Opponent 0.00');
    await waitFor(() => expect(bar()).toHaveTextContent('You lead by 15.60'));
  });

  it('does not blank or repeat the phrase when a card with an uncached, still loading summary is added', async () => {
    const final = scoreboardFixture.events[0]!;
    const kc = { ...final, id: '401872999', competitions: [{ competitors: [
      { homeAway: 'home', score: '10', team: { id: '12', abbreviation: 'KC', displayName: 'Kansas City Chiefs', color: 'aa0000' } },
      { homeAway: 'away', score: '3', team: { id: '13', abbreviation: 'LV', displayName: 'Las Vegas Raiders', color: '000000' } },
    ] }] };
    seed([warren], profilesFixture);
    const board = { events: [...scoreboardFixture.events, kc] };
    mockFetch({ ...routes, scoreboard: board, 'summary?event=401872999': summary });
    const real = globalThis.fetch;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let gatedDone = false;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input).includes('summary?event=401872999')) {
        await gate;
        const res = await real(input);
        gatedDone = true;
        return res;
      }
      return real(input);
    });
    renderAt('/vs');
    await waitFor(() => expect(statusLine()).toHaveTextContent(/^You lead$/));
    const seen: string[] = [];
    new MutationObserver(() => seen.push(statusLine().textContent ?? '')).observe(statusLine(), { childList: true, subtree: true, characterData: true });
    act(() => addEntry({ ...mahomes, profileId: 'p1', side: 'opponent' }));
    await within(oppCol()).findByText('Patrick Mahomes');
    expect(gatedDone).toBe(false); // the new card's summary is still gated here
    expect(statusLine()).toHaveTextContent(/^You lead$/);
    release();
    await waitFor(() => expect(gatedDone).toBe(true));
    await act(async () => { await Promise.resolve(); });
    expect(statusLine()).toHaveTextContent(/^You lead$/);
    expect(seen.filter((t) => t !== 'You lead')).toEqual([]);
  });

  it('stays silent about the leader until the matchup data has settled, then announces it once', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch(routes);
    const real = globalThis.fetch;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let summaryAsked = false;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      if (String(input).includes('summary')) {
        summaryAsked = true;
        await gate;
      }
      return real(input);
    });
    renderAt('/vs');
    await waitFor(() => expect(summaryAsked).toBe(true)); // scoreboard loaded, the summary is the one thing pending
    expect(statusLine()).not.toHaveTextContent(/Tied|lead/);
    release();
    await waitFor(() => expect(statusLine()).toHaveTextContent(/^You lead$/));
  });

  it('starts each Add dialog with an empty search, not the other side\'s last one', async () => {
    seed([], profilesFixture);
    mockFetch({ ...routes, 'search?query=bills': { items: [] }, standings: teams });
    renderAt('/vs');
    await userEvent.click(screen.getByRole('button', { name: 'Add player to your side' }));
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Search'), 'bills');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add player to opponent side' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Search')).toHaveValue('');
  });

  it('publishes the measured score bar height for scroll-padding and clears it on leaving', () => {
    let notify!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { notify = cb; }
      observe() {}
      disconnect = disconnect;
    });
    seed([], profilesFixture);
    const view = renderAt('/vs');
    vi.spyOn(bar(), 'getBoundingClientRect').mockReturnValue({ height: 137.4 } as DOMRect);
    notify();
    expect(document.documentElement.style.getPropertyValue('--score-bar-h')).toBe('138px');
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--score-bar-h')).toBe('');
  });

  it('announces the leader only when the lead changes hands, in the one status line', async () => {
    seed([warren, pitDefense, opponent({ ...mahomes, profileId: 'p1' })], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    expect(document.querySelectorAll('main [role="status"]')).toHaveLength(1);
    expect(bar()).toHaveTextContent('You lead by 21.60');
    expect(statusLine()).toHaveTextContent(/^You lead$/);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pittsburgh Steelers from Office league' }));
    expect(bar()).toHaveTextContent('You lead by 15.60');
    expect(statusLine()).toHaveTextContent(/^You lead$/);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    expect(statusLine()).toHaveTextContent(/^Tied$/);
  });

  it('adds to the opponent side of the picked league and returns focus to its Add button', async () => {
    seed([], profilesFixture);
    mockFetch({ ...routes, 'search?query=bills': { items: [] }, standings: teams });
    renderAt('/vs');
    await userEvent.selectOptions(picker(), 'Friends league');
    const add = screen.getByRole('button', { name: 'Add player to opponent side' });
    await userEvent.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Add to opponent side, Friends league' });
    expect(within(dialog).queryByLabelText('League')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Search'), 'bills');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Add Buffalo Bills, team defense' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(add).toHaveFocus();
    expect(stored()).toEqual([{ kind: 'defense', espnId: '2', name: 'Buffalo Bills', teamId: '2', teamAbbr: 'BUF', position: 'D/ST', profileId: 'p2', side: 'opponent' }]);
    expect(within(oppCol()).getByText('Buffalo Bills')).toBeInTheDocument();
    expect(within(mineCol()).queryByText('Buffalo Bills')).not.toBeInTheDocument();
  });

  it('has the shared pause toggle and shows the paused note in the one status line', async () => {
    seed([warren], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    await userEvent.click(screen.getByRole('button', { name: 'Pause live updates' }));
    expect(screen.getByRole('button', { name: 'Resume live updates' })).toHaveAttribute('aria-pressed', 'true');
    expect(statusLine()).toHaveTextContent('Live updates are paused. The numbers shown may be out of date.');
  });

  it('fetches each game summary once for both sides and all cards', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    const f = mockFetch(routes);
    renderAt('/vs');
    await within(oppCol()).findByText('6.00');
    expect(f.mock.calls.filter(([u]) => String(u).includes('summary'))).toHaveLength(1);
  });

  it('keeps scoring one side when the other side\'s game fails to load', async () => {
    const [final, upcoming] = scoreboardFixture.events;
    // Two live games. The SF game's summary serves the same box score, so an SF-listed copy of Warren scores 15.60 there.
    const live = { ...final!.status, type: { ...final!.status.type, state: 'in', completed: false } };
    const board = { events: [{ ...final!, status: live }, { ...upcoming!, status: live }] };
    seed([warren, opponent({ ...warren, teamId: '25', teamAbbr: 'SF' })], profilesFixture);
    mockFetch({ scoreboard: board, 'summary?event=401872964': status(500), 'summary?event=401872975': summary });
    renderAt('/vs');
    expect(await within(mineCol()).findByText('Live data unavailable, retrying')).toBeInTheDocument();
    await waitFor(() => expect(bar()).toHaveTextContent('You 0.00 Opponent leads by 15.60 Opponent 15.60'));
    expect(within(oppCol()).getByText('15.60')).toBeInTheDocument();
    expect(within(mineCol()).getByText('0.00')).toBeInTheDocument();
    expect(statusLine()).toHaveTextContent('Opponent leads');
  });

  it('announces a changed leader and keeps the text identical while the same side leads', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    expect(statusLine()).toHaveTextContent(/^You lead$/);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Jaylen Warren from Office league' }));
    expect(statusLine()).toHaveTextContent(/^Opponent leads$/);
  });

  it('shows both sides of every league under "All", each card scored with its own league, with Add player but no sync buttons without imported leagues', async () => {
    seed([warren, opponent(pitDefense), { ...warren, profileId: 'p2' }], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findAllByText('Jaylen Warren');
    expect(within(mineCol()).getAllByText('Jaylen Warren')).toHaveLength(1); // league p1 only
    await userEvent.selectOptions(picker(), 'All');
    expect(within(mineCol()).getAllByText('Jaylen Warren')).toHaveLength(2); // both leagues
    expect(within(oppCol()).getByText('Pittsburgh Steelers')).toBeInTheDocument();
    const points = within(mineCol()).getAllByRole('button', { name: /fantasy pts/ }).map((b) => b.textContent);
    expect(new Set(points).size).toBe(2); // PPR and standard score the same game differently
    expect(screen.getAllByRole('button', { name: /^Add player to/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Sync/ })).not.toBeInTheDocument();
  });

  it('only offers "All" when there is more than one league', () => {
    seed([], [profilesFixture[0]!]);
    renderAt('/vs');
    expect(within(picker()).queryByRole('option', { name: 'All' })).not.toBeInTheDocument();
  });

  it('puts my column first, after the score bar', () => {
    seed([], profilesFixture);
    renderAt('/vs');
    const cols = [...document.querySelectorAll('.vs > .vs-col')];
    expect(cols.map((c) => c.getAttribute('aria-labelledby'))).toEqual(['vs-mine', 'vs-opponent']);
    expect(bar().compareDocumentPosition(cols[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
