import { vi } from 'vitest';
import { mascotAppeared, mascotLeft, resetMascotFlight } from './mascotFlight';

const rect = (left: number, top: number, width: number) => ({ left, top, width, height: width, right: left + width, bottom: top + width, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

type Run = { keyframes: Keyframe[]; options: KeyframeAnimationOptions; onfinish?: () => void; oncancel?: () => void };
let runs: Run[] = [];

/** jsdom cannot animate: stand in for the animation the browser would run, recording what it was asked to do. */
const original = (Element.prototype as { animate?: unknown }).animate;
function fakeAnimate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  const run: Run = { keyframes, options };
  runs.push(run);
  return run as unknown as Animation;
}

/** A mascot that is on the page at `at`. */
function mascotAt(at: DOMRect) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  document.body.appendChild(el);
  el.getBoundingClientRect = () => at;
  return { el, animations: runs };
}
const copies = () => document.querySelectorAll('svg.flying');
const HEADER = rect(300, 0, 82);
const PAGE = rect(500, 200, 168);

describe('mascot flight', () => {
  beforeEach(() => { resetMascotFlight(); runs = []; vi.useFakeTimers(); (Element.prototype as { animate?: unknown }).animate = fakeAnimate; });
  afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); (Element.prototype as { animate?: unknown }).animate = original; });

  it('jumps a copy from where the mascot left to where it appears, hiding the real one until it lands', () => {
    const { el, animations } = mascotAt(PAGE);
    mascotLeft(HEADER);
    mascotAppeared(el);
    expect(copies()).toHaveLength(1);
    expect(el.style.visibility).toBe('hidden');
    expect(el).toHaveClass('in-flight');
    const copy = copies()[0] as SVGSVGElement;
    expect(copy.style.position).toBe('fixed');
    expect(copy.style.width).toBe('168px'); // drawn at the size it ends at, scaled up from the small one
    const { keyframes } = animations[0]!;
    expect(keyframes[0]!.transform).toContain('translate(300px, 0px)');
    expect(keyframes[keyframes.length - 1]!.transform).toContain('translate(500px, 200px) scale(1)');

    animations[0]!.onfinish!();
    expect(copies()).toHaveLength(0);
    expect(el.style.visibility).toBe('');
    expect(el).not.toHaveClass('in-flight');
    expect(el).toHaveClass('landed');
    vi.advanceTimersByTime(5000);
    expect(el).toHaveClass('landed'); // never taken off: that would replay its entrance, as a flicker
  });

  it('works the other way round too: the arrival is remembered until the old one leaves', () => {
    const { el, animations } = mascotAt(HEADER);
    mascotAppeared(el);
    expect(copies()).toHaveLength(0); // nothing to jump from yet
    mascotLeft(PAGE);
    expect(copies()).toHaveLength(1);
    expect(animations[0]!.keyframes[0]!.transform).toContain('translate(500px, 200px)'); // from the page, up to the header
    expect(animations[0]!.keyframes[2]!.transform).toContain('translate(300px, 0px)');
  });

  it('keeps the arc on screen even when both places are at the top', () => {
    const { el, animations } = mascotAt(PAGE);
    mascotLeft(HEADER);
    mascotAppeared(el);
    for (const frame of animations[0]!.keyframes) {
      const y = Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(String(frame.transform))![1]);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('does nothing when a leaving and an arrival are not at the same moment', () => {
    const { el } = mascotAt(PAGE);
    mascotLeft(HEADER);
    vi.advanceTimersByTime(500);
    mascotAppeared(el);
    expect(copies()).toHaveLength(0);
    expect(el.style.visibility).toBe('');
  });

  it('does nothing when it did not really move, as when the header is rebuilt on another page', () => {
    const { el } = mascotAt(HEADER);
    mascotLeft(rect(301, 1, 82));
    mascotAppeared(el);
    expect(copies()).toHaveLength(0);
  });

  it('does nothing for a reader who prefers less motion, and never hides the mascot', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { el } = mascotAt(PAGE);
    mascotLeft(HEADER);
    mascotAppeared(el);
    expect(copies()).toHaveLength(0);
    expect(el.style.visibility).toBe('');
  });

  it('does nothing where the browser cannot animate, and never hides the mascot', () => {
    const { el } = mascotAt(PAGE);
    (Element.prototype as { animate?: unknown }).animate = undefined;
    mascotLeft(HEADER);
    mascotAppeared(el);
    expect(copies()).toHaveLength(0);
    expect(el.style.visibility).toBe('');
  });

  it('lands the mascot even if the flight is cancelled', () => {
    const { el, animations } = mascotAt(PAGE);
    mascotLeft(HEADER);
    mascotAppeared(el);
    animations[0]!.oncancel!();
    expect(copies()).toHaveLength(0);
    expect(el.style.visibility).toBe('');
  });

  describe('before it jumps', () => {
    /** A mascot with the parts the real one has, so the copy has limbs to move. */
    function mascotWithLimbs(at: DOMRect) {
      const made = mascotAt(at);
      for (const name of ['m-root', 'm-leg-l', 'm-leg-r', 'm-arm-l', 'm-arm-r']) {
        const part = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        part.setAttribute('class', name);
        made.el.appendChild(part);
      }
      return made;
    }
    const transforms = (run: Run) => run.keyframes.map((frame) => String(frame.transform));

    it('waits where it was while it crouches, then makes the jump', () => {
      const { el, animations } = mascotWithLimbs(PAGE);
      mascotLeft(HEADER);
      mascotAppeared(el);
      expect(animations[0]!.options.delay).toBe(260); // the flight, held back by the crouch
      expect(animations[0]!.options.fill).toBe('both');
    });

    it('bends the legs, dips the body and throws the arms up and flailing before it goes', () => {
      const { el, animations } = mascotWithLimbs(PAGE);
      mascotLeft(HEADER);
      mascotAppeared(el);
      const crouch = animations.filter((run) => run.options.duration === 260 && !run.options.delay); // the build-up of each part
      expect(crouch).toHaveLength(5); // body, two legs, two arms
      const all = crouch.flatMap(transforms).join(' ');
      expect(all).toContain('scaleY(.72)'); // the legs shorten
      expect(all).toMatch(/rotate\(14deg\)/); // and splay out, the left one one way
      expect(all).toMatch(/rotate\(-14deg\)/); // and the right one the other
      expect(all).toContain('translateY(10px)'); // the body dips
      const arms = crouch.filter((run) => transforms(run).some((t) => /rotate\(1[2-9]\d(\.\d+)?deg\)|rotate\(-1[2-9]\d/.test(t)));
      expect(arms.length).toBe(2); // both arms flung well above the shoulders
      expect(crouch.filter((run) => run.keyframes.length > 3)).toHaveLength(2); // and each flails: several swings, not a single raise
    });

    it('keeps the limbs flailing in the air and brings every one back to rest before it lands', () => {
      const { el, animations } = mascotWithLimbs(PAGE);
      mascotLeft(HEADER);
      mascotAppeared(el);
      const air = animations.slice(1).filter((run) => run.options.delay === 260);
      expect(air.length).toBeGreaterThanOrEqual(5);
      for (const run of air) expect(String(run.keyframes[run.keyframes.length - 1]!.transform)).toMatch(/none|rotate\(0deg\)|rotate\(-0deg\)/); // ends in the normal pose
    });

    it('does not apply the air animations during the crouch, or they would cancel it', () => {
      const { el, animations } = mascotWithLimbs(PAGE);
      mascotLeft(HEADER);
      mascotAppeared(el);
      for (const run of animations.slice(1).filter((r) => r.options.delay === 260)) expect(run.options.fill).toBe('forwards'); // no backwards fill
    });

    it('skips parts a drawing does not have', () => {
      const { el, animations } = mascotAt(PAGE); // no limbs
      mascotLeft(HEADER);
      mascotAppeared(el);
      expect(animations).toHaveLength(1); // only the flight itself
    });
  });
});

