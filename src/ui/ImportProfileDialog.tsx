import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ProfileFileError, mergeProfile, parseProfileFile } from '../leagues/profileTransfer';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the profile was merged in, with a sentence for the status line. */
  onImported: (message: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Paste the JSON, drop a file or browse for one; the file is checked at once and previewed before anything changes. */
export function ImportProfileDialog({ open, onClose, onImported }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [text, setText] = useState('');
  const [readError, setReadError] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText('');
      setReadError('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const checked = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { merged: mergeProfile(parseProfileFile(text), profiles, followed) };
    } catch (cause) {
      return { error: cause instanceof ProfileFileError ? cause.message : 'Could not read that file.' };
    }
  }, [text, profiles, followed]);
  const merged = checked && 'merged' in checked ? checked.merged : null;
  const problem = readError || (checked && 'error' in checked ? checked.error : '');

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      setText(await file.text());
      setReadError('');
    } catch {
      setReadError('Could not read that file.');
    }
  }

  function drop(event: DragEvent) {
    setDragging(false);
    if (event.dataTransfer.files.length === 0) return; // dropped text lands in the box by itself
    event.preventDefault();
    void load(event.dataTransfer.files[0]);
  }

  function apply() {
    if (!merged) return;
    profilesStore.set(merged.profiles);
    followedStore.set(merged.followed);
    const { updated, added, players } = merged.summary;
    onImported(`Imported ${plural(updated + added, 'league')}: ${updated} updated, ${added} added, ${plural(players, 'player')} added.`);
  }

  return (
    <dialog ref={ref} className="transfer-dialog" aria-labelledby="import-profile-title" onClose={onClose} {...backdropClose}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="import-profile-title">Import StatWatch profile</h2>
          <button type="button" className="close" aria-label="Close import dialog" onClick={onClose}>×</button>
        </div>
        <p className="muted">Paste the profile JSON, drop the file on the box or browse for it. A league that is already here is updated; other leagues are added. Nothing is removed.</p>
        <label className="field-label">
          Profile JSON
          <textarea
            rows={8}
            className={dragging ? 'dragging' : undefined}
            value={text}
            spellCheck={false}
            placeholder="Paste the JSON here, or drop a .json file"
            onChange={(event) => { setText(event.target.value); setReadError(''); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          />
        </label>
        <div>
          <button type="button" className="btn" onClick={() => picker.current?.click()}>Browse computer</button>
          <input
            ref={picker}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Profile file"
            onChange={(event) => { void load(event.target.files?.[0]); event.target.value = ''; }}
          />
        </div>
        {problem && <p className="error" role="alert">{problem}</p>}
        {merged && (
          <section className="plan" aria-label="What this import will do">
            <h3>{`Update ${plural(merged.summary.updated, 'league')}, add ${plural(merged.summary.added, 'league')}, add ${plural(merged.summary.players, 'player')}`}</h3>
            <ul className="starter-list">
              {merged.summary.leagues.map((league) => (
                <li key={league.id}><b>{league.kind === 'update' ? 'Update' : 'Add'}</b> {league.name} ({plural(league.players, 'new player')})</li>
              ))}
            </ul>
          </section>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!merged} onClick={apply}>Import</button>
        </div>
      </div>
    </dialog>
  );
}
