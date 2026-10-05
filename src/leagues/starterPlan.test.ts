import { describe, expect, it } from 'vitest';
import type { FollowedEntry } from '../storage/types';
import { planStarterImport } from './starterPlan';

const e = (espnId: string, over: Partial<FollowedEntry> = {}): FollowedEntry => ({ kind: 'player', espnId, name: `P${espnId}`, teamId: '1', teamAbbr: 'AAA', position: 'WR', profileId: 'p1', ...over });
const ids = (list: FollowedEntry[]) => list.map((x) => x.espnId);

describe('planStarterImport', () => {
  const incoming = [e('1'), e('2'), e('3')];
  const followed = [e('2'), e('9'), e('2', { profileId: 'p2' }), e('8', { side: 'opponent' }), e('7', { profileId: 'p2' })];

  it('adds starters not followed yet and keeps everything else, by default', () => {
    const plan = planStarterImport(incoming, followed, 'p1', 'mine', false);
    expect(ids(plan.added)).toEqual(['1', '3']);
    expect(ids(plan.unchanged)).toEqual(['2', '9']);
    expect(plan.removed).toEqual([]);
  });

  it('also removes followed players who are not starters when asked', () => {
    const plan = planStarterImport(incoming, followed, 'p1', 'mine', true);
    expect(ids(plan.added)).toEqual(['1', '3']);
    expect(ids(plan.unchanged)).toEqual(['2']);
    expect(ids(plan.removed)).toEqual(['9']);
  });

  it('never touches another league or the other side of the matchup', () => {
    const plan = planStarterImport(incoming, followed, 'p1', 'mine', true);
    const touched = [...plan.added, ...plan.unchanged, ...plan.removed];
    expect(touched.some((x) => x.profileId === 'p2' || x.side === 'opponent')).toBe(false);
    expect(ids(planStarterImport([e('8', { side: 'opponent' })], followed, 'p1', 'opponent', true).unchanged)).toEqual(['8']);
  });

  it('removes nothing when there are no starters, so an empty lineup cannot wipe the list', () => {
    const plan = planStarterImport([], followed, 'p1', 'mine', true);
    expect(plan.removed).toEqual([]);
    expect(ids(plan.unchanged)).toEqual(['2', '9']);
  });

  it('treats a player and a defense with the same id as different cards', () => {
    const plan = planStarterImport([e('5', { kind: 'defense' })], [e('5')], 'p1', 'mine', true);
    expect(ids(plan.added)).toEqual(['5']);
    expect(ids(plan.removed)).toEqual(['5']);
  });
});
