// The mascot never disappears: when it stops being in one place (the header's edge, an empty state) and shows up in another
// at the same moment, it jumps there. Leaving and arriving are separate components in separate pages, so this matches them up:
// whichever happens first is remembered for a moment, and when the other follows, a copy of the mascot flies between them.

const WINDOW_MS = 200; // how long a leaving, or an arrival, waits for its counterpart
const CROUCH_MS = 260; // the build-up before it leaves the ground: bend the legs, dip, throw the arms up

interface Leaving { rect: DOMRect; at: number }
interface Arrival { el: SVGSVGElement; rect: DOMRect; at: number }

let leaving: Leaving | null = null;
let arrival: Arrival | null = null;

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fresh = (at: number) => Date.now() - at < WINDOW_MS;
const near = (a: DOMRect, b: DOMRect) => Math.abs(a.left - b.left) < 6 && Math.abs(a.top - b.top) < 6 && Math.abs(a.width - b.width) < 6;

/** A mascot has been placed on the page. */
export function mascotAppeared(el: SVGSVGElement) {
  const rect = el.getBoundingClientRect(); // read now, with the new page in place
  if (leaving && fresh(leaving.at)) {
    const from = leaving.rect;
    leaving = null;
    fly(from, el, rect);
  } else {
    arrival = { el, rect, at: Date.now() };
  }
}

/** A mascot has been taken off the page; `rect` is where it was. */
export function mascotLeft(rect: DOMRect) {
  if (arrival && fresh(arrival.at) && arrival.el.isConnected) {
    const { el, rect: to } = arrival;
    arrival = null;
    fly(rect, el, to);
  } else {
    leaving = { rect, at: Date.now() };
  }
}

/** Forget anything waiting; for tests. */
export function resetMascotFlight() {
  leaving = null;
  arrival = null;
  flights = 0;
  watchers.forEach((notify) => notify());
}

// Whether a jump is under way, for what should wait for it: the speech bubble does not show or start talking until the mascot has landed.
let flights = 0;
const watchers = new Set<() => void>();
export const isMascotFlying = () => flights > 0;
export function subscribeMascotFlight(notify: () => void) {
  watchers.add(notify);
  return () => void watchers.delete(notify);
}
function countFlight(change: 1 | -1) {
  flights += change;
  watchers.forEach((notify) => notify());
}

/**
 * The mascot's own movement around the jump, on the copy's parts: before it goes, the legs bend (they splay and shorten), the
 * whole body dips and the arms are flung up and flail; as it goes the body stretches and springs back, the arms keep flailing
 * in the air and the legs stay tucked; and towards the end the limbs come back to rest, so the landing is a normal pose.
 * Parts a drawing does not have are skipped.
 */
function limbsForTheJump(copy: SVGSVGElement, flightMs: number) {
  const part = (selector: string) => copy.querySelector<SVGElement>(selector);
  const go = (el: SVGElement | null, frames: Keyframe[], options: KeyframeAnimationOptions) => el?.animate?.(frames, { fill: 'forwards', ...options });
  const crouch = { duration: CROUCH_MS, easing: 'ease-out' };
  const air = { duration: flightMs, delay: CROUCH_MS };
  const rest = (transform: string): Keyframe => ({ transform });

  // The body: down into a squash (feet stay put), then a stretch on take-off that eases back to normal.
  const squash = 'translateY(10px) scale(1.08, .86)';
  const root = part('.m-root');
  go(root, [rest('none'), rest(squash)], crouch);
  go(root, [rest(squash), { transform: 'translateY(-4px) scale(.94, 1.1)', offset: 0.18 }, rest('none')], { duration: Math.min(flightMs, 420), delay: CROUCH_MS, easing: 'ease-out' });

  // The legs bend: splayed out and shortened, and kept so in the air until the last stretch of the flight.
  for (const [selector, side] of [['.m-leg-l', 1], ['.m-leg-r', -1]] as const) {
    const bent = `rotate(${14 * side}deg) scaleY(.72)`;
    go(part(selector), [rest('none'), rest(bent)], crouch);
    go(part(selector), [rest(bent), { transform: `rotate(${9 * side}deg) scaleY(.8)`, offset: 0.7 }, rest('none')], { ...air, easing: 'ease-in-out' });
  }

  // The arms: thrown up and flailing, in opposite directions, and brought down for the landing.
  for (const [selector, side, lag] of [['.m-arm-l', 1, 0], ['.m-arm-r', -1, 1]] as const) {
    const up = (deg: number) => rest(`rotate(${deg * side}deg)`);
    const wave = lag ? [115, 168, 128, 160] : [125, 160, 120, 165];
    go(part(selector), [up(0), { ...up(wave[0]!), offset: 0.35 }, { ...up(wave[1]!), offset: 0.6 }, { ...up(wave[2]!), offset: 0.8 }, up(wave[3]!)], crouch);
    go(part(selector), [up(wave[3]!), { ...up(wave[1]!), offset: 0.2 }, { ...up(wave[0]! + 10), offset: 0.4 }, { ...up(wave[2]!), offset: 0.62 }, up(0)], { ...air, easing: 'ease-in-out' });
  }
}

/**
 * Jumps a copy of the mascot from where it was to where it now is, in an arc: up fast and slowing, then falling faster, then a
 * small squash on landing. The real mascot waits, hidden and with its own animations paused, until the copy arrives.
 */
function fly(from: DOMRect, el: SVGSVGElement, to: DOMRect) {
  if (calm() || typeof el.animate !== 'function') return;
  if (near(from, to)) return; // it did not really move: the header is rebuilt on every page

  countFlight(1);
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

  const flightMs = Math.round(Math.min(900, 480 + distance * 0.35));
  const animation = copy.animate(
    [
      { transform: at(from.left, from.top, scaleFrom), offset: 0, easing: 'cubic-bezier(.2,.7,.35,1)' }, // up: fast, then slowing
      { transform: at(from.left + dx * peak, apexY, scaleFrom + (1 - scaleFrom) * peak), offset: peak, easing: 'cubic-bezier(.6,0,.85,.4)' }, // down: slow, then fast
      { transform: at(to.left, to.top, 1), offset: 1 },
    ],
    { duration: flightMs, delay: CROUCH_MS, fill: 'both' }, // it waits where it was while it crouches
  );
  limbsForTheJump(copy, flightMs);

  let landed = false;
  const land = () => {
    if (landed) return; // finishing and cancelling can both report
    landed = true;
    countFlight(-1);
    copy.remove();
    el.style.visibility = '';
    el.classList.remove('in-flight');
    // It keeps `landed` for good: taking it off later would hand the mascot back to its entrance animation, which would play again as a flicker.
    el.classList.add('landed');
  };
  animation.onfinish = land;
  animation.oncancel = land;
}
