import { useLayoutEffect, useRef, type RefObject } from 'react';
import { mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { useStore } from '../storage/useStore';
import { Mascot } from './Mascot';
import { TypedText } from './TypedText';

/** A compact hint beside its trigger, above the import dialog without taking focus. */
export function PrivateSettingsGuide({ id, anchor }: { id: string; anchor: RefObject<HTMLButtonElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const name = useStore(mascotNameStore);
  const mascotOn = useStore(mascotEnabledStore);

  useLayoutEffect(() => {
    const popup = ref.current;
    if (!popup) return;
    popup.showPopover?.();
    const position = () => {
      const button = anchor.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = popup.offsetWidth;
      const height = popup.offsetHeight;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = rect.bottom + height + 10 <= window.innerHeight - 12 ? rect.bottom + 10 : Math.max(12, rect.top - height - 10);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [anchor]);

  return (
    <div ref={ref} id={id} role="tooltip" popover="manual" className="private-settings-guide">
      <div className="private-settings-guide-head">
        {mascotOn && <Mascot size={48} entrance={false} />}
        <b>{name} · Copy settings</b>
      </div>
      <p><TypedText text="Stay signed in to ESPN, then follow these steps:" /></p>
      <ol>
        <li>Click Open Settings to open your league’s data.</li>
        <li>Select all with Ctrl+A (Cmd+A on Mac), then copy with Ctrl+C (Cmd+C).</li>
        <li>Return here and paste into the settings box. I’ll check it for you!</li>
      </ol>
    </div>
  );
}
