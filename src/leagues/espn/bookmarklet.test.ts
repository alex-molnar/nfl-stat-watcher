import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { readLineups } from './lineup';
import { rosterBookmarklet } from './bookmarklet';

const full = JSON.parse(readFileSync('src/test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json', 'utf8')) as {
  id: number; teams: { id: number; roster: { entries: { lineupSlotId: number; playerPoolEntry: { player: Record<string, unknown> } }[] } }[]; schedule: unknown[];
};
// What ESPN really sends: the same, plus bulky per-player statistics, members and the rest.
const bulky = { ...full, members: [{ displayName: 'someone private' }], teams: full.teams.map((t) => ({ ...t, roster: { entries: t.roster.entries.map((e) => ({ ...e, playerPoolEntry: { ...e.playerPoolEntry, player: { ...e.playerPoolEntry.player, stats: Array(40).fill({ appliedTotal: 1 }) } } })) } })) };

function run(response: { ok: boolean; status?: number; json?: unknown }, clipboard: 'ok' | 'denied' = 'ok') {
  const fetched: { url: string; init: unknown }[] = [];
  const copied: string[] = [];
  const alerts: string[] = [];
  const prompts: string[] = [];
  const code = decodeURIComponent(rosterBookmarklet('409479118', '2026').replace(/^javascript:/, ''));
  const fn = new Function('fetch', 'navigator', 'alert', 'prompt', `return ${code}`);
  const done = fn(
    async (url: string, init: unknown) => { fetched.push({ url, init }); return { ok: response.ok, status: response.status ?? 200, json: async () => response.json }; },
    { clipboard: { writeText: async (text: string) => { if (clipboard === 'denied') throw new Error('denied'); copied.push(text); } } },
    (message: string) => alerts.push(message),
    (message: string, text: string) => prompts.push(`${message}|${text}`),
  ) as Promise<void>;
  return { done, fetched, copied, alerts, prompts };
}

describe('roster bookmarklet', () => {
  it('is a javascript: link with no raw quotes or newlines that would break an href', () => {
    const link = rosterBookmarklet('409479118', '2026');
    expect(link.startsWith('javascript:')).toBe(true);
    expect(link).not.toMatch(/[\n"' ]/);
  });

  it('asks ESPN for the roster view of exactly this league and season, with the user\'s cookies', async () => {
    const r = run({ ok: true, json: bulky });
    await r.done;
    expect(r.fetched[0]!.url).toBe('https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/409479118?view=mRoster&view=mTeam&view=mMatchupScore');
    expect(r.fetched[0]!.init).toEqual({ credentials: 'include' });
  });

  it('copies a trimmed payload that the app reads exactly as it reads the full response, without statistics or members', async () => {
    const r = run({ ok: true, json: bulky });
    await r.done;
    const text = r.copied[0]!;
    expect(text.length).toBeLessThan(JSON.stringify(bulky).length / 5);
    expect(text).not.toContain('appliedTotal');
    expect(text).not.toContain('someone private');
    const fromBookmarklet = readLineups(text, String(full.id), '2026');
    const fromFull = readLineups(JSON.stringify(full), String(full.id), '2026');
    expect(fromBookmarklet).toEqual(fromFull);
    expect(r.alerts[0]).toMatch(/copied/);
  });

  it('shows the text to copy by hand when the browser refuses clipboard access', async () => {
    const r = run({ ok: true, json: bulky }, 'denied');
    await r.done;
    expect(r.copied).toEqual([]);
    expect(r.prompts).toHaveLength(1);
    expect(r.prompts[0]).toContain('"teams"');
  });

  it('says what went wrong when ESPN refuses the account, or errors', async () => {
    const denied = run({ ok: false, status: 401 });
    await denied.done;
    expect(denied.alerts[0]).toMatch(/cannot see the league/);
    const broken = run({ ok: false, status: 500 });
    await broken.done;
    expect(broken.alerts[0]).toMatch(/ESPN answered 500/);
    expect(denied.copied).toEqual([]);
  });

  it('refuses ids that are not plain numbers', () => {
    expect(() => rosterBookmarklet('1"; alert(1); "', '2026')).toThrow();
    expect(() => rosterBookmarklet('123', '20x6')).toThrow();
    vi.restoreAllMocks();
  });
});
