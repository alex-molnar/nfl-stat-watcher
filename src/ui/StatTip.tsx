import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useAnchoredPopover } from './useAnchoredPopover';

/** A stat on a card that shows, on hover, how the league scores it; the last line is what it earned this game. */
export function StatTip({ rules, children }: { rules: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchor} className="stat has-tip" aria-describedby={open ? id : undefined} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && <Popup id={id} anchor={anchor} rules={rules} />}
    </div>
  );
}

function Popup({ id, anchor, rules }: { id: string; anchor: RefObject<HTMLDivElement | null>; rules: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useAnchoredPopover(ref, anchor);
  const lines = rules.split('\n');
  return (
    <div ref={ref} id={id} role="tooltip" popover="manual" className="popup-hint stat-tip">
      {lines.slice(0, -1).map((line) => <div key={line}>{line}</div>)}
      <div className="stat-tip-total">{lines.at(-1)}</div>
    </div>
  );
}
