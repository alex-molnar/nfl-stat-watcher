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
    vi.advanceTimersByTime(700);
    expect(el).not.toHaveClass('landed');
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
});
