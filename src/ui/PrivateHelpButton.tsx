import { useId, useRef, useState } from 'react';
import { PrivateSettingsGuide, type PrivateHelpMode } from './PrivateSettingsGuide';

/** The same compact Fumble hint for each private-league setup method. */
export function PrivateHelpButton({ mode }: { mode: PrivateHelpMode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={anchor} type="button" className="btn" aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      }}>How?</button>
    {open && <PrivateSettingsGuide id={id} anchor={anchor} mode={mode} />}
  </>;
}
