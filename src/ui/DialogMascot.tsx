import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mascotEnabledStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { registerOpenDialog } from './dialogsOpen';
import { Mascot, SEAT_Y } from './Mascot';
import { TypedText } from './TypedText';

const SIZE = 72; // px: the same whatever the size of the dialog, since it hangs from the dialog's top-left corner
const SETTLE_MS = 190; // the dialog's own opening animation (180 ms) has to finish before the mascot can land in its final place

/**
 * Attributes that give a control a hint: while it is hovered or focused the mascot says it from the dialog's edge, and with the mascot off
 * it is the control's tooltip instead.
 */
export function useHint() {
  const on = useStore(mascotEnabledStore);
  return (text: string) => ({ 'data-hint': text, ...(on ? {} : { title: text }) });
}

/**
 * The mascot in a dialog, put as its first child. It sits on the dialog's top edge near the left corner, seated like in the header, with its legs
 * hanging into the dialog. Since it hangs from the corner it does not matter how the dialog's size changes. It jumps there from where it was
 * once the dialog has settled, and back when it closes. When a control with a hint (`data-hint`, see `useHint`) is hovered or focused, a bubble
 * beside it types the hint. Without the mascot (the setting) this renders nothing.
 */
export function DialogMascot() {
  const mascotOn = useStore(mascotEnabledStore);
  const perch = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false); // the dialog is open and has settled
  const [hint, setHint] = useState('');

  useEffect(() => {
    const dialog = perch.current?.closest('dialog');
    if (!dialog || !mascotOn) return;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      if (dialog.open) {
        timer = setTimeout(() => setReady(true), calm ? 0 : SETTLE_MS);
      } else {
        setReady(false);
        setHint('');
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const say = (event: Event) => setHint((event.target as Element).closest?.('[data-hint]')?.getAttribute('data-hint') ?? '');
    const hush = () => setHint('');
    dialog.addEventListener('mouseover', say);
    dialog.addEventListener('focusin', say);
    dialog.addEventListener('mouseleave', hush);
    dialog.addEventListener('focusout', hush);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      dialog.removeEventListener('mouseover', say);
      dialog.removeEventListener('focusin', say);
      dialog.removeEventListener('mouseleave', hush);
      dialog.removeEventListener('focusout', hush);
    };
  }, [mascotOn]);

  // The page's own mascots step aside from the moment this one is there, in the same commit, so the one mascot jumps from the page into the dialog.
  useLayoutEffect(() => (ready ? registerOpenDialog() : undefined), [ready]);

  if (!mascotOn) return null;
  return (
    <div ref={perch} className="dialog-perch">
      {ready && <Mascot size={SIZE} seated entrance={false} className="perch-mascot" style={{ top: -(SEAT_Y / 200) * SIZE }} />}
      {/* The live region is always there, so a hint that appears is announced; the bubble is its content. */}
      <div className="perch-say" aria-live="polite">
        {ready && hint && <div className="perch-bubble"><TypedText text={hint} /></div>}
      </div>
    </div>
  );
}
