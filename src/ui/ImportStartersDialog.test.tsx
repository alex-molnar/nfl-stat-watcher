import { fireEvent, screen, within } from '@testing-library/react';
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
// The header's button: with nobody followed the empty state offers one too, in the speech bubble.
const opener = () => within(screen.getByRole('banner')).getByRole('button', { name: 'Sync starters' });
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
    await userEvent.click(opener());
    await userEvent.selectOptions(await screen.findByLabelText('Your team in this league'), '1');
    expect(screen.queryByText(/Starters in the current matchup/)).not.toBeInTheDocument();
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
    await userEvent.click(opener());
    const notice = await screen.findByText(/This league is private/);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).not.toHaveClass('error');
    expect(screen.getByText(/Drag the below button to your bookmarks bar/)).toBeInTheDocument();
    expect(document.querySelector('.private-help summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/Once per browser/)).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sync' });
    expect(link).toHaveClass('btn-primary');
    expect(link).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('button', { name: 'Copy bookmark' })).toBeInTheDocument();
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(link.getAttribute('href')).toMatch(/^javascript:/);
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('leagues/1900128084?view=mRoster');
    await userEvent.click(link); // clicking it on our own page must not run it
    expect(await screen.findByText(/drag it to your bookmarks bar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to league' })).toHaveAttribute('href', 'https://fantasy.espn.com/football/league?leagueId=1900128084&seasonId=2026');
    expect(screen.getByRole('link', { name: 'Go to league source' })).toHaveAttribute('href', expect.stringContaining('leagues/1900128084?view=mRoster'));
    expect(screen.queryByText(/Starters in the current matchup/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rosters JSON/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import these rosters' })).not.toBeInTheDocument();
    const area = screen.getByLabelText('Roster data');
    await userEvent.click(area);
    await userEvent.paste('oops'); // pasting alone checks it: no button to press
    expect(await screen.findByText(/not valid JSON/)).toBeInTheDocument();
    expect(screen.getByLabelText('Roster data')).toHaveValue('oops'); // what was pasted stays visible beside the error
    await userEvent.click(area);
    await userEvent.paste(JSON.stringify(lineups)); // a valid paste goes straight on, replacing the bad text
    expect(await screen.findByLabelText('Your team in this league')).toBeInTheDocument();
  });

  it('copies the same Sync bookmark and pauses the demonstration while the real bookmark is dragged', async () => {
    const user = userEvent.setup();
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await user.click(opener());
    const bookmark = await screen.findByRole('link', { name: 'Sync' });
    await user.click(screen.getByRole('button', { name: 'Copy bookmark' }));
    expect(await navigator.clipboard.readText()).toBe(bookmark.getAttribute('href'));
    expect(await screen.findByText('Copied. Create a bookmark and paste this as its address.')).toBeInTheDocument();
    expect(document.querySelector('.bookmark-drag-guide')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.dragStart(bookmark);
    expect(document.querySelector('.bookmark-drag-guide')).not.toBeInTheDocument();
    expect(bookmark).toHaveAttribute('draggable', 'true');
    fireEvent.dragEnd(bookmark);
    expect(document.querySelector('.bookmark-drag-guide')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.bookmark-drag-guide')).not.toBeInTheDocument();
  });

  it('explains bookmark setup and manual copying in separate hover hints', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await userEvent.click(opener());
    const bookmarkBox = await screen.findByRole('region', { name: 'Create bookmark' });
    const bookmarkHow = within(bookmarkBox).getByRole('button', { name: 'How?' });
    await userEvent.hover(bookmarkHow);
    expect(within(screen.getByRole('tooltip')).getByText('Fumble · Create bookmark')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('address or URL field');
    await userEvent.unhover(bookmarkHow);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    const manualHow = within(screen.getByRole('region', { name: 'Copy roster data manually' })).getByRole('button', { name: 'How?' });
    await userEvent.click(manualHow);
    expect(within(screen.getByRole('tooltip')).getByText('Fumble · Copy roster data')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl+A');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl+C');
    await userEvent.unhover(manualHow);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('remembers hiding bookmark setup and restores it after saving the Site settings preference', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await userEvent.click(opener());
    await userEvent.click(await screen.findByRole('button', { name: 'Don’t show this option again' }));
    expect(localStorage.getItem('nflsw:v1:bookmarkHelp')).toBe('false');
    expect(screen.queryByRole('region', { name: 'Create bookmark' })).not.toBeInTheDocument();
    expect(screen.queryByText('Or the manual way:')).not.toBeInTheDocument();
    expect(document.querySelector('.bookmark-drag-guide')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to league source' })).toBeInTheDocument();
    expect(screen.getByLabelText('Roster data')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await userEvent.click(opener());
    await screen.findByLabelText('Roster data');
    expect(screen.queryByRole('region', { name: 'Create bookmark' })).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Site settings' }));
    const preference = screen.getByRole('checkbox', { name: 'Show bookmark setup for private leagues' });
    expect(preference).not.toBeChecked();
    await userEvent.click(preference);
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Settings categories' })).getByRole('button', { name: 'Save' }));
    expect(localStorage.getItem('nflsw:v1:bookmarkHelp')).toBe('true');
    await userEvent.click(screen.getByRole('link', { name: 'Players' }));
    await userEvent.click(opener());
    expect(await screen.findByRole('region', { name: 'Create bookmark' })).toBeInTheDocument();
  });

  describe('removing non starters', () => {
    const extra = (espnId: string, name: string, over: object = {}) => ({ kind: 'player' as const, espnId, name, teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1', ...over });
    const open = async () => {
      mockFetch(routes);
      seed([extra('3117251', 'Christian McCaffrey', { position: 'RB' }), extra('999', 'Bench Guy'), extra('998', 'Other league guy', { profileId: 'p2' })], [{ ...league, source: { ...league.source, teamId: '1' } }, { ...league, id: 'p2', name: 'Second' }]);
      renderAt('/');
      await userEvent.click(opener());
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

  describe('sync all starters (vs mode)', () => {
    const extra = (espnId: string, name: string, over: object = {}) => ({ kind: 'player' as const, espnId, name, teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1', ...over });
    const openAll = async () => {
      mockFetch(routes);
      seed([extra('999', 'My bench'), extra('888', 'Their bench', { side: 'opponent' })], [{ ...league, source: { ...league.source, teamId: '9' } }]);
      renderAt('/vs');
      await userEvent.click(screen.getByRole('button', { name: 'Sync all starters' }));
      return screen.findAllByRole('region', { name: /Starters for/ });
    };

    it('shows both sides side by side with one shared checkbox and updates both on confirm', async () => {
      const regions = await openAll();
      expect(regions).toHaveLength(2);
      expect(screen.getAllByRole('checkbox', { name: 'Remove every non starter player' })).toHaveLength(1);
      await userEvent.click(screen.getByRole('checkbox', { name: 'Remove every non starter player' }));
      expect(within(regions[0]!).getByText(/My bench/)).toBeInTheDocument(); // removed on my side only
      expect(within(regions[0]!).queryByText(/Their bench/)).not.toBeInTheDocument();
      expect(within(regions[1]!).getByText(/Their bench/)).toBeInTheDocument();
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync all starters' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const after = followed();
      expect(after.some((entry) => entry.espnId === '999' || entry.espnId === '888')).toBe(false);
      expect(after.some((entry) => !entry.side)).toBe(true);
      expect(after.some((entry) => entry.side === 'opponent')).toBe(true);
    });

    it('changes nothing on Cancel', async () => {
      await openAll();
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      expect(followed().map((entry) => entry.espnId).sort()).toEqual(['888', '999']);
    });
  });

  describe('every league in turn (vs mode, All)', () => {
    const second = { ...league, id: 'p2', name: 'Second', source: { ...league.source, leagueId: '777', teamId: '1' } };
    const first = { ...league, source: { ...league.source, teamId: '1' } };
    const privateRoutes = { ...routes, 'leagues/777?view=mRoster': status(401) };
    const openAll = async (name: string) => {
      mockFetch(privateRoutes);
      seed([], [first, second]);
      renderAt('/vs');
      await userEvent.selectOptions(document.querySelector<HTMLSelectElement>('.vs-league select')!, 'All');
      await userEvent.click(screen.getAllByRole('button', { name })[0]!);
    };

    it('loads the public league, asks for the private one, then goes on by itself and previews everything with league names', async () => {
      await openAll('Sync your starters');
      expect(await screen.findByText(/This league is private/)).toBeInTheDocument();
      expect(screen.getByText('League 2 of 2: Second')).toBeInTheDocument();
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync starters' })).toBeDisabled(); // nothing to sync until the loop is done
      await userEvent.click(screen.getByLabelText('Roster data'));
      await userEvent.paste(JSON.stringify({ ...lineups, id: 777 }));
      const region = await screen.findByRole('region', { name: 'Starters for your side' });
      expect(within(region).getAllByText('Tapai')).toHaveLength(11);
      expect(within(region).getAllByText('Second')).toHaveLength(11);
      await sync();
      expect(await screen.findByText('Added 22 starters.')).toBeInTheDocument();
      expect(new Set(followed().map((entry) => (entry as { profileId?: string }).profileId))).toEqual(new Set(['p1', 'p2']));
    });

    it('is also offered by the league select of the Players screen', async () => {
      mockFetch(privateRoutes);
      seed([], [first, second]);
      renderAt('/');
      await userEvent.click(opener());
      await userEvent.selectOptions(await within(await screen.findByRole('dialog')).findByLabelText('League'), 'All');
      await userEvent.click(await screen.findByRole('button', { name: 'Skip Second' }));
      await screen.findByRole('region', { name: 'Starters for your side' });
      await sync();
      expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    });

    it('can skip a private league and syncs the rest', async () => {
      await openAll('Sync your starters');
      await userEvent.click(await screen.findByRole('button', { name: 'Skip Second' }));
      await screen.findByRole('region', { name: 'Starters for your side' });
      await sync();
      expect(await screen.findByText('Added 11 starters.')).toBeInTheDocument();
    });

    it('syncs both sides of every league with the all starters button', async () => {
      await openAll('Sync all starters');
      await userEvent.click(await screen.findByRole('button', { name: 'Skip Second' }));
      expect(await screen.findAllByRole('region', { name: /^Starters for/ })).toHaveLength(2);
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync all starters' }));
      expect(followed().some((entry) => entry.side === 'opponent')).toBe(true);
      expect(followed().some((entry) => !entry.side)).toBe(true);
    });
  });

  it('automatically imports text that was typed or dropped into the box', async () => {
    mockFetch({ ...routes, 'leagues/1900128084?view=mRoster': status(401) });
    seed([], [league]);
    renderAt('/');
    await userEvent.click(opener());
    const area = await screen.findByLabelText('Roster data');
    expect(screen.queryByRole('button', { name: 'Import these rosters' })).not.toBeInTheDocument();
    fireEvent.change(area, { target: { value: 'not data' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    fireEvent.change(area, { target: { value: '' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(area, { target: { value: JSON.stringify(lineups) } }); // typing or dropping fires change, not paste
    expect(await screen.findByLabelText('Your team in this league')).toBeInTheDocument();
  });
});
