import { useEffect, useMemo, useRef, useState } from 'react';
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
      setNote('Copied to the clipboard.');
    } catch {
      areaRef.current?.select();
      setNote('Your browser would not copy it. The text is selected: press Cmd or Ctrl plus C.');
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setNote(`Downloaded ${FILE_NAME}.`);
  }

  return (
    <dialog ref={ref} className="transfer-dialog" aria-labelledby="export-title" onClose={onClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="export-title">Export profile</h2>
          <button type="button" className="close" aria-label="Close export dialog" onClick={onClose}>×</button>
        </div>
        <p className="muted">Every league with its scoring and settings, and the players followed in it, on both sides. Import it in another browser to get the same setup.</p>
        <div className="json-box">
          <textarea ref={areaRef} readOnly rows={10} value={json} aria-label="Profile JSON" spellCheck={false} />
          <button type="button" className="icon-btn" {...hint('Copies the whole profile as text, to paste into another browser or device.')} aria-label="Copy to clipboard" title="Copy to clipboard" onClick={() => void copy()}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
          </button>
        </div>
        <p className={note ? 'muted' : 'sr'} role="status" aria-live="polite">{note}</p>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" {...hint('Saves the profile as a file called statwatch-profile.json.')} onClick={download}>Download</button>
        </div>
      </div>
    </dialog>
  );
}
