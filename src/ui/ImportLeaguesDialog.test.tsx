import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderAt } from '../test/render';
import { mockFetch } from '../test/mockFetch';
import fixture from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';

function importButton() {
  return screen.getByRole('button', { name: /Import selected leagues/ });
}

describe('ImportLeaguesDialog', () => {
  it('loads public settings from an explicit season and imports only after warnings are acknowledged', async () => {
    const fetch = mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/seasons/2026/segments/0/leagues/1900128084?view=mSettings'), expect.anything());
    expect(importButton()).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/Import the approximate profile for league 1900128084/));
    expect(importButton()).toBeEnabled();
    await userEvent.click(importButton());
    expect(await screen.findByText('Imported 1 league and saved the profiles.')).toHaveAttribute('role', 'status');
    const stored = JSON.parse(localStorage.getItem('nflsw:v1:profiles') ?? '[]');
    const imported = stored.find((profile: { source?: { leagueId?: string } }) => profile.source?.leagueId === '1900128084');
    expect(imported.values.passTd).toBe(4);
    expect(imported.values.reception).toBe(0.5);
    expect(imported.source.transport).toBe('public-api');
  });

  it('starts with the current year in the season box', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2027-03-10T12:00:00Z') });
    try {
      renderAt('/leagues');
      await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
      expect(screen.getByLabelText('Season')).toHaveValue(2027);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads with the prefilled season and no typing, using the current year', async () => {
    const year = new Date().getFullYear();
    const fetch = mockFetch({ [`seasons/${year}/segments/0/leagues/1900128084?view=mSettings`]: { ...fixture, seasonId: year } });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(new RegExp(`League 1900128084 · Season ${year}`))).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/seasons/${year}/segments/0/leagues/1900128084?view=mSettings`), expect.anything());
  });

  it('still asks for a season when it was cleared, and does not accept an empty league batch', async () => {
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a season');
    expect(importButton()).toBeDisabled();
  });

  it('clears previously loaded previews when the league input changes', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    const input = screen.getByLabelText('ESPN fantasy football league links or IDs, one per line');
    await userEvent.type(input, '1900128084');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.queryByLabelText('League import results')).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('fetches current ESPN settings when explicitly refreshing a linked profile', async () => {
    const fetch = mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    const warning = screen.getByLabelText(/Import the approximate profile for league 1900128084/);
    if (!(warning as HTMLInputElement).checked) await userEvent.click(warning);
    await userEvent.click(importButton());
    expect(await screen.findByText('Imported 1 league and saved the profiles.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ESPN league 1900128084/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps public results available when another league needs ESPN access', async () => {
    mockFetch({
      'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture,
      'seasons/2026/segments/0/leagues/409479118?view=mSettings': { __status: 401 },
    });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084\n409479118');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/This league is private/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect ESPN and retry/ })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'League 409479118' })).toBeInTheDocument();
    expect(importButton()).toBeDisabled();
    expect(within(screen.getByLabelText('League import results')).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('gives each league in a batch distinct target and warning control names', async () => {
    const second = structuredClone(fixture) as typeof fixture;
    second.id = 1900128085;
    mockFetch({
      'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture,
      'seasons/2026/segments/0/leagues/1900128085?view=mSettings': second,
    });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084\n1900128085');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/League 1900128085 · Season 2026/)).toBeInTheDocument();
    expect(screen.getByLabelText('Import target for league 1900128084, season 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Import target for league 1900128085, season 2026')).toBeInTheDocument();
    expect(screen.getByLabelText(/Import the approximate profile for league 1900128084/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Import the approximate profile for league 1900128085/)).toBeInTheDocument();
  });

  it('aborts an active load when the native dialog closes with Escape', async () => {
    let aborted = false;
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }));
    vi.stubGlobal('fetch', fetch);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '409479118');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => (screen.getByRole('dialog') as HTMLDialogElement).close());
    await vi.waitFor(() => expect(aborted).toBe(true));
  });

  it('imports a private league from settings pasted out of the signed-in ESPN tab', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': { __status: 401 } });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    const notice = await screen.findByText('This league is private you need to copy the settings manually');
    expect(notice).not.toHaveClass('error');
    expect(screen.queryByLabelText('Settings JSON for league 1900128084, season 2026')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open Settings' });
    expect(link).toHaveAttribute('href', 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/1900128084?view=mSettings');
    expect(link).toHaveAttribute('target', '_blank');
    await userEvent.click(link);
    expect(screen.getByText('Paste the copied settings text below. It is imported straight away.')).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event('focus')));
    const area = screen.getByLabelText('Settings JSON for league 1900128084, season 2026');
    await userEvent.click(area);
    await userEvent.paste('not json');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    await userEvent.click(area);
    await userEvent.paste(JSON.stringify(fixture));
    expect(await screen.findByText(/League 1900128084 · Season 2026 · Settings file/)).toBeInTheDocument();
  });

  it('refuses pasted settings that belong to another league', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/555?view=mSettings': { __status: 401 } });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '555');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Open Settings' }));
    await userEvent.click(await screen.findByLabelText('Settings JSON for league 555, season 2026'));
    await userEvent.paste(JSON.stringify(fixture));
    expect(await screen.findByRole('alert')).toHaveTextContent('different league');
  });

  it.each(['hover', 'click'] as const)('opens Fumble’s settings drill on %s and keeps the import dialog open when dismissed', async (interaction) => {
    mockFetch({ 'seasons/2026/segments/0/leagues/555?view=mSettings': { __status: 401 } });
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '555');
    await userEvent.clear(screen.getByLabelText('Season'));
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    const how = await screen.findByRole('button', { name: 'How?' });
    if (interaction === 'hover') await userEvent.hover(how);
    else await userEvent.click(how, { skipHover: true });
    const guide = screen.getByRole('dialog', { name: 'Fumble · Copy private league settings' });
    expect(within(guide).getAllByRole('listitem')).toHaveLength(3);
    expect(guide).toHaveAccessibleDescription(/Stay signed in to ESPN/);
    expect(within(guide).getByText(/Ctrl\+A/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Settings JSON for league 555, season 2026')).not.toBeInTheDocument();
    await userEvent.click(within(guide).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog', { name: /Copy private league settings/ })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Import ESPN leagues' })).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('link', { name: 'Open Settings' }));
    expect(screen.getByLabelText('Settings JSON for league 555, season 2026')).toBeInTheDocument();
  });
});
