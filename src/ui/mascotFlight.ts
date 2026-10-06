// The mascot never disappears: when it stops being in one place (the header's edge, an empty state) and shows up in another
// at the same moment, it jumps there. Leaving and arriving are separate components in separate pages, so this matches them up:
// whichever happens first is remembered for a moment, and when the other follows, a copy of the mascot flies between them.

const WINDOW_MS = 200; // how long a leaving, or an arrival, waits for its counterpart

interface Leaving { rect: DOMRect; at: number }
interface Arrival { el: SVGSVGElement; at: number }

let leaving: Leaving | null = null;
let arrival: Arrival | null = null;

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fresh = (at: number) => Date.now() - at < WINDOW_MS;
const near = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 6 && Math.abs(a.top - b.top) < 6 && Math.abs(a.width - b.width) < 6;

/** A mascot has been placed on the page. */
export function mascotAppeared(el: SVGSVGElement) {
  if (leaving && fresh(leaving.at)) {
    const from = leaving.rect;
    leaving = null;
    fly(from, el);
  } else {
    arrival = { el, at: Date.now() };
  }
}

/** A mascot has been taken off the page; `rect` is where it was. */
export function mascotLeft(rect: DOMRect) {
  if (arrival && fresh(arrival.at) && arrival.el.isConnected) {
    const el = arrival.el;
    arrival = null;
    fly(rect, el);
  } else {
    leaving = { rect, at: Date.now() };
  }
}

/** Forget anything waiting; for tests. */
export function resetMascotFlight() {
  leaving = null;
  arrival = null;
}

/**
 * Jumps a copy of the mascot from where it was to where it now is, in an arc: up fast and slowing, then falling faster, then a
 * small squash on landing. The real mascot waits, hidden and with its own animations paused, until the copy arrives.
 */
function fly(from: DOMRect, el: SVGSVGElement) {
  if (calm() || typeof el.animate !== 'function') return;
  const to = el.getBoundingClientRect();
  if (near(from, to)) return; // it did not really move: the header is rebuilt on every page

  const copy = el.cloneNode(true) as SVGSVGElement;
  copy.classList.add('flying');
  Object.assign(copy.style, { position: 'fixed', left: '0', top: '0', width: `${to.width}px`, height: `${to.height}px`, margin: '0', transformOrigin: '0 0', zIndex: '40', pointerEvents: 'none', bottom: 'auto' });
  document.body.appendChild(copy);

  el.classList.add('in-flight'); // hidden, and its animations held until it lands
  el.style.visibility = 'hidden';

  const scaleFrom = from.width / to.width;
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const distance = Math.hypot(dx, dy);
  const hop = 36 + Math.min(80, distance * 0.18); // how high above the higher of the two places it goes
  // The header sits at the top of the screen, so the arc stays on screen: the mascot never leaves the picture.
  const apexY = Math.max(2, Math.min(from.top, to.top) - hop);
  const peak = dy < 0 ? 0.65 : 0.35; // jumping up, the top of the arc is near the end; jumping off, it is near the start
  const at = (x: number, y: number, scale: number) => `translate(${x}px, ${y}px) scale(${scale})`;

  const animation = copy.animate(
    [
      { transform: at(from.left, from.top, scaleFrom), offset: 0, easing: 'cubic-bezier(.2,.7,.35,1)' }, // up: fast, then slowing
      { transform: at(from.left + dx * peak, apexY, scaleFrom + (1 - scaleFrom) * peak), offset: peak, easing: 'cubic-bezier(.6,0,.85,.4)' }, // down: slow, then fast
      { transform: at(to.left, to.top, 1), offset: 1 },
    ],
    { duration: Math.round(Math.min(900, 480 + distance * 0.35)), fill: 'forwards' },
  );

  const land = () => {
    copy.remove();
    el.style.visibility = '';
    el.classList.remove('in-flight');
    el.classList.add('landed');
    setTimeout(() => el.classList.remove('landed'), 600);
  };
  animation.onfinish = land;
  animation.oncancel = land;
}
