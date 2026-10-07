import { DEFAULT_POSITION_ORDER, positionRank } from '../stats/positionOrder';
import { positionOrderStore } from './positionOrder';

const key = 'nflsw:v1:positionOrder';

describe('position order', () => {
  it('defaults to QB, RB, WR, TE, K, DL, LB, DB, then team defenses', () => {
    expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
  });

  it('persists a custom order across reloads', () => {
    const order = [...DEFAULT_POSITION_ORDER].reverse();
    positionOrderStore.set(order);
    positionOrderStore.reload();
    expect(positionOrderStore.get()).toEqual(order);
  });

  it.each([
    [['QB']], [[...DEFAULT_POSITION_ORDER, 'P']],
    [DEFAULT_POSITION_ORDER.map(() => 'QB')], [['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB', 'P']],
    [null], ['QB'],
  ])('falls back when saved positions are incomplete, duplicated or invalid: %j', (value) => {
    localStorage.setItem(key, JSON.stringify(value));
    positionOrderStore.reload();
    expect(positionOrderStore.get()).toEqual(DEFAULT_POSITION_ORDER);
  });

  it.each([
    ['FB', 'RB'], ['PK', 'K'], ['DE', 'DL'], ['DT', 'DL'], ['NT', 'DL'],
    ['ILB', 'LB'], ['OLB', 'LB'], ['MLB', 'LB'], ['CB', 'DB'], ['S', 'DB'], ['FS', 'DB'], ['SS', 'DB'],
  ])('sorts %s with %s', (position, group) => {
    expect(positionRank({ kind: 'player', position } as Parameters<typeof positionRank>[0])).toBe(DEFAULT_POSITION_ORDER.indexOf(group as (typeof DEFAULT_POSITION_ORDER)[number]));
  });

  it('sorts unknown positions last and identifies team defenses by kind', () => {
    expect(positionRank({ kind: 'player', position: 'P' } as Parameters<typeof positionRank>[0])).toBe(9);
    expect(positionRank({ kind: 'defense', position: '' } as Parameters<typeof positionRank>[0])).toBe(8);
  });
});
