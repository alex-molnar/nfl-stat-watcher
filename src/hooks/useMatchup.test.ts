import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { clientWrapper, seed } from '../test/render';
import { useMatchup } from './useMatchup';

const routes = { scoreboard: scoreboardFixture, 'summary?event=401872964': summary };
const run = (profileId: string) => renderHook(() => useMatchup(profileId, false), { wrapper: clientWrapper() });
const names = (rows: { entry: { name: string } }[]) => rows.map((r) => r.entry.name);

describe('useMatchup', () => {
  beforeEach(() => seed([warren, opponent(pitDefense), { ...warren, profileId: 'p2' }, opponent(mahomes)], profilesFixture));

  it('totals each side of the selected league with its profile', async () => {
    mockFetch(routes);
    const { result } = run('p1');
    await waitFor(() => expect(result.current.totals).toEqual({ mine: 15.6, opponent: 6 }));
    expect(names(result.current.mine)).toEqual(['Jaylen Warren']);
    expect(names(result.current.opponent)).toEqual(['Pittsburgh Steelers']);
    expect(result.current.profile.id).toBe('p1');
  });

  it('scores another league with that league\'s profile', async () => {
    mockFetch(routes);
    const { result } = run('p2');
    await waitFor(() => expect(result.current.totals).toEqual({ mine: 12.6, opponent: 0 }));
    expect(names(result.current.opponent)).toEqual(['Patrick Mahomes']);
  });

  it('falls back to the first league for an unknown id', () => {
    mockFetch(routes);
    expect(run('gone').result.current.profile.id).toBe('p1');
  });

  it('counts the same player on both sides', async () => {
    seed([warren, opponent(warren)], profilesFixture);
    mockFetch(routes);
    const { result } = run('p1');
    await waitFor(() => expect(result.current.totals).toEqual({ mine: 15.6, opponent: 15.6 }));
  });

  it('returns empty sides with zero totals', () => {
    seed([], profilesFixture);
    mockFetch(routes);
    const { result } = run('p1');
    expect(result.current.mine).toEqual([]);
    expect(result.current.opponent).toEqual([]);
    expect(result.current.totals).toEqual({ mine: 0, opponent: 0 });
  });

  it('asks for each game summary once, shared by both sides', async () => {
    seed([warren, opponent(pitDefense)], profilesFixture);
    const warn = vi.spyOn(console, 'warn');
    const f = mockFetch(routes);
    const { result } = run('p1');
    await waitFor(() => expect(result.current.totals).toEqual({ mine: 15.6, opponent: 6 }));
    expect(f.mock.calls.filter(([u]) => String(u).includes('summary'))).toHaveLength(1);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Duplicate Queries'));
  });

  it('orders final games before later games before byes', async () => {
    const sf = { ...warren, espnId: '9', name: 'SF player', teamId: '25', teamAbbr: 'SF' };
    seed([{ ...mahomes, profileId: 'p1' }, sf, warren], profilesFixture);
    mockFetch(routes);
    const { result } = run('p1');
    await waitFor(() => expect(result.current.scoreboard.data).toBeDefined());
    expect(names(result.current.mine)).toEqual(['Jaylen Warren', 'SF player', 'Patrick Mahomes']);
  });
});
