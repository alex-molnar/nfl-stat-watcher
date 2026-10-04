import { useRef, useState } from 'react';
import { useMatchup } from '../hooks/useMatchup';
import { entryKey, moveEntry, removeEntry, type Side } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import type { FollowedEntry } from '../storage/types';
import { useStore } from '../storage/useStore';
import { AddDialog } from './AddDialog';
import { EntryCard } from './EntryCard';
import { Header } from './Header';
import { PauseButton, pageNote, usePaused } from './PauseButton';
import { LEADER_TEXT, ScoreBar, leaderOf } from './ScoreBar';
import { usePageTitle } from './usePageTitle';

const COLUMNS = {
  mine: { title: 'Your players', add: 'Add player to your side', empty: 'No players on your side yet' },
  opponent: { title: 'Opponent players', add: 'Add player to opponent side', empty: 'No opponent players yet' },
} as const;

export function VsPage() {
  usePageTitle('Matchup');
  const profiles = useStore(profilesStore);
  const [pickedId, setPickedId] = useState(profiles[0]!.id); // memory only, never stored
  const paused = usePaused();
  const { profile, mine, opponent, totals, scoreboard } = useMatchup(pickedId, paused);
  const rows = { mine, opponent };
  const [adding, setAdding] = useState(false);
  const [dialogSide, setDialogSide] = useState<Side>('mine');
  const opener = useRef<HTMLElement | null>(null);
  const hasSchedule = scoreboard.data !== undefined;
  const loading = mine.length + opponent.length > 0 && scoreboard.isPending;
  const note = pageNote(loading, paused, scoreboard);
  const { leader } = leaderOf(totals.mine, totals.opponent);

  // Remove, or moving one of my cards to another league (which takes it out of this matchup):
  // next card's points button in the same column, else the previous one, else that column's Add button.
  function focusAfterLeaving(entry: FollowedEntry) {
    const card = document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(entryKey(entry))}"]`);
    const column = card?.closest('.vs-col');
    if (!card || !column) return;
    const all = [...column.querySelectorAll<HTMLElement>('.card .pts')];
    const i = all.indexOf(card.querySelector<HTMLElement>('.pts')!);
    (all[i + 1] ?? all[i - 1] ?? column.querySelector<HTMLElement>('.vs-add'))?.focus();
  }

  function openDialog(side: Side, button: HTMLElement) {
    opener.current = button;
    setDialogSide(side);
    setAdding(true);
  }

  // The column Add buttons are always mounted, so focus always goes back to the one that opened the dialog.
  function closeDialog() {
    setAdding(false);
    opener.current?.focus();
  }

  const column = (side: Side) => (
    <section className="vs-col" aria-labelledby={`vs-${side}`}>
      <div className="vs-col-head">
        <h2 className="section-title" id={`vs-${side}`}>{COLUMNS[side].title}</h2>
        <button type="button" className="btn press vs-add" aria-label={COLUMNS[side].add} onClick={(e) => openDialog(side, e.currentTarget)}>
          Add player
        </button>
      </div>
      {rows[side].length === 0 ? (
        <p className="muted">{COLUMNS[side].empty}</p>
      ) : loading ? null : ( // Wait for the schedule so cards do not reorder after mounting.
        <ul className="grid vs-list">
          {rows[side].map(({ entry, game }) => (
            <EntryCard
              key={entryKey(entry)}
              entry={entry}
              game={game}
              profiles={profiles}
              hasSchedule={hasSchedule}
              paused={paused}
              onMove={(e, toProfileId) => {
                focusAfterLeaving(e);
                moveEntry(e, toProfileId);
              }}
              onRemove={(e) => {
                focusAfterLeaving(e);
                removeEntry(e);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <Header actions={<PauseButton />} />
      <main className="wrap">
        <h2 className="sr" tabIndex={-1} data-page-title>Matchup</h2>
        <label className="field-label vs-league">
          League
          <select value={profile.id} onChange={(e) => setPickedId(e.target.value)}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {/* The one status line: the page note, plus the leader, which changes only when the lead changes hands. */}
        <p className="page-note" role="status">
          {note ? `${note} ` : null}
          <span className="sr">{LEADER_TEXT[leader]}</span>
        </p>
        <ScoreBar mine={totals.mine} opponent={totals.opponent} />
        <div className="vs">
          {column('mine')}
          {column('opponent')}
        </div>
      </main>
      <AddDialog open={adding} side={dialogSide} profileId={profile.id} onClose={closeDialog} />
    </>
  );
}
