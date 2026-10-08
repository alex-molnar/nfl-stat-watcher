import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n';
import { track } from '../metrics/track';
import { backdropClose } from './backdropClose';
import { DialogMascot } from './DialogMascot';

/** A button that plays Fumble's narrated walkthrough of the bookmark setup, in a dialog like the highlights one. */
export function SyncTourButton() {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  const open = () => {
    ref.current?.showModal();
    track('help', { step: 'video' });
    // The click is the user's gesture, so the browser lets it play with sound; a refusal just leaves the controls to start it.
    void ref.current?.querySelector('video')?.play().catch(() => {});
  };
  return <>
    <button type="button" className="btn" onClick={open}>{t(($) => $.sync.tour.watch)}</button>
    <dialog ref={ref} className="hl-dlg" aria-labelledby="sync-tour-title"
      onClose={(event) => {
        event.stopPropagation(); // React bubbles close through the tree: without this the sync dialog this sits in would close as well
        event.currentTarget.querySelector('video')?.pause();
      }} {...backdropClose}>
      <DialogMascot />
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="sync-tour-title">{t(($) => $.sync.tour.title)}</h2>
          <button type="button" className="close" aria-label={t(($) => $.sync.tour.close)} onClick={close}>×</button>
        </div>
        <figure className="hl-player">
          <video src="/sync-tour.mp4" controls playsInline preload="auto" aria-label={t(($) => $.sync.tour.videoLabel)}>
            {/* The voice is English; each language has its captions, and the one for the site's language is on by default. */}
            {LANGUAGES.map((code) => <track key={code} kind="captions" srcLang={code} label={LANGUAGE_NAMES[code]} src={`/captions/sync-tour.${code}.vtt`} default={code === i18n.language} />)}
          </video>
          {i18n.language !== 'en' && <figcaption className="muted">{t(($) => $.sync.tour.voiceNote)}</figcaption>}
        </figure>
      </div>
    </dialog>
  </>;
}
