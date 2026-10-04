import { useState } from 'react';
import { freshness, useScoreboard } from '../hooks/queries';
import { gameForTeam } from '../stats/scoreboard';
import { followedStore, withValidProfiles } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';

const GROUPS = [
  { key: 'in', title: 'Live now' },
  { key: 'post', title: 'Final' },
  { key: 'pre', title: 'Later' },
  { key: 'none', title: 'Bye week' },
] as const;

export function MainPage() {
  const profiles = useStore(profilesStore);
  const followed = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id));
  const scoreboard = useScoreboard();
  const [adding, setAdding] = useState(false);
  const hasSchedule = scoreboard.data !== undefined;
  const games = scoreboard.data ?? [];
  const rows = followed.map((entry) => ({ entry, game: gameForTeam(games, entry.teamId) }));
  const note = freshness(scoreboard.isError, scoreboard.dataUpdatedAt);

  const addButton = (
    <button type="button" className="btn btn-primary press" onClick={() => setAdding(true)}>
      Add player
    </button>
  );

  return (
    <>
      <Header actions={addButton} />
      <main className="wrap">
        {note && <p className="page-note">{note}</p>}
        {followed.length === 0 ? (
          <div className="empty">
            <p>You're not following anyone yet. Add players or team defenses from any of your leagues.</p>
            {addButton}
          </div>
        ) : scoreboard.isPending ? (
          // Wait for the schedule so cards do not jump between groups after mounting.
          <p className="page-note" role="status">Loading games</p>
        ) : (
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
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
      <AddDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
