import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { freshness, useScoreboard } from '../hooks/queries';
import { gameForTeam } from '../stats/scoreboard';
import { followedStore, withValidProfiles } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';

const GROUPS = [
  { key: 'in', title: 'Live now' },
  { key: 'post', title: 'Final' },
  { key: 'pre', title: 'Later' },
  { key: 'none', title: 'Bye week' },
] as const;

export function MainPage() {
  usePageTitle('Players');
  const profiles = useStore(profilesStore);
  const followed = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id));
  const [paused, setPaused] = useState(false); // session only, never persisted
  const scoreboard = useScoreboard(paused);
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const hasSchedule = scoreboard.data !== undefined;
  const games = scoreboard.data ?? [];
  const rows = followed.map((entry) => ({ entry, game: gameForTeam(games, entry.teamId) }));
  const loading = followed.length > 0 && scoreboard.isPending;
  // One status container stays mounted so screen readers announce text changes.
  const note = loading
    ? 'Loading games'
    : paused
      ? 'Live updates are paused. The numbers shown may be out of date.'
      : freshness(scoreboard.isError, scoreboard.dataUpdatedAt);

  function togglePause() {
    setPaused(!paused);
    if (paused) void client.refetchQueries({ predicate: (q) => q.queryKey[0] === 'scoreboard' || q.queryKey[0] === 'summary' });
  }

  const opener = useRef<HTMLElement | null>(null);
  const headerAdd = useRef<HTMLButtonElement>(null);
  const addButton = (ref?: React.Ref<HTMLButtonElement>) => (
    <button type="button" ref={ref} className="btn btn-primary press" onClick={(e) => { opener.current = e.currentTarget; setAdding(true); }}>
      Add player
    </button>
  );

  // When the opener was unmounted (adding from the empty state), hand focus to the header button.
  function closeDialog() {
    setAdding(false);
    if (!opener.current?.isConnected) headerAdd.current?.focus();
  }

  return (
    <>
      <Header
        actions={
          <>
            <button type="button" className="btn press" aria-pressed={paused} onClick={togglePause}>
              {paused ? 'Resume live updates' : 'Pause live updates'}
            </button>
            {addButton(headerAdd)}
          </>
        }
      />
      <main className="wrap">
        <p className="page-note" role="status">{note}</p>
        {followed.length === 0 ? (
          <div className="empty">
            <p>You're not following anyone yet. Add players or team defenses from any of your leagues.</p>
            {addButton()}
          </div>
        ) : loading ? null : ( // Wait for the schedule so cards do not jump between groups after mounting.
          GROUPS.map(({ key, title }) => {
            const group = rows.filter((r) => (r.game?.state ?? 'none') === key);
            if (group.length === 0) return null;
            return (
              <section key={key} aria-labelledby={`group-${key}`}>
                <h2 className="section-title" id={`group-${key}`}>
                  {key === 'none' && !hasSchedule ? 'Followed' : title}
                </h2>
                <ul className={`grid${key === 'in' ? ' live' : ''}`}>
                  {group.map(({ entry, game }) => (
                    <EntryCard
                      key={`${entry.kind}:${entry.espnId}:${entry.profileId}`}
                      entry={entry}
                      game={game}
                      profiles={profiles}
                      hasSchedule={hasSchedule}
                      paused={paused}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
      <AddDialog open={adding} onClose={closeDialog} />
    </>
  );
}
