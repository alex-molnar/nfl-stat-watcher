import { useEffect, useRef, useState } from 'react';
import { scoringEvent, type PlayEvent } from '../stats/events';
import type { GameStats } from '../stats/types';
import type { FollowedEntry } from '../storage/types';

const SHOW_MS = 4200; // the badge stays long enough to read, then clears itself (no looping motion, WCAG 2.2.2)

export interface Celebration {
  event: PlayEvent;
  /** Changes with every event, so a second one restarts the animation. */
  id: number;
}

/**
 * Reports a scoring-type play when a live game's refresh shows one for this card's player or defense.
 * The first data a card sees is only a baseline, so loading or reloading the page never replays old plays.
 */
export function useCelebration(entry: FollowedEntry, stats: GameStats | undefined, live: boolean): Celebration | null {
  const previous = useRef(stats);
  const count = useRef(0);
  const [shown, setShown] = useState<Celebration | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = stats;
    if (!live || !before || !stats || before === stats) return;
    const event = scoringEvent(entry, before, stats);
    if (event) setShown({ event, id: (count.current += 1) });
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps -- entry and live are read at the moment the data changes

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return shown;
}
