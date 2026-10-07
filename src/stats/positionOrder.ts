import type { FollowedEntry } from '../storage/types';

export const DEFAULT_POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB', 'D/ST'] as const;
export type PositionGroup = (typeof DEFAULT_POSITION_ORDER)[number];

const GROUPS: Record<string, PositionGroup> = {
  QB: 'QB', RB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE', K: 'K', PK: 'K',
  DL: 'DL', DE: 'DL', DT: 'DL', NT: 'DL',
  LB: 'LB', ILB: 'LB', OLB: 'LB', MLB: 'LB',
  DB: 'DB', CB: 'DB', S: 'DB', FS: 'DB', SS: 'DB',
};

/** Specific NFL positions share their fantasy group; unrecognized positions sort last. */
export function positionRank(entry: FollowedEntry, order: readonly PositionGroup[] = DEFAULT_POSITION_ORDER): number {
  const group = entry.kind === 'defense' ? 'D/ST' : Object.hasOwn(GROUPS, entry.position) ? GROUPS[entry.position] : undefined;
  return group === undefined ? DEFAULT_POSITION_ORDER.length : order.indexOf(group);
}
