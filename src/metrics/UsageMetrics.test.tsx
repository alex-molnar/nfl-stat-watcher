import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { onCLS, onINP, onLCP } from 'web-vitals';
import { vi } from 'vitest';
import { followedStore } from '../storage/followed';
import { setPaused } from '../storage/pause';
import { UsageMetrics } from './UsageMetrics';
import { countingAllowed, track, trackBeat, trackVital } from './track';

vi.mock('./track', () => ({ track: vi.fn(), trackBeat: vi.fn(), trackVital: vi.fn(), countingAllowed: vi.fn(() => true) }));
vi.mock('web-vitals', () => ({ onLCP: vi.fn(), onINP: vi.fn(), onCLS: vi.fn() }));

const entry = { kind: 'player' as const, espnId: '1', name: 'Pat Example', teamId: '1', teamAbbr: 'EX', position: 'QB', profileId: 'p1' };

function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UsageMetrics />
      <Link to="/vs">to vs</Link>
      <Link to="/nowhere">to nowhere</Link>
    </MemoryRouter>,
  );
}

function visibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

afterEach(() => {
  vi.useRealTimers();
  delete (document as { visibilityState?: string }).visibilityState;
  vi.mocked(countingAllowed).mockReturnValue(true);
});

describe('UsageMetrics', () => {
  it('counts the page load and each screen opened, but not a path that redirects', async () => {
    mount('/leagues');
    expect(track).toHaveBeenCalledWith('visit');
    expect(track).toHaveBeenCalledWith('page_view', { route: 'leagues' });
    await userEvent.click(document.querySelector('a')!);
    expect(track).toHaveBeenCalledWith('page_view', { route: 'vs' });
    vi.mocked(track).mockClear();
    await userEvent.click(document.querySelectorAll('a')[1]!);
    expect(track).not.toHaveBeenCalled();
  });

  it('reports web vitals as the browser measures them', () => {
    mount();
    vi.mocked(onLCP).mock.calls[0]![0]({ value: 1800 } as never);
    vi.mocked(onINP).mock.calls[0]![0]({ value: 140 } as never);
    vi.mocked(onCLS).mock.calls[0]![0]({ value: 0.02 } as never);
    expect(trackVital).toHaveBeenCalledWith('LCP', 1800);
    expect(trackVital).toHaveBeenCalledWith('INP', 140);
    expect(trackVital).toHaveBeenCalledWith('CLS', 0.02);
  });

  it('counts script errors and unhandled rejections, at most five per page load', () => {
    mount();
    for (let i = 0; i < 4; i += 1) window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));
    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('error'));
    expect(vi.mocked(track).mock.calls.filter(([name]) => name === 'js_error')).toHaveLength(5);
  });

  it('listens for nothing when counting is not allowed, and stops listening when the page goes', () => {
    vi.mocked(countingAllowed).mockReturnValue(false);
    const quiet = mount();
    window.dispatchEvent(new Event('error'));
    expect(onLCP).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith('js_error');
    quiet.unmount();
    vi.mocked(countingAllowed).mockReturnValue(true);
    mount().unmount();
    vi.mocked(track).mockClear();
    window.dispatchEvent(new Event('error'));
    expect(track).not.toHaveBeenCalled();
  });

  describe('heartbeat of a tab that is live syncing', () => {
    beforeEach(() => vi.useFakeTimers());

    it('stays quiet while nothing is followed', () => {
      mount();
      act(() => void vi.advanceTimersByTime(180_000));
      expect(trackBeat).not.toHaveBeenCalled();
    });

    it('beats at once and then every minute, always with the same random tab id', () => {
      followedStore.set([entry]);
      mount();
      expect(trackBeat).toHaveBeenCalledTimes(1);
      act(() => void vi.advanceTimersByTime(120_000));
      expect(trackBeat).toHaveBeenCalledTimes(3);
      const ids = new Set(vi.mocked(trackBeat).mock.calls.map(([id]) => id));
      expect(ids.size).toBe(1);
      expect([...ids][0]).toMatch(/^[a-z0-9-]{8,40}$/); // the shape the collector accepts
      expect(localStorage.length).toBe(1); // only the followed player: the tab id is never stored
    });

    it('stops while updates are paused and starts again when they resume', () => {
      followedStore.set([entry]);
      mount();
      act(() => setPaused(true));
      vi.mocked(trackBeat).mockClear();
      act(() => void vi.advanceTimersByTime(180_000));
      expect(trackBeat).not.toHaveBeenCalled();
      act(() => setPaused(false));
      expect(trackBeat).toHaveBeenCalledTimes(1);
    });

    it('stops while the tab is hidden, and beats again as soon as it is shown', () => {
      followedStore.set([entry]);
      mount();
      visibility('hidden');
      vi.mocked(trackBeat).mockClear();
      act(() => void vi.advanceTimersByTime(180_000));
      expect(trackBeat).not.toHaveBeenCalled();
      visibility('visible');
      expect(trackBeat).toHaveBeenCalledTimes(1);
    });

    it('stops when the last followed player is removed', () => {
      followedStore.set([entry]);
      mount();
      act(() => followedStore.set([]));
      vi.mocked(trackBeat).mockClear();
      act(() => void vi.advanceTimersByTime(180_000));
      expect(trackBeat).not.toHaveBeenCalled();
    });
  });
});
