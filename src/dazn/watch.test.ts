import { vi } from 'vitest';
import { watchOnDazn } from './watch';

const GAME = '/home/aaa/bbb';
const URL = `https://www.dazn.com/en-NL${GAME}`;

/** A popup we just made (readable blank page) or an existing DAZN window (reading its address throws, as cross-origin does). */
function popup(kind: 'fresh' | 'dazn') {
  const replace = vi.fn();
  const location = kind === 'fresh'
    ? { href: 'about:blank', replace }
    : { get href(): string { throw new DOMException('cross-origin', 'SecurityError'); }, replace };
  return { focus: vi.fn(), location, replace };
}
const stubOpen = (w: ReturnType<typeof popup> | null) => vi.spyOn(window, 'open').mockReturnValue(w as unknown as Window);

describe('watchOnDazn', () => {
  beforeEach(() => sessionStorage.clear());

  it('opens a screen-sized named popup, focuses it and sends it to the game when none existed', () => {
    const w = popup('fresh');
    const open = stubOpen(w);
    expect(watchOnDazn(GAME)).toBe('ok');
    expect(open).toHaveBeenCalledWith('', 'stat-watch-dazn', expect.stringMatching(/^popup=yes,left=\d+,top=\d+,width=\d+,height=\d+$/));
    expect(w.focus).toHaveBeenCalled();
    expect(w.replace).toHaveBeenCalledWith(URL);
  });

  it('moves an existing window to another game and raises it', () => {
    stubOpen(popup('fresh')); watchOnDazn('/home/old/game');
    const w = popup('dazn');
    stubOpen(w);
    expect(watchOnDazn(GAME)).toBe('ok');
    expect(w.focus).toHaveBeenCalled();
    expect(w.replace).toHaveBeenCalledWith(URL);
  });

  it('only raises an existing window that already shows the same game', () => {
    stubOpen(popup('fresh')); watchOnDazn(GAME);
    const w = popup('dazn');
    stubOpen(w);
    watchOnDazn(GAME);
    expect(w.focus).toHaveBeenCalled();
    expect(w.replace).not.toHaveBeenCalled();
  });

  it('navigates again when the window was closed in between, even for the same game', () => {
    stubOpen(popup('fresh')); watchOnDazn(GAME);
    const w = popup('fresh'); // the user closed it, so the name found nothing and a blank popup was made
    stubOpen(w);
    watchOnDazn(GAME);
    expect(w.replace).toHaveBeenCalledWith(URL);
  });

  it('reports a blocked popup', () => {
    stubOpen(null);
    expect(watchOnDazn(GAME)).toBe('blocked');
  });
});
