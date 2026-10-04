import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameInfo } from '../stats/scoreboard';
import type { GameStats, PlayerStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';
import { BOOST_MS } from '../stats/liveOrder';
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
    expect(order(result.current)).toEqual(['qb', 'rb', 'wr']); // celebration over: the quarterback leads its own group for a while

    act(() => { vi.advanceTimersByTime(BOOST_MS); });
    expect(order(result.current)).toEqual(['rb', 'wr', 'qb']); // then settles back in position order
  });

  it('does not hold anyone for an ordinary refresh', () => {
    const { result } = renderHook(() => useLiveOrder(rows, false), { wrapper });
    act(() => { client.setQueryData(['summary', 'g1'], stats(0, true)); vi.advanceTimersByTime(1); }); // the drive ended without a play by a followed player
    expect(order(result.current)).toEqual(['rb', 'wr', 'qb']);
  });
});

describe('useLiveOrder after a long play', () => {
  // Game 1: SF has the ball at midfield, not in the red zone. Game 2: KC has the ball at the SEA 10, a red zone.
  const g1 = { eventId: 'g1', state: 'in' } as GameInfo;
  const g2 = { eventId: 'g2', state: 'in' } as GameInfo;
  const sfQb = person('qb', 'QB', '25');
  const sfRb = person('rb', 'RB', '25');
  const sfWr = person('wr', 'WR', '25');
  const kcWr = person('kc', 'WR', '12');
  const all = [sfQb, sfRb, sfWr, kcWr].map((entry) => ({ entry, game: entry.teamId === '12' ? g2 : g1 }));
  const pass = (completions: number, yards: number): PlayerStats => ({ twoPointConversions: 0, safeties: 0, passing: { completions, attempts: completions, yards, touchdowns: 0, interceptions: 0 } });
  const idle: PlayerStats = { twoPointConversions: 0, safeties: 0 };
  const sit = (team: string, yardsToEndzone: number) => ({ possessionTeamId: team, yardsToEndzone, downDistanceText: '', lastPlayText: '' });
  const game1 = (yards: number, completions: number): GameStats => ({ players: { qb: pass(completions, yards), rb: idle, wr: idle }, defenses: {}, situation: sit('25', 55) });
  const game2: GameStats = { players: { kc: idle }, defenses: {}, situation: sit('12', 10) };
  const names = (compare: (a: (typeof all)[number], b: (typeof all)[number]) => number) => [...all].sort(compare).map((r) => r.entry.espnId);

  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['summary', 'g1'], game1(50, 5));
    client.setQueryData(['summary', 'g2'], game2);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  it('lifts a quarterback with a 25-yard pass above the skill players, but not above the red zone, then lets him settle', () => {
    const { result } = renderHook(() => useLiveOrder(all, false), { wrapper });
    expect(names(result.current)).toEqual(['kc', 'rb', 'wr', 'qb']);

    act(() => { client.setQueryData(['summary', 'g1'], game1(75, 6)); vi.advanceTimersByTime(1); }); // a 25-yard completion
    expect(names(result.current)).toEqual(['kc', 'qb', 'rb', 'wr']); // red zone first, then the lifted quarterback

    act(() => { vi.advanceTimersByTime(BOOST_MS + 100); });
    expect(names(result.current)).toEqual(['kc', 'rb', 'wr', 'qb']);
  });

  it('does not lift anyone for a short gain', () => {
    const { result } = renderHook(() => useLiveOrder(all, false), { wrapper });
    act(() => { client.setQueryData(['summary', 'g1'], game1(60, 6)); vi.advanceTimersByTime(1); }); // 10 yards: not a long pass
    expect(names(result.current)).toEqual(['kc', 'rb', 'wr', 'qb']);
  });
});
