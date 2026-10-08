import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { campStore, endCamp } from '../storage/camp';
import { mascotEnabledStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { DialogMascot } from './DialogMascot';
import { dialogsOpen, registerCampMascot, subscribeDialogs } from './dialogsOpen';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

/** Two small hops, on the mascot's perch. Transform only. */
function hop(el: Element | null) {
  if (!el || typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches || typeof el.animate !== 'function') return;
  el.animate(
    [
      { transform: 'translateY(0)', easing: 'cubic-bezier(.23, 1, .32, 1)' },
      { transform: 'translateY(-26px)', offset: 0.22, easing: 'cubic-bezier(.55, 0, 1, .45)' },
      { transform: 'translateY(0)', offset: 0.44, easing: 'cubic-bezier(.23, 1, .32, 1)' },
      { transform: 'translateY(-16px)', offset: 0.68, easing: 'cubic-bezier(.55, 0, 1, .45)' },
      { transform: 'translateY(0)' },
    ],
    { duration: 760 },
  );
}

/**
 * The end of Rookie camp: a dialog in the middle of the screen where the mascot, on its top edge like in every dialog, hops and says
 * "Touchdown!" once it has landed, and congratulates the user. Done, or Escape, ends the camp for good. It is shown as soon as the last drill is done
 * and no other dialog is open: when the drill was done by opening a dialog (a highlight), it waits for that dialog to close, and the mascot jumps
 * from the one into the other. Until it is answered it holds the page's own mascots away, so there is only ever the one.
 */
export function CampFinish() {
  const { t } = useTranslation();
  const { phase } = useStore(campStore);
  const mascotOn = useStore(mascotEnabledStore);
  const flying = useSyncExternalStore(subscribeMascotFlight, isMascotFlying, () => false);
  const otherDialog = useSyncExternalStore(subscribeDialogs, dialogsOpen, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const finished = phase === 'finished' && mascotOn;
  const [clear, setClear] = useState(false); // no other dialog is in the way
  const [landed, setLanded] = useState(false); // the mascot is on the dialog's edge: it hops and the words start

  useLayoutEffect(() => (finished ? registerCampMascot() : undefined), [finished]);

  useEffect(() => {
    if (!finished) { setClear(false); return; }
    if (!otherDialog) setClear(true); // once it is shown its own mascot counts as an open dialog, which no longer matters
  }, [finished, otherDialog]);

  const shown = finished && clear;
  useEffect(() => {
    if (!shown) { setLanded(false); return; }
    if (ref.current && !ref.current.open) ref.current.showModal();
    const timer = setInterval(() => {
      const mascot = ref.current?.querySelector('.perch-mascot');
      if (!mascot || isMascotFlying()) return;
      clearInterval(timer);
      setLanded(true);
      hop(ref.current?.querySelector('.dialog-perch') ?? null);
    }, 100);
    return () => clearInterval(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    // No backdropClose, like the welcome: only Done, or Escape, answers.
    <dialog ref={ref} data-instant aria-labelledby="finish-title" aria-describedby="finish-text" onClose={() => { if (campStore.get().phase === 'finished') endCamp('done'); }}>
      <DialogMascot />
      <div className="dlg">
        <h2 id="finish-title"><TypedText text={t(($) => $.camp.finish.title)} hold={!landed || flying} /></h2>
        <p id="finish-text">
          <TypedText text={t(($) => $.camp.finish.body)} hold={!landed || flying} />
        </p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={() => endCamp('done')}>{t(($) => $.camp.finish.done)}</button>
        </div>
      </div>
    </dialog>
  );
}
