import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useScoreboard } from '../hooks/queries';
import { gameForTeam } from '../stats/scoreboard';
import { entryKey, followedStore, moveEntry, removeEntry, sideOf, withValidProfiles, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { campStore } from '../storage/camp';
import { showsDummiesOnly } from '../storage/campLeague';
import { isFake } from '../espn/campSandbox';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { AutoSyncToggle } from './AutoSyncToggle';
import { ImportStartersDialog } from './ImportStartersDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';
import { MascotSays } from './Mascot';
import { PauseButton, pageNote, usePaused } from './PauseButton';
import type { FollowedEntry } from '../storage/types';
import { usePageTitle } from './usePageTitle';
import { GROUPS } from './gameGroups';
import { useLiveOrder } from '../hooks/useLiveOrder';
import { useAutoSync } from '../hooks/useAutoSync';

const MINE: Side[] = ['mine'];

export function MainPage() {
  const { t } = useTranslation();
  usePageTitle(t(($) => $.shell.main.title));
  useAutoSync(MINE);
  const profiles = useStore(profilesStore);
  // Only my entries: opponent entries (vs mode) never show here, in cards or in the empty state.
  // In the camp's last drill only the practice players show, whatever else is followed (nothing stored changes).
  const dummiesOnly = showsDummiesOnly(useStore(campStore));
  const followed = withValidProfiles(useStore(followedStore), profiles.map((p) => p.id)).filter((e) => sideOf(e) === 'mine' && (!dummiesOnly || isFake(e.espnId)));
  const paused = usePaused();
  const scoreboard = useScoreboard(paused);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasImported = profiles.some((profile) => profile.source);
  const noLeagues = profiles.length === 0;
  // aria-disabled, not disabled: a disabled button shows no tooltip, and this one explains what to do first.
  const needLeague = noLeagues ? t(($) => $.shell.main.needLeague) : undefined;
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
    (all[i + 1] ?? all[i - 1] ?? addRef.current)?.focus();
    removeEntry(entry);
  }

  const opener = useRef<HTMLElement | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const addButton = (ref?: React.Ref<HTMLButtonElement>) => (
    <button type="button" ref={ref} className="btn btn-primary press" data-camp="add-player" aria-disabled={noLeagues || undefined} title={needLeague} onClick={(e) => { if (noLeagues) return; opener.current = e.currentTarget; setAdding(true); }}>
      {t(($) => $.shell.main.addPlayer)}
    </button>
  );

  // When the opener was unmounted (adding from the empty state), hand focus to the header button.
  function closeDialog() {
    setAdding(false);
    if (!opener.current?.isConnected) addRef.current?.focus();
  }

  return (
    <>
      <Header pageMascot={followed.length === 0} actions={<PauseButton />} />
      <main className="wrap">
        <h2 className="sr" tabIndex={-1} data-page-title>{t(($) => $.shell.main.title)}</h2>
        <div className="page-actions" role="group" aria-label={t(($) => $.shell.main.actions)}>
          {addButton(addRef)}
          {(hasImported || noLeagues) && <button type="button" className="btn press" data-camp="sync-starters" aria-disabled={noLeagues || undefined} title={needLeague} onClick={() => { if (!noLeagues) setImporting(true); }}>{t(($) => $.shell.main.syncStarters)}</button>}
        </div>
        <p className="page-note" role="status">{note}</p>
        {followed.length === 0 ? (
          noLeagues ? (
            <MascotSays text={t(($) => $.shell.main.noLeague)}>
              <Link className="btn btn-primary press" to="/leagues">{t(($) => $.shell.main.goToLeagues)}</Link>
            </MascotSays>
          ) : (
            <MascotSays text={hasImported ? t(($) => $.shell.main.emptyWithImport) : t(($) => $.shell.main.empty)}>
              <div className="bubble-actions">
                {addButton()}
                {hasImported && <button type="button" className="btn press" onClick={() => setImporting(true)}>{t(($) => $.shell.main.syncStarters)}</button>}
              </div>
            </MascotSays>
          )
        ) : loading ? null : ( // Wait for the schedule so cards do not jump between groups after mounting.
          GROUPS.map(({ key }) => {
            const group = rows.filter((r) => (r.game?.state ?? 'none') === key);
            group.sort(liveOrder); // activity first in live games, position in every group; ties stay stable
            if (group.length === 0) return null;
            const first = GROUPS.find((g) => rows.some((r) => (r.game?.state ?? 'none') === g.key))?.key === key;
            return (
              <section key={key} aria-labelledby={`group-${key}`}>
                <div className="section-head">
                  <h2 className="section-title" id={`group-${key}`}>
                    {key === 'none' && !hasSchedule ? t(($) => $.shell.main.followed) : t(($) => $.shell.groups[key])}
                  </h2>
                  {first && hasImported && <AutoSyncToggle />}
                </div>
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
