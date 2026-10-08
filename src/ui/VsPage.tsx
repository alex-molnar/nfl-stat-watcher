import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flushSync } from 'react-dom';
import { Link } from 'react-router';
import { ALL_LEAGUES, useMatchup } from '../hooks/useMatchup';
import { entryKey, removeEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { useAutoSync } from '../hooks/useAutoSync';
import { AutoSyncToggle } from './AutoSyncToggle';
import { ImportStartersDialog } from './ImportStartersDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';
import { MascotSays } from './Mascot';
import { PauseButton, pageNote, usePaused } from './PauseButton';
import { LEADER_TEXT, ScoreBar, leaderOf } from './ScoreBar';
import { usePageTitle } from './usePageTitle';
import { GROUPS } from './gameGroups';
import { useLiveOrder } from '../hooks/useLiveOrder';

/** Programmatic focus that also scrolls clear of the sticky bar: scrollIntoView honours scroll-padding (WCAG 2.4.11). */
function focusVisible(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
}

const BOTH_SIDES: Side[] = ['mine', 'opponent'];

function VsMatchup() {
  const { t } = useTranslation();
  usePageTitle(t(($) => $.shell.vs.title));
  useAutoSync(BOTH_SIDES);
  const profiles = useStore(profilesStore);
  const [pickedId, setPickedId] = useState(profiles[0]!.id); // memory only, never stored
  const paused = usePaused();
  const { profile, all, mine, opponent, totals, scoreboard, settled } = useMatchup(pickedId, paused);
  const rows = { mine, opponent };
  const liveOrder = useLiveOrder([...mine, ...opponent], paused);
  const [adding, setAdding] = useState(false);
  const [dialogSide, setDialogSide] = useState<Side>('mine');
  const [importSide, setImportSide] = useState<Side | 'both' | null>(null);
  const canSync = all ? profiles.some((p) => p.source) : !!profile.source; // sync needs an imported league to read
  const opener = useRef<HTMLElement | null>(null);
  const hasSchedule = scoreboard.data !== undefined;
  const loading = mine.length + opponent.length > 0 && scoreboard.isPending;
  const note = pageNote(loading, paused, scoreboard);
  const { leader } = leaderOf(totals.mine, totals.opponent);
  // Latched per league: once a league's matchup has settled it stays settled, so adding a card with an
  // uncached summary never blanks the phrase and re-announces it. Switching league starts over.
  const latch = useRef({ id: '', done: false });
  const leagueKey = all ? ALL_LEAGUES : profile.id;
  if (latch.current.id !== leagueKey) latch.current = { id: leagueKey, done: false };
  if (settled) latch.current.done = true;
  const announced = latch.current.done;
  const phrase = announced && mine.length + opponent.length > 0 ? LEADER_TEXT[leader] : '';

  // Scroll padding follows the bar's real height (it wraps with long names, text zoom and text spacing),
  // so a focused card never sits under the sticky bar (WCAG 2.4.11). CSS has a fallback until this runs.
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--score-bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--score-bar-h');
    };
  }, []);

  // Remove: the next card's points button in the same column, else the previous one, else that column's Add button.
  // The target is picked first and focused after the removal has rendered, so the scroll uses the new layout.
  function removeAndFocus(entry: FollowedEntry) {
    const card = document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(entryKey(entry))}"]`);
    const column = card?.closest('.vs-col');
    const all = column ? [...column.querySelectorAll<HTMLElement>('.card .pts')] : [];
    const i = all.indexOf(card?.querySelector<HTMLElement>('.pts') as HTMLElement);
    const target = all[i + 1] ?? all[i - 1] ?? column?.querySelector<HTMLElement>('.vs-add');
    flushSync(() => removeEntry(entry));
    focusVisible(target);
  }

  function openDialog(side: Side, button: HTMLElement) {
    opener.current = button;
    setDialogSide(side);
    setAdding(true);
  }

  // The column Add buttons are always mounted, so focus always goes back to the one that opened the dialog.
  function closeDialog() {
    setAdding(false);
    focusVisible(opener.current);
  }

  const column = (side: Side) => (
    <section className="vs-col" aria-labelledby={`vs-${side}`}>
      <div className="vs-col-head">
        <h2 className="section-title" id={`vs-${side}`}>{t(($) => $.shell.vs[side].title)}</h2>
        <button type="button" className="btn press vs-add" data-camp={`vs-add-${side}`} aria-label={t(($) => $.shell.vs[side].add)} onClick={(e) => openDialog(side, e.currentTarget)}>
          {t(($) => $.shell.vs.addPlayer)}
        </button>
        {canSync && (
          <button type="button" className="btn press" aria-label={t(($) => $.shell.vs[side].sync)} onClick={(e) => { opener.current = e.currentTarget; setImportSide(side); }}>
            {t(($) => $.shell.vs.syncStarters)}
          </button>
        )}
      </div>
      {rows[side].length === 0 ? (
        <p className="muted" style={{ gridRow: 2 }}>{t(($) => $.shell.vs[side].empty)}</p>
      ) : loading ? null : ( // Wait for the schedule so cards do not reorder after mounting.
        GROUPS.map(({ key }, slot) => {
          const group = rows[side].filter((r) => (r.game?.state ?? 'none') === key);
          group.sort(liveOrder); // non-live cards use the saved position order too
          if (group.length === 0) return null;
          return (
            // One fixed row per group, shared by both columns, so each group starts at the same height on either side.
            <section key={key} aria-labelledby={`vs-${side}-${key}`} style={{ gridRow: slot + 2 }}>
              <h3 className="group-title" id={`vs-${side}-${key}`}>{key === 'none' && !hasSchedule ? t(($) => $.shell.main.followed) : t(($) => $.shell.groups[key])}</h3>
              <ul className={`grid vs-list${key === 'in' ? ' live' : ''}`}>
                {group.map(({ entry, game }) => (
                  <EntryCard
                    key={entryKey(entry)}
                    entry={entry}
                    game={game}
                    profiles={profiles}
                    hasSchedule={hasSchedule}
                    paused={paused}
                    movable={false}
                    onRemove={removeAndFocus}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </section>
  );

  return (
    <>
      <Header actions={<PauseButton />} />
      <main className="wrap">
        <h2 className="sr" tabIndex={-1} data-page-title>{t(($) => $.shell.vs.title)}</h2>
        <div className="vs-league-row">
          <label className="field-label vs-league">
            {t(($) => $.shell.vs.league)}
            <select value={all ? ALL_LEAGUES : profile.id} onChange={(e) => setPickedId(e.target.value)}>
              {profiles.length > 1 && <option value={ALL_LEAGUES}>{t(($) => $.shell.vs.all)}</option>}
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {canSync && (
            <button type="button" className="btn press" onClick={(e) => { opener.current = e.currentTarget; setImportSide('both'); }}>
              {t(($) => $.shell.vs.syncAll)}
            </button>
          )}
          {canSync && <AutoSyncToggle />}
        </div>
        {/* The one status line: the page note, plus the leader, which changes only when the lead changes hands. */}
        <p className="page-note" role="status">
          {note}
          <span className="sr">{phrase ? `${!note ? '' : note.endsWith('.') ? ' ' : '. '}${phrase}` : ''}</span>
        </p>
        <ScoreBar ref={barRef} settled={announced} mine={totals.mine} opponent={totals.opponent} />
        {!all && profile.source?.issues.length ? (
          <details className="compat-warning matchup-warning">
            <summary>{t(($) => $.shell.vs.limits, { name: profile.name, n: profile.source.issues.length })}</summary>
            <ul>{profile.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issue.message}</li>)}</ul>
          </details>
        ) : null}
        <div className="vs">
          {column('mine')}
          {column('opponent')}
        </div>
      </main>
      <ImportStartersDialog open={importSide !== null} side={importSide ?? 'mine'} profileId={all ? ALL_LEAGUES : profile.id} onClose={() => { setImportSide(null); focusVisible(opener.current); }} />
      <AddDialog open={adding} side={dialogSide} profileId={all ? undefined : profile.id} onClose={closeDialog} />
    </>
  );
}

/** Without a league there is no scoring to compare, so the page says where to start. */
export function VsPage() {
  const { t } = useTranslation();
  const profiles = useStore(profilesStore);
  usePageTitle(t(($) => $.shell.vs.title));
  if (profiles.length > 0) return <VsMatchup />;
  return (
    <>
      <Header pageMascot />
      <main className="wrap">
        <h2 className="sr" tabIndex={-1} data-page-title>{t(($) => $.shell.vs.title)}</h2>
        <MascotSays text={t(($) => $.shell.vs.noLeague)}>
          <Link className="btn btn-primary press" to="/leagues">{t(($) => $.shell.vs.goToLeagues)}</Link>
        </MascotSays>
      </main>
    </>
  );
}
