import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n';
import { ProfileFileError, mergeProfile, parseProfileFile, type MergeSummary } from '../leagues/profileTransfer';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the profile was merged in, with a sentence for the status line. */
  onImported: (message: string) => void;
}

const leagues = (count: number) => i18n.t(($) => $.leagues.counts.league, { count });
const players = (count: number) => i18n.t(($) => $.leagues.counts.player, { count });
const newPlayers = (count: number) => i18n.t(($) => $.leagues.counts.newPlayer, { count });

function headline({ removed, updated, added, players: gained }: MergeSummary): string {
  if (removed) return i18n.t(($) => $.leagues.importProfile.headlineReplace, { leagues: leagues(removed.leagues), players: players(removed.players), added: leagues(added), newPlayers: players(gained) });
  return i18n.t(($) => $.leagues.importProfile.headlineMerge, { updated: leagues(updated), added: leagues(added), players: players(gained) });
}

/** Paste the JSON, drop a file or browse for one; the file is checked at once and previewed before anything changes. */
export function ImportProfileDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [text, setText] = useState('');
  const [readError, setReadError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText('');
      setReadError('');
      setOverride(false);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const checked = useMemo(() => {
    if (!text.trim()) return null;
    try {
      return { merged: mergeProfile(parseProfileFile(text), profiles, followed, override) };
    } catch (cause) {
      return { error: cause instanceof ProfileFileError ? cause.message : t(($) => $.leagues.importProfile.unreadable) };
    }
  }, [text, profiles, followed, override]);
  const merged = checked && 'merged' in checked ? checked.merged : null;
  const problem = readError || (checked && 'error' in checked ? checked.error : '');

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      setText(await file.text());
      setReadError('');
    } catch {
      setReadError(t(($) => $.leagues.importProfile.unreadable));
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
    const { updated, added, players: gained, removed } = merged.summary;
    if (removed) {
      onImported(t(($) => $.leagues.importProfile.doneReplaced, { leagues: leagues(removed.leagues), players: players(removed.players), added: leagues(added), newPlayers: players(gained) }));
      return;
    }
    onImported(t(($) => $.leagues.importProfile.doneMerged, { leagues: leagues(updated + added), updated, added, players: players(gained) }));
  }

  return (
    <dialog ref={ref} className="transfer-dialog" data-worried={override ? '' : undefined} aria-labelledby="import-profile-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="import-profile-title">{t(($) => $.leagues.importProfile.title)}</h2>
          <button type="button" className="close" aria-label={t(($) => $.leagues.importProfile.close)} onClick={onClose}>×</button>
        </div>
        <p className="muted">{t(($) => $.leagues.importProfile.intro)}</p>
        <label className="field-label">
          {t(($) => $.leagues.importProfile.json)}
          <textarea
            rows={8}
            {...hint(t(($) => $.leagues.importProfile.jsonHint))}
            className={dragging ? 'dragging' : undefined}
            value={text}
            spellCheck={false}
            placeholder={t(($) => $.leagues.importProfile.jsonPlaceholder)}
            onChange={(event) => { setText(event.target.value); setReadError(''); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          />
        </label>
        <div>
          <button type="button" className="btn" onClick={() => picker.current?.click()}>{t(($) => $.leagues.importProfile.browse)}</button>
          <input
            ref={picker}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label={t(($) => $.leagues.importProfile.file)}
            onChange={(event) => { void load(event.target.files?.[0]); event.target.value = ''; }}
          />
        </div>
        <label className="check-row">
          <input type="checkbox" {...hint(t(($) => $.leagues.importProfile.overrideHint))} checked={override} onChange={(event) => setOverride(event.target.checked)} />
          {t(($) => $.leagues.importProfile.override)}
        </label>
        {override && <p className="error">{t(($) => $.leagues.importProfile.overrideWarning)}</p>}
        {problem && <p className="error" role="alert">{problem}</p>}
        {merged && (
          <section className="plan" aria-label={t(($) => $.leagues.importProfile.plan)}>
            <h3>{headline(merged.summary)}</h3>
            <ul className="starter-list">
              {merged.summary.leagues.map((league) => (
                <li key={league.id}><b>{league.kind === 'update' ? t(($) => $.leagues.importProfile.update) : t(($) => $.leagues.importProfile.add)}</b> {t(($) => $.leagues.importProfile.leagueLine, { name: league.name, players: newPlayers(league.players) })}</li>
              ))}
            </ul>
          </section>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>{t(($) => $.leagues.importProfile.cancel)}</button>
          <button type="button" className={`btn ${override ? 'btn-danger' : 'btn-primary'}`} disabled={!merged} onClick={apply}>{override ? t(($) => $.leagues.importProfile.replaceEverything) : t(($) => $.leagues.importProfile.import)}</button>
        </div>
      </div>
    </dialog>
  );
}
