import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { campStore, patchCamp } from '../storage/camp';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { DRILLS, leaveCamp, said, skipDrill, stepOn, stepText, toNextDrill, type Facts } from './campDrills';
import { DialogMascot } from './DialogMascot';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

const NO_FACTS: Facts = { leagues: 0, followed: 0, path: '', imported: false, practice: false }; // a tour's text is fixed, it asks nothing of the state

/**
 * A step that explains a whole page (`modal` in `campDrills.ts`) is a dialog in the middle of the screen, like the welcome: the mascot jumps onto its
 * top edge, says what the page is, and Next goes on to the steps that ring its controls. It is on the page it is about, and, like the welcome and the
 * finish, it goes away because the store has moved on, not because it was closed; Escape counts as Next. `RookieCamp` holds the page's own mascots
 * away meanwhile, so there is only the one.
 */
export function CampTour() {
  const { t } = useTranslation();
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
        <h2 id="tour-title">{name}<span className="muted"> · {t(($) => $.camp.drillOf, { step: step + 1, total: DRILLS.length })}</span></h2>
        <p id="tour-text"><TypedText text={stepText(current, NO_FACTS)} delay={350} hold={flying} /></p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary press" onClick={next}>{last ? t(($) => $.camp.completeDrill) : current.next ? said(current.next) : t(($) => $.camp.next)}</button>
          <button type="button" className="btn press" onClick={() => skipDrill(step)}>{t(($) => $.camp.skipDrill)}</button>
          <button type="button" className="btn btn-danger press" onClick={leaveCamp}>{t(($) => $.camp.leaveCamp)}</button>
        </div>
      </div>
    </dialog>
  );
}
