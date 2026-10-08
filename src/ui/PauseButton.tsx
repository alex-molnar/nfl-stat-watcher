import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { freshness } from '../hooks/queries';
import { i18n } from '../i18n';
import { isPaused, setPaused, subscribePause } from '../storage/pause';

/** Session-only pause flag (WCAG 2.2.2), shared by the Players and vs pages, never persisted. */
export const usePaused = () => useSyncExternalStore(subscribePause, isPaused, isPaused);

export function PauseButton() {
  const { t } = useTranslation();
  const paused = usePaused();
  const client = useQueryClient();
  function toggle() {
    setPaused(!paused);
    // Resuming refetches what is on screen right away.
    if (paused) void client.refetchQueries({ type: 'active', predicate: (q) => q.queryKey[0] === 'scoreboard' || q.queryKey[0] === 'summary' });
  }
  return (
    <button type="button" className="btn press" aria-pressed={paused} onClick={toggle}>
      {paused ? t(($) => $.shell.pause.resume) : t(($) => $.shell.pause.pause)}
    </button>
  );
}

/** The page-level status line: loading, paused, or the scoreboard retry note. */
export function pageNote(loading: boolean, paused: boolean, scoreboard: { isError: boolean; dataUpdatedAt: number }): string | null {
  if (loading) return i18n.t(($) => $.shell.pause.loading);
  if (paused) return i18n.t(($) => $.shell.pause.paused);
  return freshness(scoreboard.isError, scoreboard.dataUpdatedAt);
}
