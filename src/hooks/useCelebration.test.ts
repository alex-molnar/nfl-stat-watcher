import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import { useCelebration } from './useCelebration';

const entry: FollowedEntry = { kind: 'player', espnId: '1', name: 'Pat', teamId: '25', teamAbbr: 'SF', position: 'QB', profileId: 'p1' };
const game = (touchdowns: number): GameStats => ({
  players: { '1': { twoPointConversions: 0, safeties: 0, passing: { completions: 1, attempts: 1, yards: 5, touchdowns, interceptions: 0 } } },
  defenses: {}, situation: null,
});

afterEach(() => vi.useRealTimers());

describe('useCelebration', () => {
  it('stays quiet for the first data a card sees, even if it already holds a touchdown', () => {
    const { result } = renderHook(({ stats }) => useCelebration(entry, stats, true), { initialProps: { stats: undefined as GameStats | undefined } });
    expect(result.current).toBeNull();
    act(() => { /* first data arrives */ });
    const again = renderHook(() => useCelebration(entry, game(2), true));
    expect(again.result.current).toBeNull();
  });

  it('celebrates a touchdown that arrives in a later refresh, then clears itself', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ stats }) => useCelebration(entry, stats, true), { initialProps: { stats: game(0) } });
    rerender({ stats: game(1) });
    expect(result.current?.event.label).toBe('Touchdown');
    const first = result.current!.id;
    rerender({ stats: game(2) });
    expect(result.current!.id).toBeGreaterThan(first);
    act(() => { vi.advanceTimersByTime(4300); });
    expect(result.current).toBeNull();
  });

  it('does nothing when the game is not live, and when data refreshes without a new play', () => {
    const idle = renderHook(({ stats }) => useCelebration(entry, stats, false), { initialProps: { stats: game(0) } });
    idle.rerender({ stats: game(1) });
    expect(idle.result.current).toBeNull();
    const same = renderHook(({ stats }) => useCelebration(entry, stats, true), { initialProps: { stats: game(1) } });
    same.rerender({ stats: game(1) });
    expect(same.result.current).toBeNull();
  });
});
