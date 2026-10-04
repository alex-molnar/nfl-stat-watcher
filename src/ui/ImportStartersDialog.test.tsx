import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import lineups from '../test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const league = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: draft.source };
const followed = (): { espnId: string; side?: string; position: string; teamAbbr: string }[] => JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]');
const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };

describe('import starters', () => {
  it('hides the button until a league has been imported', async () => {
    mockFetch(routes);
    seed([], [{ ...league, source: undefined }]);
    renderAt('/');
    expect(screen.queryByRole('button', { name: 'Import starters' })).not.toBeInTheDocument();
  });

  it('adds the starters of the chosen team, remembers the team and skips duplicates the second time', async () => {
    mockFetch(routes);
    seed([], [league]);
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Import starters' }));
    await userEvent.selectOptions(await screen.findByLabelText('Your team in this league'), '1');
    expect(await screen.findByRole('region', { name: /Starters for/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Add 11 your starters/ }));
    expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    const added = followed();
    expect(added).toHaveLength(11);
    expect(added.find((entry) => entry.espnId === '3117251')).toMatchObject({ position: 'RB', teamAbbr: 'SF' });
    expect(added.some((entry) => entry.side)).toBe(false);
    expect(JSON.parse(localStorage.getItem('nflsw:v1:profiles')!)[0].source.teamId).toBe('1');
    await userEvent.click(screen.getByRole('button', { name: /^Add 11 your starters/ }));
    expect(await screen.findByText('Added 0 starters, 11 already followed.')).toBeInTheDocument();
    expect(followed()).toHaveLength(11);
  });

  it('adds the opponent of the remembered team on the Vs screen, on the opponent side', async () => {
    mockFetch(routes);
    seed([], [{ ...league, source: { ...league.source, teamId: '9' } }]);
    renderAt('/vs');
    await userEvent.click(screen.getByRole('button', { name: 'Import opponent starters' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Add 11 opponent starters/ }));
    expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    expect(followed().every((entry) => entry.side === 'opponent')).toBe(true);
  });

  it('asks for the rosters to be pasted when ESPN says the league is private', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Import starters' }));
    expect(await screen.findByText(/This league is private/)).toBeInTheDocument();
    const area = screen.getByLabelText(/Rosters JSON for/);
    await userEvent.click(area);
    await userEvent.paste('oops');
    await userEvent.click(screen.getByRole('button', { name: /Use pasted rosters/ }));
    expect(await screen.findByText(/not valid JSON/)).toBeInTheDocument();
    await userEvent.clear(area);
    await userEvent.click(area);
    await userEvent.paste(JSON.stringify(lineups));
    await userEvent.click(screen.getByRole('button', { name: /Use pasted rosters/ }));
    expect(await screen.findByLabelText('Your team in this league')).toBeInTheDocument();
  });
});
