import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useScoreboard } from '../hooks/queries';
import { gameForTeam } from '../stats/scoreboard';
import { entryKey, followedStore, moveEntry, removeEntry, sideOf, withValidProfiles } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { ImportStartersDialog } from './ImportStartersDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';
import { MascotSays } from './Mascot';
import { PauseButton, pageNote, usePaused } from './PauseButton';
import type { FollowedEntry } from '../storage/types';
import { usePageTitle } from './usePageTitle';
import { GROUPS } from './gameGroups';
import { useLiveOrder } from '../hooks/useLiveOrder';

const NEED_LEAGUE = 'Add a scoring league first to add players';

export function MainPage() {
  usePageTitle('Players');
  const profiles = useStore(profilesStore);
  // Only my entries: opponent entries (vs mode) never show here, in cards or in the empty state.
  const followed = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id)).filter((e) => sideOf(e) === 'mine');
  const paused = usePaused();
  const scoreboard = useScoreboard(paused);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasImported = profiles.some((profile) => profile.source);
  const noLeagues = profiles.length === 0;
  // aria-disabled, not disabled: a disabled button shows no tooltip, and this one explains what to do first.
  const needLeague = noLeagues ? NEED_LEAGUE : undefined;
  const hasSchedule = scoreboard.data !== undefined;
  const games = scoreboard.data ?? [];
  const rows = followed.map((entry) => ({ entry, game: gameForTeam(games, entry.teamId) }));
  const liveOrder = useLiveOrder(rows, paused);
  const loading = followed.length > 0 && scoreboard.isPending;
  // One status container stays mounted so screen readers announce text changes.
  const note = pageNote(loading, paused, scoreboard);

  // Focus survives the remount that a league change causes (the card key includes the league).
  const refocusLeague = useRef<string | null>(null);
  useEffect(() => {
    const key = refocusLeague.current;
    refocusLeague.current = null;
    if (key) document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(key)}"] select`)?.focus();
  });

  function move(entry: FollowedEntry, toProfileId: string) {
    refocusLeague.current = entryKey({ ...entry, profileId: toProfileId });
    moveEntry(entry, toProfileId);
  }

  // Next card's points button, else the previous one, else the header Add player button.
  function remove(entry: FollowedEntry, button: HTMLElement) {
    const all = [...document.querySelectorAll<HTMLElement>('.card .pts')];
    const i = all.indexOf(button.closest('.card')!.querySelector<HTMLElement>('.pts')!);
    (all[i + 1] ?? all[i - 1] ?? headerAdd.current)?.focus();
    removeEntry(entry);
  }

  const opener = useRef<HTMLElement | null>(null);
  const headerAdd = useRef<HTMLButtonElement>(null);
  const addButton = (ref?: React.Ref<HTMLButtonElement>) => (
    <button type="button" ref={ref} className="btn btn-primary press" aria-disabled={noLeagues || undefined} title={needLeague} onClick={(e) => { if (noLeagues) return; opener.current = e.currentTarget; setAdding(true); }}>
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
        pageMascot={noLeagues}
        actions={
          <>
            <PauseButton />
            {(hasImported || noLeagues) && <button type="button" className="btn press" aria-disabled={noLeagues || undefined} title={needLeague} onClick={() => { if (!noLeagues) setImporting(true); }}>Sync starters</button>}
            {addButton(headerAdd)}
          </>
        }
      />
      <main className="wrap">
        <h2 className="sr" tabIndex={-1} data-page-title>Players</h2>
        <p className="page-note" role="status">{note}</p>
        {followed.length === 0 ? (
          noLeagues ? (
            <MascotSays text="Add a scoring league first to start following players.">
              <Link className="btn btn-primary press" to="/leagues">Go to Leagues</Link>
            </MascotSays>
          ) : (
            <div className="empty">
              <p>You're not following anyone yet. Add players or team defenses from any of your leagues.</p>
              {addButton()}
            </div>
          )
        ) : loading ? null : ( // Wait for the schedule so cards do not jump between groups after mounting.
          GROUPS.map(({ key, title }) => {
            const group = rows.filter((r) => (r.game?.state ?? 'none') === key);
            if (key === 'in') group.sort(liveOrder); // stable: ties keep the order they were added in
            if (group.length === 0) return null;
            return (
              <section key={key} aria-labelledby={`group-${key}`}>
                <h2 className="section-title" id={`group-${key}`}>
                  {key === 'none' && !hasSchedule ? 'Followed' : title}
                </h2>
                <ul className={`grid${key === 'in' ? ' live' : ''}`}>
                  {group.map(({ entry, game }) => (
                    <EntryCard
                      key={entryKey(entry)}
                      entry={entry}
                      game={game}
                      profiles={profiles}
                      hasSchedule={hasSchedule}
                      paused={paused}
                      onMove={move}
                      onRemove={remove}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>
      <AddDialog open={adding} onClose={closeDialog} />
      <ImportStartersDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
