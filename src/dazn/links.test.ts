import { readFileSync } from 'node:fs';
import { daznLinksStore } from '../storage/dazn';
import standings from '../test/fixtures/standings.json';
import { scoreboardFixture } from '../test/data';
import { mockFetch, status } from '../test/mockFetch';
import { toGames } from '../stats/scoreboard';
import { mapGames, parseDaznGameLink, parseScheduleTiles, syncDaznLinks } from './links';

const html = readFileSync('src/test/fixtures/dazn-schedule.html', 'utf8');
const teams = (standings as unknown as { children: { standings: { entries: { team: never }[] } }[] }).children.flatMap((c) => c.standings.entries.map((e) => e.team));

describe('parseScheduleTiles', () => {
  it('reads only the "Live and Coming Up" row, with paths that drop the region', () => {
    const tiles = parseScheduleTiles(html);
    expect(tiles.map((t) => t.title)).not.toContain('Lions @ Panthers'); // the replays row
    expect(tiles[0]).toEqual({ title: 'Steelers @ Browns', path: '/home/90ron9qd9fog01f4vc4z6lp4q3/11bnuzsh22vg411s8mbn118yhp' });
  });

  it('fails visibly when the row is missing', () => {
    expect(() => parseScheduleTiles('<html><body></body></html>')).toThrow(/Live and Coming Up/);
  });
});

describe('mapGames', () => {
  const games = toGames(scoreboardFixture as never);
  const steelers = games.find((g) => g.home.abbr === 'CLE' && g.away.abbr === 'PIT')!;

  it('maps a game by exactly "away @ home" and ignores the broadcast variants, previews and Manningcast', () => {
    expect(steelers).toBeDefined();
    const links = mapGames(parseScheduleTiles(html), games, teams as never);
    expect(links[steelers.eventId]).toBe('/home/90ron9qd9fog01f4vc4z6lp4q3/11bnuzsh22vg411s8mbn118yhp');
    expect(Object.values(links).some((p) => p.includes('kqdycr9') || p.includes('ogtsexs') || p.includes('ArticleId') || p.includes('1f1qzsnt9'))).toBe(false);
  });

  it('leaves unlisted games unmapped', () => {
    expect(Object.keys(mapGames([], games, teams as never))).toHaveLength(0);
  });
});

describe('syncDaznLinks', () => {
  it('asks our own origin (never dazn.com directly), saves the mapping and when it happened', async () => {
    const fetchMock = mockFetch({});
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/dazn/en-NL/competition/Competition:wy3kluvb4efae1of0d8146c1?tab=schedule')) return new Response(html, { status: 200 });
      if (url.includes('scoreboard')) return new Response(JSON.stringify(scoreboardFixture), { status: 200 });
      return new Response(JSON.stringify(standings), { status: 200 });
    });
    const { stored } = await syncDaznLinks();
    expect(Object.keys(stored.links)).toEqual(['401872964']);
    expect(daznLinksStore.get()).toEqual(stored);
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes('www.dazn.com'))).toBe(true);
  });

  it('reports a failing DAZN request and keeps the old links', async () => {
    daznLinksStore.set({ syncedAt: 'earlier', links: { '1': '/home/a/b' }, manual: {} });
    mockFetch({ '/dazn/': status(502) });
    await expect(syncDaznLinks()).rejects.toThrow('DAZN answered 502');
    expect(daznLinksStore.get().links).toEqual({ '1': '/home/a/b' });
  });
});

describe('parseDaznGameLink', () => {
  it('takes a pasted game address of any region, or just the path', () => {
    expect(parseDaznGameLink('https://www.dazn.com/en-NL/home/abc123/def456')).toBe('/home/abc123/def456');
    expect(parseDaznGameLink(' https://dazn.com/de-DE/home/abc123/def456?x=1#y ')).toBe('/home/abc123/def456');
    expect(parseDaznGameLink('/home/abc123/def456')).toBe('/home/abc123/def456');
  });

  it('refuses anything that is not a game page', () => {
    for (const bad of ['', 'hello', 'https://example.com/en-NL/home/abc/def', 'https://www.dazn.com/en-NL/competition/Competition:x', 'https://www.dazn.com/en-NL/home/ArticleId:x/y']) {
      expect(parseDaznGameLink(bad)).toBeNull();
    }
  });
});

describe('the user\'s own links', () => {
  it('survive a sync, which only replaces what it found', async () => {
    daznLinksStore.set({ syncedAt: null, links: {}, manual: { '999': '/home/mine/mine' } });
    mockFetch({}).mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/dazn/')) return new Response(html, { status: 200 });
      return new Response(JSON.stringify(url.includes('scoreboard') ? scoreboardFixture : standings), { status: 200 });
    });
    await syncDaznLinks();
    expect(daznLinksStore.get().manual).toEqual({ '999': '/home/mine/mine' });
    expect(Object.keys(daznLinksStore.get().links)).toEqual(['401872964']);
  });
});

