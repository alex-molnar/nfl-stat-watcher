import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import lineups from '../test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import type { FollowedEntry } from '../storage/types';

const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const league = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: { ...draft.source!, teamId: '1' } };
const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };
const followed = (): FollowedEntry[] => JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]');
const bench = (side?: 'opponent'): FollowedEntry => ({ kind: 'player', espnId: '999', name: 'Bench Guy', teamId: '1', teamAbbr: 'ATL', position: 'WR', profileId: 'p1', ...(side ? { side } : {}) });
const turnOn = () => localStorage.setItem('nflsw:v1:autoSync', 'true');

describe('sync public leagues automatically', () => {
  it('does nothing while the setting is off', async () => {
    const fetchMock = mockFetch(routes);
    seed([bench()], [league]);
    renderAt('/');
    await screen.findByText('Bench Guy');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('mRoster'))).toBe(false);
    expect(followed()).toEqual([bench()]);
  });

  it('on Players it overwrites my side: starters added, every other card of the league removed', async () => {
    mockFetch(routes);
    turnOn();
    seed([bench(), bench('opponent')], [league]); // the league's own "remove non starters" is off
    renderAt('/');
    await waitFor(() => expect(followed().filter((entry) => !entry.side)).toHaveLength(11));
    expect(followed().some((entry) => entry.espnId === '999' && !entry.side)).toBe(false);
    expect(followed().some((entry) => entry.espnId === '999' && entry.side === 'opponent')).toBe(true); // the other side is for Vs
  });

  it('on Vs it overwrites both sides', async () => {
    mockFetch(routes);
    turnOn();
    seed([bench(), bench('opponent')], [league]);
    renderAt('/vs');
    await waitFor(() => expect(followed()).toHaveLength(22));
    expect(followed().some((entry) => entry.espnId === '999')).toBe(false);
    expect(followed().filter((entry) => entry.side === 'opponent')).toHaveLength(11);
  });

  it('syncs again each time the page is opened again', async () => {
    mockFetch(routes);
    turnOn();
    seed([], [league]);
    renderAt('/');
    await waitFor(() => expect(followed()).toHaveLength(11));
    await userEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Settings' }));
    await userEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Players' }));
    await waitFor(() => expect(followed()).toHaveLength(11));
  });

  it('leaves a private league alone', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    turnOn();
    seed([bench()], [league]);
    renderAt('/');
    await screen.findByText('Bench Guy');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(followed()).toEqual([bench()]);
  });

  it('leaves a league alone until you have chosen your team in it', async () => {
    mockFetch(routes);
    turnOn();
    seed([bench()], [{ ...league, source: { ...league.source, teamId: undefined } }]);
    renderAt('/');
    await screen.findByText('Bench Guy');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(followed()).toEqual([bench()]);
  });
});

describe('the setting', () => {
  it('is off by default, under General, and saved with the other settings', async () => {
    renderAt('/settings');
    const box = screen.getByRole('checkbox', { name: 'Sync public leagues automatically' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(localStorage.getItem('nflsw:v1:autoSync')).toBe('false');
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Settings categories' })).getByRole('button', { name: 'Save' }));
    expect(localStorage.getItem('nflsw:v1:autoSync')).toBe('true');
  });
});
