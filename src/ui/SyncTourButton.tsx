import { useRef } from 'react';
import { backdropClose } from './backdropClose';
import { DialogMascot } from './DialogMascot';

/** A button that plays Fumble's narrated walkthrough of the bookmark setup, in a dialog like the highlights one. */
export function SyncTourButton() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return <>
    <button type="button" className="btn" onClick={() => ref.current?.showModal()}>Watch video</button>
    <dialog ref={ref} className="hl-dlg" aria-labelledby="sync-tour-title"
      onClose={(event) => event.currentTarget.querySelector('video')?.pause()} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="sync-tour-title">Sync your starters, with Fumble</h2>
          <button type="button" className="close" aria-label="Close video" onClick={close}>×</button>
        </div>
        <figure className="hl-player">
          <video src="/sync-tour.mp4" controls playsInline preload="none" aria-label="Fumble shows how to sync your starters with the bookmark" />
        </figure>
      </div>
    </dialog>
  </>;
}
