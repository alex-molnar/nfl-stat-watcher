import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import teams from '../test/fixtures/standings.json';
import { profilesFixture, scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const search = {
  items: [
    { id: '3918298', displayName: 'Josh Allen', league: 'nfl' },
    { id: '4892153', displayName: 'Josh Allen', league: 'college-football' },
  ],
};
const allen = { athlete: { id: '3918298', displayName: 'Josh Allen', jersey: '17', position: { abbreviation: 'QB' }, team: { id: '2', abbreviation: 'BUF' } } };
const twoNfl = { items: [search.items[0], { id: '4892153', displayName: 'Josh Allen', league: 'nfl' }] };
const wyo = { athlete: { ...allen.athlete, id: '4892153', team: { id: '9', abbreviation: 'WYO' } } };
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]');

async function openDialog() {
  renderAt('/');
  await userEvent.click(screen.getAllByRole('button', { name: 'Add player' })[0]!);
  return screen.getByRole('dialog', { name: 'Add a player or defense' });
}

describe('add dialog', () => {
  beforeEach(() => seed([], profilesFixture));

  it('finds an NFL player, shows team and position, and adds them to the chosen league', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': search, 'athletes/3918298': allen, standings: teams });
    await openDialog();
    await userEvent.selectOptions(screen.getByLabelText('League'), 'Friends league');
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    expect(await screen.findByText('BUF QB')).toBeInTheDocument();
    expect(screen.getAllByText('Josh Allen')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add Josh Allen, BUF QB' }));
    expect(stored()).toEqual([{ kind: 'player', espnId: '3918298', name: 'Josh Allen', teamId: '2', teamAbbr: 'BUF', position: 'QB', jersey: '17', profileId: 'p2' }]);
    const added = screen.getByRole('button', { name: 'Josh Allen added' });
    expect(added).toHaveAttribute('aria-disabled', 'true');
    expect(added).toHaveFocus();
    await userEvent.click(added);
    expect(stored()).toHaveLength(1);
  });

  it('finds a team defense by nickname', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=bills': { items: [] }, standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    await userEvent.click(await screen.findByRole('button', { name: 'Add Buffalo Bills, team defense' }));
    expect(stored()[0]).toMatchObject({ kind: 'defense', espnId: '2', teamId: '2', teamAbbr: 'BUF', position: 'D/ST', profileId: 'p1' });
  });

  it('says when nothing matches', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=zzzz': { items: [] }, standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'zzzz');
    expect(await screen.findByText('No NFL player or team matches "zzzz".')).toBeInTheDocument();
  });

  it('explains when search is unavailable', async () => {
    mockFetch({ scoreboard: scoreboardFixture, search: status(500), standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'purdy');
    expect(await screen.findByText('Search is unavailable right now. Try again in a moment.')).toBeInTheDocument();
  });

  it('says details are unavailable, not free agent, when the athlete lookup fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': search, 'athletes/3918298': status(500), standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    expect(await screen.findByText('Details unavailable', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Free agent')).not.toBeInTheDocument();
  });

  it('closes with the close button', async () => {
    mockFetch({ scoreboard: scoreboardFixture, standings: teams });
    const dialog = await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog).not.toHaveAttribute('open');
  });

  it('says team defenses are unavailable, not that search is down, when only the team list fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=bills': { items: [] }, standings: status(500) });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    expect(await screen.findByText('Team defenses are unavailable right now. No NFL player matches "bills".')).toBeInTheDocument();
    expect(screen.queryByText(/Search is unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No NFL player or team matches/)).not.toBeInTheDocument();
  });

  it('still shows player results when only the team list fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': search, 'athletes/3918298': allen, standings: status(500) });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    expect(await screen.findByRole('button', { name: 'Add Josh Allen, BUF QB' })).toBeInTheDocument();
    expect(screen.getByText('Team defenses are unavailable right now. Showing players only.')).toBeInTheDocument();
    expect(screen.queryByText(/Search is unavailable/)).not.toBeInTheDocument();
  });

  it('shows team defenses with an accurate message when only player search fails', async () => {
    mockFetch({ scoreboard: scoreboardFixture, search: status(500), standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    expect(await screen.findByText('Player search is unavailable right now. Showing team defenses only.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Buffalo Bills, team defense' })).toBeInTheDocument();
  });

  it('puts focus in the search field on open', async () => {
    mockFetch({ scoreboard: scoreboardFixture, standings: teams });
    await openDialog();
    expect(screen.getByLabelText('Search')).toHaveFocus();
  });

  it('announces a result count through one status region, not a live list', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': twoNfl, 'athletes/3918298': allen, 'athletes/4892153': wyo, standings: teams });
    const dialog = await openDialog();
    expect(dialog.querySelector('.results')).not.toHaveAttribute('aria-live');
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    const status = within(dialog).getByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('2 results'));
  });

  it('tells two same-named players apart by team and position', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=josh%20allen': twoNfl, 'athletes/3918298': allen, 'athletes/4892153': wyo, standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'josh allen');
    expect(await screen.findByRole('button', { name: 'Add Josh Allen, BUF QB' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Add Josh Allen, WYO QB' })).toBeInTheDocument();
  });
});
