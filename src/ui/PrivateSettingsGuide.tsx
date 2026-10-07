import { useEffect, useId, useRef } from 'react';
import { mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { DialogMascot } from './DialogMascot';
import { TypedText } from './TypedText';

/** A short, optional drill that leaves the user's Rookie camp progress alone. */
export function PrivateSettingsGuide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const name = useStore(mascotNameStore);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} {...backdropClose} onClose={(event) => {
      // Closing this drill must not close the surrounding import dialog.
      event.stopPropagation();
      onClose();
    }}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id={`${id}-title`}>{name}{' '}<span className="muted">· Copy private league settings</span></h2>
          <button type="button" className="close" aria-label="Close settings help" onClick={() => ref.current?.close()}>×</button>
        </div>
        <p id={`${id}-text`}><TypedText delay={350} text="Let’s bring those settings over! Stay signed in to ESPN in this browser, then follow these three steps. I only keep your scoring and lineup settings; nothing leaves your browser." /></p>
        <ol>
          <li>Click Open Settings in the import dialog. Your league’s settings data opens in a new tab.</li>
          <li>On that page, select everything with Ctrl+A (Cmd+A on Mac), then copy with Ctrl+C (Cmd+C on Mac).</li>
          <li>Come back here and paste the copied text into the settings box. I’ll check it and show your league for review.</li>
        </ol>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={() => ref.current?.close()}>Got it</button>
        </div>
      </div>
    </dialog>
  );
}
