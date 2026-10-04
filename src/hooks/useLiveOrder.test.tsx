import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameInfo } from '../stats/scoreboard';
import type { GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import { useLiveOrder } from './useLiveOrder';

const game = { eventId: 'g1', state: 'in' } as GameInfo;
const person = (espnId: string, position: string, teamId: string): FollowedEntry => ({ kind: 'player', espnId, name: espnId, teamId, teamAbbr: teamId, position, profileId: 'p1' });
const qb = person('qb', 'QB', '25'); // scores
const rb = person('rb', 'RB', '25'); // same team, not involved
const wr = person('wr', 'WR', '7'); // other team, not involved
const rows = [qb, rb, wr].map((entry) => ({ entry, game }));

const player = (touchdowns: number): PlayerStats => ({ twoPointConversions: 0, safeties: 0, passing: { completions: touchdowns, attempts: touchdowns, yards: 5, touchdowns, interceptions: 0 } });
const situation = (driveOver: boolean) => ({ possessionTeamId: '25', yardsToEndzone: 4, downDistanceText: '', lastPlayText: '', ...(driveOver ? { driveOver: true as const } : {}) });
const stats = (touchdowns: number, driveOver: boolean): GameStats => ({ players: { qb: player(touchdowns), rb: { twoPointConversions: 0, safeties: 0 }, wr: { twoPointConversions: 0, safeties: 0 } }, defenses: {}, situation: situation(driveOver) });

const order = (compare: (a: (typeof rows)[number], b: (typeof rows)[number]) => number) => [...rows].sort(compare).map((r) => r.entry.espnId);

describe('useLiveOrder after a score', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.stubGlobal('fetch', () => new Promise(() => {})); // refreshes are simulated with setQueryData
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['summary', 'g1'], stats(0, false));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  it('moves players not involved back at once, keeps the scorer in place while the celebration plays, then moves the scorer back', () => {
    const { result } = renderHook(() => useLiveOrder(rows, false), { wrapper });
    expect(order(result.current)).toEqual(['rb', 'qb', 'wr']); // red zone first, the skill player ahead of the quarterback

    act(() => { client.setQueryData(['summary', 'g1'], stats(1, true)); vi.advanceTimersByTime(1); }); // the quarterback throws a touchdown, the drive is over
    expect(order(result.current)).toEqual(['qb', 'rb', 'wr']); // the scorer holds, the bystanders dropped already

    act(() => { vi.advanceTimersByTime(3_900); });
    expect(order(result.current)[0]).toBe('qb'); // still celebrating

    act(() => { vi.advanceTimersByTime(500); });
    expect(order(result.current)).toEqual(['rb', 'wr', 'qb']); // celebration over: the quarterback joins the others
  });

  it('does not hold anyone for an ordinary refresh', () => {
    const { result } = renderHook(() => useLiveOrder(rows, false), { wrapper });
    act(() => { client.setQueryData(['summary', 'g1'], stats(0, true)); vi.advanceTimersByTime(1); }); // the drive ended without a play by a followed player
    expect(order(result.current)).toEqual(['rb', 'wr', 'qb']);
  });
});
