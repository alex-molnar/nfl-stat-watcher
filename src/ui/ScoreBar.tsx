import type { Ref } from 'react';

export type Leader = 'mine' | 'opponent' | 'tied';

/** Compares whole cents, so float noise never decides the lead. */
export function leaderOf(mine: number, opponent: number): { leader: Leader; by: number } {
  const cents = Math.round(mine * 100) - Math.round(opponent * 100);
  return { leader: cents > 0 ? 'mine' : cents < 0 ? 'opponent' : 'tied', by: Math.abs(cents) / 100 };
}

export function leadText(mine: number, opponent: number): string {
  const { leader, by } = leaderOf(mine, opponent);
  if (leader === 'tied') return 'Tied';
  return `${leader === 'mine' ? 'You lead' : 'Opponent leads'} by ${by.toFixed(2)}`;
}

/** The announced text: it changes only when the leader or the tie state changes, not on every score change. */
export const LEADER_TEXT: Record<Leader, string> = { mine: 'You lead', opponent: 'Opponent leads', tied: 'Tied' };

/** One element whose visible text is its accessible text. The page owns the status announcement. */
export function ScoreBar({ mine, opponent, ref, settled = true }: { mine: number; opponent: number; ref?: Ref<HTMLDivElement>; settled?: boolean }) {
  return (
    <div className="score-bar" ref={ref}>
      <span className="sb-mine">You <b>{mine.toFixed(2)}</b></span>{' '}
      <span className="sb-lead">{settled ? leadText(mine, opponent) : 'Loading'}</span>{' '}
      <span className="sb-opp">Opponent <b>{opponent.toFixed(2)}</b></span>
    </div>
  );
}
