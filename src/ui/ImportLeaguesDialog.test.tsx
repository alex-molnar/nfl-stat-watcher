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
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
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

  it('does not infer a season from the current date or accept an empty league batch', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a season');
    expect(importButton()).toBeDisabled();
  });

  it('clears previously loaded previews when the league input changes', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    const input = screen.getByLabelText('ESPN fantasy football league links or IDs, one per line');
    await userEvent.type(input, '1900128084');
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.queryByLabelText('League import results')).not.toBeInTheDocument();
    expect(importButton()).toBeDisabled();
  });

  it('fetches current ESPN settings when explicitly refreshing a linked profile', async () => {
    const fetch = mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
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
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084\n409479118');
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    expect(await screen.findByText(/League 1900128084 · Season 2026/)).toBeInTheDocument();
    expect(await screen.findByText(/This league is private/)).toBeInTheDocument();
    expect(screen.getByText('Import league 409479118, season 2026 from your own ESPN session')).toBeInTheDocument();
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
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084\n1900128085');
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
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '409479118');
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => (screen.getByRole('dialog') as HTMLDialogElement).close());
    await vi.waitFor(() => expect(aborted).toBe(true));
  });

  it('imports a private league from settings pasted out of the signed-in ESPN tab', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': { __status: 401 } });
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    const link = await screen.findByRole('link', { name: /open this league’s settings data/ });
    expect(link).toHaveAttribute('href', 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/1900128084?view=mSettings');
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
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '555');
    await userEvent.type(screen.getByLabelText('Season'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
    await userEvent.click(await screen.findByLabelText('Settings JSON for league 555, season 2026'));
    await userEvent.paste(JSON.stringify(fixture));
    expect(await screen.findByRole('alert')).toHaveTextContent('different league');
  });
});
