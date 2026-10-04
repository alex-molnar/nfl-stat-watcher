import type { GameInfo } from '../stats/scoreboard';
import { freshness, scoreboardInterval, scoreboardRefetch, summaryPolling, summaryQuery } from './queries';

const game = (state: GameInfo['state']) => ({ state }) as GameInfo;

describe('polling rules', () => {
  it('polls the scoreboard every minute while a game is live, else every 10 minutes', () => {
    expect(scoreboardInterval([game('post'), game('in')])).toBe(60_000);
    expect(scoreboardInterval([game('pre')])).toBe(600_000);
    expect(scoreboardInterval(undefined)).toBe(600_000);
  });

  it('retries a failed scoreboard load after a minute, even with no data yet', () => {
    expect(scoreboardRefetch('error', undefined)).toBe(60_000);
    expect(scoreboardRefetch('success', [game('pre')])).toBe(600_000);
    expect(scoreboardRefetch('success', [game('in')])).toBe(60_000);
  });

  it('polls live summaries, fetches finals once and skips scheduled games', () => {
    expect(summaryPolling('in')).toEqual({ enabled: true, refetchInterval: 10_000, staleTime: 0 });
    expect(summaryPolling('post')).toEqual({ enabled: true, refetchInterval: false, staleTime: Infinity });
    expect(summaryPolling('pre')).toEqual({ enabled: false, refetchInterval: false, staleTime: 0 });
    expect(summaryPolling(undefined)).toEqual({ enabled: false, refetchInterval: false, staleTime: 0 });
  });
});

describe('paused polling', () => {
  it('stops scoreboard and summary intervals while paused', () => {
    expect(scoreboardRefetch('success', [game('in')], true)).toBe(false);
    expect(scoreboardRefetch('error', undefined, true)).toBe(false);
    expect(summaryPolling('in', true)).toEqual({ enabled: true, refetchInterval: false, staleTime: 0 });
    expect(summaryPolling('post', true)).toEqual(summaryPolling('post'));
  });
});

describe('freshness', () => {
  it('says nothing while requests succeed', () => expect(freshness(false, Date.now())).toBeNull());
  it('says when data was never loaded', () => expect(freshness(true, 0)).toBe('Live data unavailable, retrying'));
  it('shows the time of the last good update', () => {
    expect(freshness(true, new Date('2026-10-04T14:32:00').getTime())).toMatch(/^Updated .*32.*, retrying$/);
  });
});

describe('summary query options', () => {
  const live = { eventId: '1', state: 'in' } as GameInfo;

  it('uses one cache key per game, so cards and the matchup share it', () => {
    expect(summaryQuery(live).queryKey).toEqual(['summary', '1']);
    expect(summaryQuery(live).refetchInterval).toBe(10_000);
    expect(summaryQuery(null).enabled).toBe(false);
  });

  it('stops polling and focus refetching while paused', () => {
    expect(summaryQuery(live, true)).toMatchObject({ refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  });
});
