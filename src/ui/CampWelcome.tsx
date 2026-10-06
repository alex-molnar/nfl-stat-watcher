import { useEffect, useRef, useSyncExternalStore } from 'react';
import { campStore, endCamp, startCamp } from '../storage/camp';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { DialogMascot, useHint } from './DialogMascot';
import { isMascotFlying, subscribeMascotFlight } from './mascotFlight';
import { TypedText } from './TypedText';

const DELAY_MS = 700; // the page settles before the greeting, so it does not slam in with it

/**
 * The first thing a new user sees: the mascot jumps up onto the edge of a dialog in the middle of the screen, says hi and asks whether to
 * enter Rookie camp. Shown once, to a user with no league who has not answered yet, and only with the mascot on. Entering starts the first drill
 * (the mascot hops from the dialog to its target); Skip, or Escape, is remembered like Leave camp and the mascot jumps back to the header. The
 * dialog goes away because the answer is in the store, not because it was closed, so the mascot's jump is the same as for any other dialog.
 */
export function CampWelcome() {
  const { phase } = useStore(campStore);
  const mascotOn = useStore(mascotEnabledStore);
  const name = useStore(mascotNameStore);
  const noLeague = useStore(profilesStore).length === 0;
  const hint = useHint();
  const flying = useSyncExternalStore(subscribeMascotFlight, isMascotFlying, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const offered = mascotOn && phase === 'idle' && noLeague;

  useEffect(() => {
    if (!offered) return;
    const timer = setTimeout(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [offered]);

  if (!offered) return null;
  return (
    // No backdropClose: a stray click beside it should not answer for the user. Escape is Skip.
    <dialog ref={ref} aria-labelledby="welcome-title" aria-describedby="welcome-text" onClose={() => { if (campStore.get().phase === 'idle') endCamp('declined'); }}>
      <DialogMascot />
      <div className="dlg">
        <h2 id="welcome-title">Hi, I’m {name}!</h2>
        <p id="welcome-text">
          <TypedText text="I’m the football in glasses who keeps an eye on the stats around here. Want to join my training camp? It’s four short drills on the real app, and you’ll know your way around in about a minute. And if I’m ever in the way, you can turn me off at any point in Settings." delay={350} hold={flying} />
        </p>
        <div className="dlg-actions">
          {/* Enter is first, so it takes the focus the dialog opens with. */}
          <button type="button" className="btn btn-primary press" {...hint('Four drills, each one done on the real pages.')} onClick={startCamp}>Enter training camp</button>
          <button type="button" className="btn press" {...hint('You can start it later from Settings.')} onClick={() => endCamp('declined')}>Skip</button>
          <button type="button" className="btn press" {...hint('Turns me off. You can switch me back on in Settings.')} onClick={() => { endCamp('declined'); mascotEnabledStore.set(false); }}>Skip and disable {name}</button>
        </div>
      </div>
    </dialog>
  );
}
