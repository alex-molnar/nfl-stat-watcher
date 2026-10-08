import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { getScoreboard } from '../espn/client';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import lineups from '../test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import { track } from './track';

// What the app reports where the events happen. The counting itself is tested in track.test.ts and collector/.
vi.mock('./track', () => ({ track: vi.fn(), trackBeat: vi.fn(), trackVital: vi.fn(), countingAllowed: () => false }));

const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const league = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: draft.source };
const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };
const opener = () => within(screen.getByRole('group', { name: 'Page actions' })).getByRole('button', { name: 'Sync starters' });
const events = (name: string) => vi.mocked(track).mock.calls.filter(([event]) => event === name);

async function loadLeague(id = '1900128084') {
  await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
  await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), id);
  await userEvent.clear(screen.getByLabelText('Season'));
  await userEvent.type(screen.getByLabelText('Season'), '2026');
  await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
}

describe('what a league import reports', () => {
  it('a public league: loaded, then imported as public, new, with the approximations it was warned about', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': settings });
    renderAt('/leagues');
    await loadLeague();
    await screen.findByText(/League 1900128084 · Season 2026/);
    expect(track).toHaveBeenCalledWith('league_load', { result: 'ok' });
    expect(events('league_import')).toHaveLength(0); // looking is not importing
    await userEvent.click(screen.getByLabelText(/Import the approximate profile for league 1900128084/));
    await userEvent.click(screen.getByRole('button', { name: /Import selected leagues/ }));
    await screen.findByText('Imported 1 league and saved the profiles.');
    expect(events('league_import')).toEqual([['league_import', { transport: 'public-api', mode: 'new', issues: 'some' }]]);
  });

  it('a private league: reported as private, then as imported from a settings file once pasted', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': status(401) });
    renderAt('/leagues');
    await loadLeague();
    await screen.findByText('This league is private you need to copy the settings manually');
    expect(track).toHaveBeenCalledWith('league_load', { result: 'private' });
    await userEvent.click(screen.getByRole('link', { name: 'Open Settings' }));
    await userEvent.click(screen.getByLabelText('Settings JSON for league 1900128084, season 2026'));
    await userEvent.paste(JSON.stringify(settings));
    await userEvent.click(await screen.findByLabelText(/Import the approximate profile for league 1900128084/));
    await userEvent.click(screen.getByRole('button', { name: /Import selected leagues/ }));
    await screen.findByText('Imported 1 league and saved the profiles.');
    expect(events('league_import')).toEqual([['league_import', { transport: 'settings-file', mode: 'new', issues: 'some' }]]);
  });

  it('a league that cannot be loaded is an error, not a private league', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': status(500) });
    renderAt('/leagues');
    await loadLeague();
    await screen.findByText('ESPN settings request failed (500)');
    expect(track).toHaveBeenCalledWith('league_load', { result: 'error' });
  });

  it('never carries a league id, a name or anything else beyond the fixed labels', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': settings });
    renderAt('/leagues');
    await loadLeague();
    await screen.findByText(/League 1900128084 · Season 2026/);
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/1900128084|Tapai/);
  });
});

describe('what syncing starters reports', () => {
  it('a sync: the rosters loaded, then which side was synced', async () => {
    mockFetch(routes);
    seed([], [league]);
    renderAt('/');
    await userEvent.click(opener());
    await userEvent.selectOptions(await screen.findByLabelText('Your team in this league'), '1');
    expect(track).toHaveBeenCalledWith('sync_load', { result: 'ok' });
    expect(events('sync')).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync starters' }));
    await screen.findByText('Added 11 starters.');
    expect(events('sync')).toEqual([['sync', { side: 'mine', leagues: 'one' }]]);
  });

  it('a private league: reported as private, with each step of the help that gets used', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(); // jsdom cannot play video
    const user = userEvent.setup();
    renderAt('/');
    await user.click(opener());
    await screen.findByText(/This league is private/);
    expect(track).toHaveBeenCalledWith('sync_load', { result: 'private' });

    const bookmarkBox = screen.getByRole('region', { name: 'Create bookmark' });
    await user.click(within(bookmarkBox).getByRole('button', { name: 'How?' }));
    await user.click(within(screen.getByRole('region', { name: 'Copy roster data manually' })).getByRole('button', { name: 'How?' }));
    await user.click(within(bookmarkBox).getByRole('button', { name: 'Copy bookmark' }));
    await user.click(within(bookmarkBox).getByRole('button', { name: 'Watch video' }));
    expect(events('help').map(([, labels]) => labels)).toEqual([
      { step: 'how_bookmark' },
      { step: 'how_rosters' },
      { step: 'copy_bookmark' },
      { step: 'video' },
    ]);

    await user.click(screen.getByLabelText('Roster data'));
    await user.paste(JSON.stringify(lineups)); // pasted by hand: the sync can go on
    await screen.findByLabelText('Your team in this league');
    expect(track).toHaveBeenCalledWith('sync_load', { result: 'ok' });
  });
});

describe('what a failed ESPN request reports', () => {
  let clock = Date.now(); // later than anything the tests above reported in real time
  beforeEach(() => {
    clock += 3_600_000; // every test starts an hour after the last, outside the once-a-minute window
    vi.useFakeTimers({ toFake: ['Date'], now: clock });
  });
  afterEach(() => vi.useRealTimers());

  it('counts an error status by its class, once a minute however often the polling retries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    for (let i = 0; i < 3; i += 1) await expect(getScoreboard()).rejects.toThrow('503');
    expect(events('fetch_error')).toEqual([['fetch_error', { kind: '5xx' }]]);
    vi.setSystemTime(clock + 61_000);
    await expect(getScoreboard()).rejects.toThrow();
    expect(events('fetch_error')).toHaveLength(2);
  });

  it('counts a request that never got an answer as a network failure, and a 404 as a 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(getScoreboard()).rejects.toThrow('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(getScoreboard()).rejects.toThrow('404');
    expect(events('fetch_error')).toEqual([['fetch_error', { kind: 'network' }], ['fetch_error', { kind: '4xx' }]]);
  });
});
