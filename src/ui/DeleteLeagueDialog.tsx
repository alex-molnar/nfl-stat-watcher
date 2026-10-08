import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/** Deleting a league asks what happens to its players: move them, move the opponent side too, or delete them. */
export function DeleteLeagueDialog({ open, onClose, profile, others, mine, opponents, onDeleted }: Props) {
  const { t } = useTranslation();
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
  const myPlayers = t(($) => $.leagues.counts.player, { count: mine });
  const opponentPlayers = t(($) => $.leagues.counts.opponentPlayer, { count: opponents });

  return (
    <dialog ref={ref} data-worried aria-labelledby="delete-league-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="delete-league-title">{t(($) => $.leagues.deleteLeague.title, { name: profile.name })}</h2>
          <button type="button" className="close" aria-label={t(($) => $.leagues.deleteLeague.close)} onClick={onClose}>×</button>
        </div>
        {hasPlayers ? (
          <fieldset className="delete-choices">
            <legend>{t(($) => $.leagues.deleteLeague.question)}</legend>
            {!canMove && <p className="muted">{t(($) => $.leagues.deleteLeague.lastLeague)}</p>}
            {mine > 0 && (
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="delete-choice" disabled={!canMove} checked={choice === 'move'} onChange={() => setChoice('move')} />
                  {t(($) => $.leagues.deleteLeague.move, { players: myPlayers })}
                </label>
                {select('move', t(($) => $.leagues.deleteLeague.moveLabel))}
                {opponents > 0 && <span className="muted">{t(($) => $.leagues.deleteLeague.opponentsDeleted, { count: opponents })}</span>}
              </div>
            )}
            {opponents > 0 && (
              <div className="choice-row">
                <label className="choice">
                  <input type="radio" name="delete-choice" disabled={!canMove} checked={choice === 'moveBoth'} onChange={() => setChoice('moveBoth')} />
                  {mine > 0 ? t(($) => $.leagues.deleteLeague.moveBoth, { players: myPlayers, opponents: opponentPlayers }) : t(($) => $.leagues.deleteLeague.moveOpponents, { opponents: opponentPlayers })}
                </label>
                {select('moveBoth', t(($) => $.leagues.deleteLeague.moveBothLabel))}
              </div>
            )}
            <div className="choice-row">
              <label className="choice">
                <input type="radio" name="delete-choice" {...hint(t(($) => $.leagues.deleteLeague.deletePlayersHint))} checked={choice === 'delete'} onChange={() => setChoice('delete')} />
                {t(($) => $.leagues.deleteLeague.deletePlayers)}
              </label>
            </div>
          </fieldset>
        ) : (
          <p>{t(($) => $.leagues.deleteLeague.noPlayers)}</p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={onClose}>{t(($) => $.leagues.deleteLeague.cancel)}</button>
          <button type="button" className="btn btn-danger" {...hint(t(($) => $.leagues.deleteLeague.confirmHint))} onClick={confirm}>{t(($) => $.leagues.deleteLeague.confirm)}</button>
        </div>
      </div>
    </dialog>
  );
}
