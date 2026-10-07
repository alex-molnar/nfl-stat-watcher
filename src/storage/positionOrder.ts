import { DEFAULT_POSITION_ORDER, type PositionGroup } from '../stats/positionOrder';
import { createStore } from './store';

/** A complete permutation keeps every position available exactly once. */
export const positionOrderStore = createStore<PositionGroup[]>({
  key: 'nflsw:v1:positionOrder',
  fallback: () => [...DEFAULT_POSITION_ORDER],
  isValid: (value): value is PositionGroup[] => Array.isArray(value) &&
    value.length === DEFAULT_POSITION_ORDER.length && new Set(value).size === value.length &&
    value.every((position) => (DEFAULT_POSITION_ORDER as readonly unknown[]).includes(position)),
});
