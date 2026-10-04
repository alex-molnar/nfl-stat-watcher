import { screen } from '@testing-library/react';
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
    await userEvent.click(screen.getByRole('button', { name: 'Add Josh Allen' }));
    expect(stored()).toEqual([{ kind: 'player', espnId: '3918298', name: 'Josh Allen', teamId: '2', teamAbbr: 'BUF', position: 'QB', jersey: '17', profileId: 'p2' }]);
    expect(screen.getByRole('button', { name: 'Josh Allen added' })).toBeDisabled();
  });

  it('finds a team defense by nickname', async () => {
    mockFetch({ scoreboard: scoreboardFixture, 'search?query=bills': { items: [] }, standings: teams });
    await openDialog();
    await userEvent.type(screen.getByLabelText('Search'), 'bills');
    await userEvent.click(await screen.findByRole('button', { name: 'Add Buffalo Bills' }));
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

  it('closes with the close button', async () => {
    mockFetch({ scoreboard: scoreboardFixture, standings: teams });
    const dialog = await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog).not.toHaveAttribute('open');
  });
});
