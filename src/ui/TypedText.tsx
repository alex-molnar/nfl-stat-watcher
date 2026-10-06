import { useEffect, useRef, useState } from 'react';

const STEP = 16; // ms between updates
const PER_CHAR = 28; // ms per character for short text
const AFTER_HOLD = 120; // ms of calm between the mascot landing and the first letter
const LONGEST = 1500; // ms: long text speeds up so a long hint never makes the reader wait

/** How many characters of `text` are shown, growing as if it were being typed. A new text starts again from nothing. */
function useTyped(text: string, delay: number, hold: boolean): number {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(calm ? text.length : 0);
  const first = useRef(true); // the delay is for the first appearance only, a replacement text starts typing at once
  const held = useRef(false); // it was kept waiting, so it starts a moment after it is let go

  useEffect(() => {
    if (calm) { setShown(text.length); return; }
    setShown(0);
    if (hold) { held.current = true; return; } // nothing is typed while it is held back
    const wait = held.current ? AFTER_HOLD : first.current ? delay : 0;
    held.current = false;
    const perChar = Math.min(PER_CHAR, LONGEST / Math.max(text.length, 1));
    const start = Date.now() + wait;
    first.current = false;
    const timer = setInterval(() => {
      const count = Math.min(text.length, Math.max(0, Math.floor((Date.now() - start) / perChar)));
      setShown(count);
      if (count >= text.length) clearInterval(timer);
    }, STEP);
    return () => clearInterval(timer);
  }, [text, delay, calm, hold]);

  return shown;
}

/**
 * Text that types itself out, so a speaking mascot feels like it is talking. Assistive technology gets the whole sentence at
 * once (the screen-reader copy), never one letter at a time. A hidden copy of the whole text holds the space, so the layout
 * does not move as the letters arrive. `delay` holds back the first letters of the first text, for an entrance to finish; `hold`
 * keeps it silent for as long as something else (the mascot's jump) is going on, then it starts a moment after.
 * Under reduced motion the text is simply there.
 */
export function TypedText({ text, delay = 0, hold = false }: { text: string; delay?: number; /** Keeps it from typing, and clears it, until released. */ hold?: boolean }) {
  const shown = useTyped(text, delay, hold);
  return (
    <>
      <span className="sr">{text}</span>
      <span className="typed" aria-hidden="true">
        <span className="typed-ghost">{text}</span>
        <span className="typed-live">{text.slice(0, shown)}</span>
      </span>
    </>
  );
}
