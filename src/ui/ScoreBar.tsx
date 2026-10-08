import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n';

export type Leader = 'mine' | 'opponent' | 'tied';

/** Compares whole cents, so float noise never decides the lead. */
export function leaderOf(mine: number, opponent: number): { leader: Leader; by: number } {
  const cents = Math.round(mine * 100) - Math.round(opponent * 100);
  return { leader: cents > 0 ? 'mine' : cents < 0 ? 'opponent' : 'tied', by: Math.abs(cents) / 100 };
}

export function leadText(mine: number, opponent: number): string {
  const { leader, by } = leaderOf(mine, opponent);
  if (leader === 'tied') return i18n.t(($) => $.shell.scoreBar.tied);
  return leader === 'mine' ? i18n.t(($) => $.shell.scoreBar.youLeadBy, { by: by.toFixed(2) }) : i18n.t(($) => $.shell.scoreBar.opponentLeadsBy, { by: by.toFixed(2) });
}

/** The announced text: it changes only when the leader or the tie state changes, not on every score change. */
export const LEADER_TEXT: Record<Leader, string> = {
  get mine() { return i18n.t(($) => $.shell.scoreBar.youLead); },
  get opponent() { return i18n.t(($) => $.shell.scoreBar.opponentLeads); },
  get tied() { return i18n.t(($) => $.shell.scoreBar.tied); },
};

/** One element whose visible text is its accessible text. The page owns the status announcement. */
export function ScoreBar({ mine, opponent, ref, settled = true }: { mine: number; opponent: number; ref?: Ref<HTMLDivElement>; settled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="score-bar" ref={ref}>
      <span className="sb-mine">{t(($) => $.shell.scoreBar.you)} <b>{mine.toFixed(2)}</b></span>{' '}
      <span className="sb-lead">{settled ? leadText(mine, opponent) : t(($) => $.shell.scoreBar.loading)}</span>{' '}
      <span className="sb-opp">{t(($) => $.shell.scoreBar.opponent)} <b>{opponent.toFixed(2)}</b></span>
    </div>
  );
}
