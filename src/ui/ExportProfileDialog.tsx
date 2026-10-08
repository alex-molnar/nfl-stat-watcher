import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportProfile, serializeProfile } from '../leagues/profileTransfer';
import { followedStore } from '../storage/followed';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';

const FILE_NAME = 'statwatch-profile.json';

interface Props { open: boolean; onClose: () => void }

/** Shows the whole profile as JSON, to copy or to download. Nothing leaves the browser. */
export function ExportProfileDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [note, setNote] = useState('');
  const json = useMemo(() => (open ? serializeProfile(exportProfile(profiles, followed)) : ''), [open, profiles, followed]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setNote('');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setNote(t(($) => $.leagues.exportProfile.copied));
    } catch {
      areaRef.current?.select();
      setNote(t(($) => $.leagues.exportProfile.copyFailed));
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setNote(t(($) => $.leagues.exportProfile.downloaded, { file: FILE_NAME }));
  }

  return (
    <dialog ref={ref} className="transfer-dialog" aria-labelledby="export-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="export-title">{t(($) => $.leagues.exportProfile.title)}</h2>
          <button type="button" className="close" aria-label={t(($) => $.leagues.exportProfile.close)} onClick={onClose}>×</button>
        </div>
        <p className="muted">{t(($) => $.leagues.exportProfile.intro)}</p>
        <div className="json-box">
          <textarea ref={areaRef} readOnly rows={10} value={json} aria-label={t(($) => $.leagues.exportProfile.json)} spellCheck={false} />
          <button type="button" className="icon-btn" {...hint(t(($) => $.leagues.exportProfile.copyHint))} aria-label={t(($) => $.leagues.exportProfile.copy)} title={t(($) => $.leagues.exportProfile.copy)} onClick={() => void copy()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
          </button>
        </div>
        <p className={note ? 'muted' : 'sr'} role="status" aria-live="polite">{note}</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>{t(($) => $.leagues.exportProfile.close2)}</button>
          <button type="button" className="btn btn-primary" {...hint(t(($) => $.leagues.exportProfile.downloadHint))} onClick={download}>{t(($) => $.leagues.exportProfile.download)}</button>
        </div>
      </div>
    </dialog>
  );
}
