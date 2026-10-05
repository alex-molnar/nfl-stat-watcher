import { vi } from 'vitest';
import type { GameInfo } from '../stats/scoreboard';
import { closeGameWindow, openGameWindows, planPower, readOpened, writeOpened } from './power';
import { watchOnDazn } from './watch';

const game = (eventId: string, state: GameInfo['state']): GameInfo => ({
  eventId, state, period: 1, clock: '', kickoff: '',
  home: { id: '1', abbr: 'H', color: '#000', score: 0 }, away: { id: '2', abbr: 'A', color: '#000', score: 0 },
});
const links: Record<string, string> = { a: '/home/a/a', b: '/home/b/b', c: '/home/c/c' };
const pathOf = (id: string) => links[id];
const none = new Set<string>();

describe('planPower', () => {
  it('offers live games that have a link and no window, and none that were turned down', () => {
    const games = [game('a', 'in'), game('b', 'in'), game('c', 'in'), game('d', 'in'), game('e', 'pre')];
    expect(planPower(games, pathOf, new Set(['a']), new Set(['b'])).offer.map((g) => g.eventId)).toEqual(['c']); // d has no link, e is not live
  });

  it('closes the window of a game that ended, only when this session opened it', () => {
    const games = [game('a', 'post'), game('b', 'post'), game('c', 'in')];
    expect(planPower(games, pathOf, new Set(['a', 'c']), none).close).toEqual(['a']);
  });
});

describe('openGameWindows', () => {
  it('opens one named window per game and takes focus back after each', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    const result = openGameWindows([game('a', 'in'), game('b', 'in')], pathOf);
    expect(result).toEqual({ opened: ['a', 'b'], blocked: [] });
    expect(open).toHaveBeenNthCalledWith(1, 'https://www.dazn.com/en-NL/home/a/a', 'stat-watch-dazn-a', expect.stringContaining('popup=yes'));
    expect(open).toHaveBeenNthCalledWith(2, 'https://www.dazn.com/en-NL/home/b/b', 'stat-watch-dazn-b', expect.any(String));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('reports the games a browser would not open', () => {
    vi.spyOn(window, 'open').mockReturnValueOnce({} as Window).mockReturnValue(null);
    vi.spyOn(window, 'focus').mockImplementation(() => {});
    expect(openGameWindows([game('a', 'in'), game('b', 'in'), game('c', 'in')], pathOf)).toEqual({ opened: ['a'], blocked: ['b', 'c'] });
  });
});

describe('closeGameWindow', () => {
  it('closes the game\'s named window', () => {
    const close = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ close } as unknown as Window);
    closeGameWindow('a');
    expect(open).toHaveBeenCalledWith('', 'stat-watch-dazn-a', expect.any(String));
    expect(close).toHaveBeenCalled();
  });

  it('does nothing when the browser will not make a window', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => closeGameWindow('a')).not.toThrow();
  });
});

describe('the remembered windows', () => {
  it('round-trip and ignore junk', () => {
    sessionStorage.clear();
    writeOpened(['a', 'b']);
    expect(readOpened()).toEqual(['a', 'b']);
    sessionStorage.setItem('nflsw:dazn:powerOpened', '{"x":1}');
    expect(readOpened()).toEqual([]);
  });
});

describe('watchOnDazn in power mode', () => {
  it('raises the game\'s own window without navigating it, and navigates only a blank one', () => {
    const replace = vi.fn();
    const existing = { focus: vi.fn(), location: { get href(): string { throw new Error('cross-origin'); }, replace } };
    const open = vi.spyOn(window, 'open').mockReturnValue(existing as unknown as Window);
    watchOnDazn('/home/a/a', 'a');
    expect(open).toHaveBeenCalledWith('', 'stat-watch-dazn-a', expect.any(String));
    expect(existing.focus).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    const blank = { focus: vi.fn(), location: { href: 'about:blank', replace } };
    open.mockReturnValue(blank as unknown as Window);
    watchOnDazn('/home/a/a', 'a');
    expect(replace).toHaveBeenCalledWith('https://www.dazn.com/en-NL/home/a/a');
  });
});
