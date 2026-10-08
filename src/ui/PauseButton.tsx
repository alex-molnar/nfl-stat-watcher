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
  const label = paused ? t(($) => $.shell.pause.resume) : t(($) => $.shell.pause.pause);
  // Live: the refresh arrows turn and a soft glow pulses around the button, and the icon offers Pause. Paused: both stop and the icon offers Play. The name stays the action, as text did.
  return (
    <button type="button" className={`btn press live-btn${paused ? '' : ' is-live'}`} data-camp="live-toggle" aria-pressed={paused} aria-label={label} title={label} onClick={toggle}>
      <svg className="live-refresh" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="live-state" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {paused ? <path d="M7 4.5v15l12-7.5Z" fill="currentColor" /> : <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" />}
      </svg>
    </button>
  );
}

/** The page-level status line: loading, paused, or the scoreboard retry note. */
export function pageNote(loading: boolean, paused: boolean, scoreboard: { isError: boolean; dataUpdatedAt: number }): string | null {
  if (loading) return i18n.t(($) => $.shell.pause.loading);
  if (paused) return i18n.t(($) => $.shell.pause.paused);
  return freshness(scoreboard.isError, scoreboard.dataUpdatedAt);
}
