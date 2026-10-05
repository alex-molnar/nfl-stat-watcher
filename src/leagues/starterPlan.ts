import { sameEntry, sideOf, type Side } from '../storage/followed';
import type { FollowedEntry } from '../storage/types';

export interface StarterPlan {
  /** Starters not followed yet. */
  added: FollowedEntry[];
  /** Cards already followed in this league and on this side that stay, starters or (when nothing is removed) not. */
  unchanged: FollowedEntry[];
  /** Cards already followed in this league and on this side that are not starters, only when asked to remove them. */
  removed: FollowedEntry[];
}

/**
 * What importing a lineup would do. `incoming` are the starters as followed entries for this league and side. Only
 * cards of that same league and side are ever candidates for removal, so another league's cards, or the other side of
 * a matchup, are never touched. With nothing incoming (no starters set) nothing is removed, so an empty lineup can
 * never wipe a list by accident.
 */
export function planStarterImport(incoming: FollowedEntry[], followed: FollowedEntry[], profileId: string, side: Side, removeOthers: boolean): StarterPlan {
  const here = followed.filter((entry) => entry.profileId === profileId && sideOf(entry) === side);
  const isStarter = (entry: FollowedEntry) => incoming.some((starter) => sameEntry(starter, entry));
  const dropping = removeOthers && incoming.length > 0;
  return {
    added: incoming.filter((starter) => !here.some((entry) => sameEntry(entry, starter))),
    unchanged: here.filter((entry) => isStarter(entry) || !dropping),
    removed: dropping ? here.filter((entry) => !isStarter(entry)) : [],
  };
}
