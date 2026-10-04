import { vi } from 'vitest';
import standings from '../test/fixtures/standings.json';
import { EspnError, getScoreboard, getTeams, getSummary, searchPlayers } from './client';

const okFetch = (body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe('espn client', () => {
  it('requests the summary for an event', async () => {
    const f = okFetch({ header: { id: '1', competitions: [] }, boxscore: {} });
    vi.stubGlobal('fetch', f);
    await getSummary('401872964');
    expect(f).toHaveBeenCalledWith(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401872964',
    );
  });

  it('encodes the search query and keeps only NFL players', async () => {
    const f = okFetch({
      items: [
        { id: '3918298', displayName: 'Josh Allen', league: 'nfl' },
        { id: '4892153', displayName: 'Josh Allen', league: 'college-football' },
      ],
    });
    vi.stubGlobal('fetch', f);
    const items = await searchPlayers('josh allen');
    expect(f).toHaveBeenCalledWith(
      'https://site.web.api.espn.com/apis/common/v3/search?query=josh%20allen&limit=10&type=player',
    );
    expect(items).toEqual([{ id: '3918298', displayName: 'Josh Allen', league: 'nfl' }]);
  });

  it('returns an empty list when search has no items field', async () => {
    vi.stubGlobal('fetch', okFetch({}));
    expect(await searchPlayers('zz')).toEqual([]);
  });

  it('lists the 32 teams from the CORS-enabled standings endpoint, not /teams', async () => {
    const f = okFetch(standings);
    vi.stubGlobal('fetch', f);
    const teams = await getTeams();
    expect(f).toHaveBeenCalledWith('https://site.api.espn.com/apis/v2/sports/football/nfl/standings');
    expect(teams).toHaveLength(32);
    expect(teams.find((t) => t.abbreviation === 'PIT')?.displayName).toBe('Pittsburgh Steelers');
  });

  it('throws EspnError with the status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    await expect(getScoreboard()).rejects.toMatchObject({ name: 'EspnError', status: 503 });
    await expect(getScoreboard()).rejects.toBeInstanceOf(EspnError);
  });
});
