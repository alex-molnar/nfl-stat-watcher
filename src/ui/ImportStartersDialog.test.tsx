import { screen, within } from '@testing-library/react';
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
const opener = () => screen.getByRole('button', { name: 'Sync starters' });
const sync = () => userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync starters' }));
const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };

describe('sync starters', () => {
  it('hides the button until a league has been imported', async () => {
    mockFetch(routes);
    seed([], [{ ...league, source: undefined }]);
    renderAt('/');
    expect(screen.queryByRole('button', { name: 'Sync starters' })).not.toBeInTheDocument();
  });

  it('adds the starters of the chosen team, remembers the team and skips duplicates the second time', async () => {
    mockFetch(routes);
    seed([], [league]);
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sync starters' }));
    await userEvent.selectOptions(await screen.findByLabelText('Your team in this league'), '1');
    expect(await screen.findByRole('region', { name: /Starters for/ })).toBeInTheDocument();
    await sync();
    expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // syncing closes the dialog
    const added = followed();
    expect(added).toHaveLength(11);
    expect(added.find((entry) => entry.espnId === '3117251')).toMatchObject({ position: 'RB', teamAbbr: 'SF' });
    expect(added.some((entry) => entry.side)).toBe(false);
    expect(JSON.parse(localStorage.getItem('nflsw:v1:profiles')!)[0].source.teamId).toBe('1');
    await userEvent.click(opener());
    await sync();
    expect(await screen.findByText('Added 0 starters, 11 already followed.')).toBeInTheDocument();
    expect(followed()).toHaveLength(11);
  });

  it('adds the opponent of the remembered team on the Vs screen, on the opponent side', async () => {
    mockFetch(routes);
    seed([], [{ ...league, source: { ...league.source, teamId: '9' } }]);
    renderAt('/vs');
    await userEvent.click(screen.getByRole('button', { name: 'Sync opponent starters' }));
    await screen.findByRole('region', { name: /Starters for/ });
    await sync();
    expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    expect(followed().every((entry) => entry.side === 'opponent')).toBe(true);
  });

  it('asks for the rosters to be pasted when ESPN says the league is private', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await userEvent.click(screen.getByRole('button', { name: 'Sync starters' }));
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

  describe('removing non starters', () => {
    const extra = (espnId: string, name: string, over: object = {}) => ({ kind: 'player' as const, espnId, name, teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1', ...over });
    const open = async () => {
      mockFetch(routes);
      seed([extra('3117251', 'Christian McCaffrey', { position: 'RB' }), extra('999', 'Bench Guy'), extra('998', 'Other league guy', { profileId: 'p2' })], [{ ...league, source: { ...league.source, teamId: '1' } }, { ...league, id: 'p2', name: 'Second' }]);
      renderAt('/');
      await userEvent.click(screen.getByRole('button', { name: 'Sync starters' }));
      return screen.findByRole('region', { name: /Starters for/ });
    };
    const list = (region: HTMLElement, title: RegExp) => within(region).getByRole('heading', { name: title }).parentElement!;

    it('shows added, removed and unchanged lists, and keeps non starters by default', async () => {
      const region = await open();
      const checkbox = screen.getByRole('checkbox', { name: 'Remove every non starter player' });
      expect(checkbox).not.toBeChecked();
      expect(list(region, /^To be added \(10\)/)).toHaveClass('plan-added');
      expect(list(region, /^To be removed \(0\)/)).toHaveClass('plan-removed');
      expect(within(list(region, /^Unchanged \(2\)/)).getByText(/Bench Guy/)).toBeInTheDocument();
      await sync();
      expect(await screen.findByText('Added 10 starters, 2 already followed.')).toBeInTheDocument();
      expect(followed().some((entry) => entry.espnId === '999')).toBe(true);
    });

    it('moves followed non starters to the red list when ticked, and removes them on import, in this league only', async () => {
      const region = await open();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Remove every non starter player' }));
      const removed = list(region, /^To be removed \(1\)/);
      expect(removed).toHaveClass('plan-removed');
      expect(within(removed).getByText(/Bench Guy/)).toBeInTheDocument();
      expect(within(list(region, /^Unchanged \(1\)/)).getByText(/Christian McCaffrey/)).toBeInTheDocument();
      await sync();
      expect(await screen.findByText('Added 10 starters, removed 1.')).toBeInTheDocument();
      const left = JSON.parse(localStorage.getItem('nflsw:v1:followed') ?? '[]') as { espnId: string; profileId: string }[];
      expect(left.some((entry) => entry.espnId === '999')).toBe(false);
      expect(left).toHaveLength(12); // 11 starters in this league plus the other league's card
      expect(left.some((entry) => entry.espnId === '998' && entry.profileId === 'p2')).toBe(true);
    });

    it('remembers the choice for this league, and not for another', async () => {
      await open();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Remove every non starter player' }));
      const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:profiles')!) as { id: string; source?: { removeNonStarters?: boolean } }[];
      expect(stored().find((p) => p.id === 'p1')!.source!.removeNonStarters).toBe(true);
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close sync starters dialog' }));
      await userEvent.click(opener());
      expect(await screen.findByRole('checkbox', { name: 'Remove every non starter player' })).toBeChecked(); // still ticked next time
      expect(stored().find((p) => p.id === 'p2')?.source?.removeNonStarters).toBeUndefined();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Remove every non starter player' }));
      expect(stored().find((p) => p.id === 'p1')!.source!.removeNonStarters).toBeUndefined(); // unticking is remembered too
    });

    it('keeps the choice when the league is refreshed from ESPN', async () => {
      const { commitLeagueImports } = await import('../leagues/import');
      await open();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Remove every non starter player' }));
      const profile = (JSON.parse(localStorage.getItem('nflsw:v1:profiles')!) as { id: string }[])[0]!;
      commitLeagueImports([draft], [{ sourceIdentity: `espn:${draft.source.leagueId}:${draft.source.season}`, profileId: profile.id, localEditDecision: 'replace' }]);
      const refreshed = (JSON.parse(localStorage.getItem('nflsw:v1:profiles')!) as { id: string; source: { removeNonStarters?: boolean; teamId?: string } }[]).find((p) => p.id === profile.id)!;
      expect(refreshed.source.removeNonStarters).toBe(true);
      expect(refreshed.source.teamId).toBe('1');
    });
  });
});
