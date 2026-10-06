import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { campStore, endCamp, patchCamp } from '../storage/camp';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { DRILLS, skipDrill, stepOn, toNextDrill } from './campDrills';
import { DialogMascot } from './DialogMascot';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

/**
 * A step that explains a whole page (`modal` in `campDrills.ts`) is a dialog in the middle of the screen, like the welcome: the mascot jumps onto its
 * top edge, says what the page is, and Next goes on to the steps that ring its controls. It is on the page it is about, and, like the welcome and the
 * finish, it goes away because the store has moved on, not because it was closed; Escape counts as Next. `RookieCamp` holds the page's own mascots
 * away meanwhile, so there is only the one.
 */
export function CampTour() {
  const { phase, step, sub } = useStore(campStore);
  const mascotOn = useStore(mascotEnabledStore);
  const name = useStore(mascotNameStore);
  const { pathname } = useLocation();
  const flying = useSyncExternalStore(subscribeMascotFlight, isMascotFlying, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const drill = phase === 'running' && mascotOn ? DRILLS[step] : undefined;
  const current = drill?.steps[sub];
  const shown = !!drill && !!current?.modal && (!stepOn(drill, current) || stepOn(drill, current) === pathname);

  useEffect(() => {
    if (shown && ref.current && !ref.current.open) ref.current.showModal();
  }, [shown]);

  if (!shown || !drill || !current) return null;
  const last = sub + 1 >= drill.steps.length;
  const next = () => { if (last) toNextDrill(step); else patchCamp({ sub: sub + 1 }); };
  return (
    // No backdropClose, like the welcome: a stray click beside it should not answer for the user.
    <dialog ref={ref} data-instant aria-labelledby="tour-title" aria-describedby="tour-text" onClose={() => { const c = campStore.get(); if (c.phase === 'running' && c.step === step && c.sub === sub) next(); }}>
      <DialogMascot />
      <div className="dlg">
        <h2 id="tour-title">{name}<span className="muted"> · drill {step + 1} of {DRILLS.length}</span></h2>
        <p id="tour-text"><TypedText text={current.text} delay={350} hold={flying} /></p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={next}>{last ? 'Complete drill' : current.next ?? 'Next'}</button>
          <button type="button" className="btn press" onClick={() => skipDrill(step)}>Skip drill</button>
          <button type="button" className="btn btn-danger press" onClick={() => endCamp('declined')}>Leave camp</button>
        </div>
      </div>
    </dialog>
  );
}
