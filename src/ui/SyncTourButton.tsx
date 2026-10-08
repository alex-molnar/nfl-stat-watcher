import { useRef } from 'react';
import { track } from '../metrics/track';
import { backdropClose } from './backdropClose';
import { DialogMascot } from './DialogMascot';

/** A button that plays Fumble's narrated walkthrough of the bookmark setup, in a dialog like the highlights one. */
export function SyncTourButton() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const open = () => {
    ref.current?.showModal();
    track('help', { step: 'video' });
    // The click is the user's gesture, so the browser lets it play with sound; a refusal just leaves the controls to start it.
    void ref.current?.querySelector('video')?.play().catch(() => {});
  };
  return <>
    <button type="button" className="btn" onClick={open}>Watch video</button>
    <dialog ref={ref} className="hl-dlg" aria-labelledby="sync-tour-title"
      onClose={(event) => {
        event.stopPropagation(); // React bubbles close through the tree: without this the sync dialog this sits in would close as well
        event.currentTarget.querySelector('video')?.pause();
      }} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="sync-tour-title">Sync your starters, with Fumble</h2>
          <button type="button" className="close" aria-label="Close video" onClick={close}>×</button>
        </div>
        <figure className="hl-player">
          <video src="/sync-tour.mp4" controls playsInline preload="auto" aria-label="Fumble shows how to sync your starters with the bookmark" />
        </figure>
      </div>
    </dialog>
  </>;
}
