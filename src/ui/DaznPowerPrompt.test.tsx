import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { scoreboardFixture } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt } from '../test/render';
import { reloadAllStores } from '../storage/store';

// 401872975 is live, 401872964 has ended.
const board = { events: scoreboardFixture.events.map((e) => e.id === '401872975' ? { ...e, status: { ...e.status, type: { ...e.status.type, state: 'in' as const } } } : e) };
const links = { '401872975': '/home/live/live', '401872964': '/home/done/done' };

function setup(mode: 'default' | 'power', enabled = true) {
  localStorage.setItem('nflsw:v1:daznEnabled', JSON.stringify(enabled));
  localStorage.setItem('nflsw:v1:daznMode', JSON.stringify(mode));
  localStorage.setItem('nflsw:v1:daznLinks', JSON.stringify({ syncedAt: 'now', links, manual: {} }));
  reloadAllStores();
  mockFetch({ scoreboard: board });
  vi.spyOn(window, 'focus').mockImplementation(() => {});
}
const prompt = () => screen.queryByRole('region', { name: 'Live DAZN games' });

describe('power mode prompt', () => {
  beforeEach(() => sessionStorage.clear());

  it('stays away in default mode and with the setting off', async () => {
    setup('default');
    renderAt('/settings');
    await new Promise((r) => setTimeout(r, 50));
    expect(prompt()).not.toBeInTheDocument();
  });

  it('asks before opening a window per live game, then opens it by name and stops asking', async () => {
    setup('power');
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    renderAt('/settings');
    expect(await screen.findByText(/1 live game has a DAZN link/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled(); // never without the click
    await userEvent.click(screen.getByRole('button', { name: 'Open games' }));
    expect(open).toHaveBeenCalledWith('https://www.dazn.com/en-NL/home/live/live', 'stat-watch-dazn-401872975', expect.any(String));
    await waitFor(() => expect(prompt()).not.toBeInTheDocument());
  });

  it('says so when the browser blocked a window, and keeps asking', async () => {
    setup('power');
    vi.spyOn(window, 'open').mockReturnValue(null);
    renderAt('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Open games' }));
    expect(await screen.findByText(/Your browser blocked 1\. Allow pop-ups/)).toBeInTheDocument();
    expect(prompt()).toBeInTheDocument();
  });

  it('Not now hides it for the games it offered', async () => {
    setup('power');
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    renderAt('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(prompt()).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('closes the window of a game that has ended, if this session opened it', async () => {
    setup('power');
    sessionStorage.setItem('nflsw:dazn:powerOpened', JSON.stringify(['401872964']));
    const close = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ close } as unknown as Window);
    renderAt('/settings');
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith('', 'stat-watch-dazn-401872964', expect.any(String));
    expect(JSON.parse(sessionStorage.getItem('nflsw:dazn:powerOpened')!)).toEqual([]);
  });
});
