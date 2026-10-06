import { useEffect, useRef, useState } from 'react';
import type { PlayersHandling } from '../storage/followed';
import type { Profile } from '../scoring/types';
import { deleteProfile } from '../storage/profiles';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';

type Choice = 'move' | 'moveBoth' | 'delete';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  /** The other leagues, which players can move to. */
  others: Profile[];
  /** Followed players on my side, and on the opponent side, of this league. */
  mine: number;
  opponents: number;
  /** Called after the league is gone, with the league to select next. */
  onDeleted: (nextId: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Deleting a league asks what happens to its players: move them, move the opponent side too, or delete them. */
export function DeleteLeagueDialog({ open, onClose, profile, others, mine, opponents, onDeleted }: Props) {
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const hasPlayers = mine + opponents > 0;
  const canMove = others.length > 0; // the last league has nowhere to move players to
  const firstChoice: Choice = !canMove ? 'delete' : mine > 0 ? 'move' : 'moveBoth';
  const [choice, setChoice] = useState<Choice>(firstChoice);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setChoice(firstChoice);
      setMoveTo(others[0]?.id ?? '');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- the choices start fresh each time it opens

  function confirm() {
    const players: PlayersHandling = !hasPlayers || !canMove || choice === 'delete' ? 'delete' : { moveTo, opponents: choice === 'moveBoth' };
    if (deleteProfile(profile.id, players)) {
      ref.current?.close();
      onDeleted(players === 'delete' ? others[0]?.id ?? '' : players.moveTo);
    }
  }

  const select = (forChoice: Choice, label: string) => (
    <select aria-label={label} value={moveTo} disabled={!canMove || choice !== forChoice} onChange={(event) => setMoveTo(event.target.value)}>
      {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
  const bothText = [mine > 0 && plural(mine, 'player'), `${plural(opponents, 'opponent player')}`].filter(Boolean).join(' and ');

  return (
    <dialog ref={ref} data-worried aria-labelledby="delete-league-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="delete-league-title">Delete {profile.name}?</h2>
          <button type="button" className="close" aria-label="Close delete dialog" onClick={onClose}>×</button>
        </div>
        {hasPlayers ? (
          <fieldset className="delete-choices">
            <legend>What should happen to its players?</legend>
            {!canMove && <p className="muted">This is your last league, so there is nowhere to move players to.</p>}
            {mine > 0 && (
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="delete-choice" disabled={!canMove} checked={choice === 'move'} onChange={() => setChoice('move')} />
                  {`Move ${plural(mine, 'player')} to`}
                </label>
                {select('move', 'League to move your players to')}
                {opponents > 0 && <span className="muted">{`The ${plural(opponents, 'opponent player')} ${opponents === 1 ? 'is' : 'are'} deleted.`}</span>}
              </div>
            )}
            {opponents > 0 && (
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="delete-choice" disabled={!canMove} checked={choice === 'moveBoth'} onChange={() => setChoice('moveBoth')} />
                  {`Move ${bothText} to`}
                </label>
                {select('moveBoth', 'League to move your and the opponent players to')}
              </div>
            )}
            <div className="choice-row">
              <label className="choice">
                <input type="radio" name="delete-choice" {...hint('The players followed in this league are removed along with it.')} checked={choice === 'delete'} onChange={() => setChoice('delete')} />
                Delete existing players
              </label>
            </div>
          </fieldset>
        ) : (
          <p>No players follow this league.</p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" {...hint('This cannot be undone.')} onClick={confirm}>Delete league</button>
        </div>
      </div>
    </dialog>
  );
}
