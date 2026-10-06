import { useEffect, useRef, useState } from 'react';

const STEP = 16; // ms between updates
const PER_CHAR = 28; // ms per character for short text
const LONGEST = 1500; // ms: long text speeds up so a long hint never makes the reader wait

/** How many characters of `text` are shown, growing as if it were being typed. A new text starts again from nothing. */
function useTyped(text: string, delay: number): number {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(calm ? text.length : 0);
  const first = useRef(true); // the delay is for the first appearance only, a replacement text starts typing at once

  useEffect(() => {
    if (calm) { setShown(text.length); return; }
    setShown(0);
    const perChar = Math.min(PER_CHAR, LONGEST / Math.max(text.length, 1));
    const start = Date.now() + (first.current ? delay : 0);
    first.current = false;
    const timer = setInterval(() => {
      const count = Math.min(text.length, Math.max(0, Math.floor((Date.now() - start) / perChar)));
      setShown(count);
      if (count >= text.length) clearInterval(timer);
    }, STEP);
    return () => clearInterval(timer);
  }, [text, delay, calm]);

  return shown;
}

/**
 * Text that types itself out, so a speaking mascot feels like it is talking. Assistive technology gets the whole sentence at
 * once (the screen-reader copy), never one letter at a time. A hidden copy of the whole text holds the space, so the layout
 * does not move as the letters arrive. `delay` holds back the first letters of the first text, for an entrance to finish.
 * Under reduced motion the text is simply there.
 */
export function TypedText({ text, delay = 0 }: { text: string; delay?: number }) {
  const shown = useTyped(text, delay);
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
