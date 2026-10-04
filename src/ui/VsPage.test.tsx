import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import teams from '../test/fixtures/standings.json';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
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
    expect(screen.getAllByLabelText('League')).toContain(picker());
  });

  it('shows the league select on my cards only', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    await within(mineCol()).findByText('15.60');
    expect(within(mineCol()).getByLabelText('League')).toBeInTheDocument();
    expect(within(oppCol()).queryByLabelText('League')).not.toBeInTheDocument();
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
    expect(keys.every((k) => ['nflsw:v1:followed', 'nflsw:v1:profiles', 'nflsw:v1:theme'].includes(k!))).toBe(true);
  });

  it('renders an empty matchup as a tie with both Add buttons', () => {
    seed([], profilesFixture);
    mockFetch(routes);
    renderAt('/vs');
    expect(bar()).toHaveTextContent('You 0.00 Tied Opponent 0.00');
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

  it('puts my column first, after the score bar', () => {
    seed([], profilesFixture);
    renderAt('/vs');
    const cols = [...document.querySelectorAll('.vs > .vs-col')];
    expect(cols.map((c) => c.getAttribute('aria-labelledby'))).toEqual(['vs-mine', 'vs-opponent']);
    expect(bar().compareDocumentPosition(cols[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
