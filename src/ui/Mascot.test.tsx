import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Mascot, MascotSays } from './Mascot';
import { TypedText } from './TypedText';
import * as flight from './mascotFlight';

vi.mock('./mascotFlight', () => ({ mascotAppeared: vi.fn(), mascotLeft: vi.fn(), resetMascotFlight: vi.fn(), isMascotFlying: () => false, subscribeMascotFlight: () => () => {} }));

describe('Mascot', () => {
  it('is decorative: hidden from assistive technology', () => {
    const { container } = render(<Mascot />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('mascot');
  });

  it('draws at the size it is asked for', () => {
    const { container } = render(<Mascot size={96} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '96');
  });

  it('exposes the parts that move, so motion can be added without redrawing it', () => {
    const { container } = render(<Mascot />);
    for (const hook of ['.m-root', '.m-look', '.m-glance', '.m-lid', '.m-pupil', '.m-brow', '.m-leg-l', '.m-leg-r', '.m-arm-l', '.m-arm-r']) {
      expect(container.querySelector(hook), hook).not.toBeNull();
    }
  });

  it('gives every instance its own gradient and clip ids', () => {
    const { container } = render(<><Mascot /><Mascot /></>);
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !id.includes(':'))).toBe(true);
  });

  it('looks towards the pointer, and not at all when the reader prefers less motion', () => {
    const { container } = render(<Mascot size={200} />);
    const svg = container.querySelector('svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { fireEvent.pointerMove(window, { clientX: 700, clientY: 100 }); }); // far to the right, level with the eyes
    expect(Number(svg.style.getPropertyValue('--lx'))).toBeGreaterThan(5);
    expect(Math.abs(Number(svg.style.getPropertyValue('--ly')))).toBeLessThan(1);

    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const calmer = render(<Mascot size={200} />).container.querySelector('svg')!;
    vi.spyOn(calmer, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { fireEvent.pointerMove(window, { clientX: 0, clientY: 600 }); });
    expect(calmer.style.getPropertyValue('--lx')).toBe('');
  });
});

describe('Mascot pointing', () => {
  it('points the arm at the menu on that side and keeps its eyes there instead of following the pointer', () => {
    const { container } = render(<Mascot pointAt="left" size={200} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveClass('pointing-left');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { fireEvent.pointerMove(window, { clientX: 700, clientY: 100 }); });
    expect(svg.style.getPropertyValue('--lx')).toBe('');
  });

  it('does not point unless asked', () => {
    expect(render(<Mascot />).container.querySelector('svg')).not.toHaveClass('pointing-left');
  });
});

describe('MascotSays', () => {
  it('puts the mascot beside a bubble whose text is real, readable text', () => {
    const { container } = render(<MascotSays text="Add a scoring league first."><button type="button">Go</button></MascotSays>);
    expect(container.querySelector('.mascot')).not.toBeNull();
    expect(container.querySelector('.bubble')).toHaveTextContent('Add a scoring league first.');
    expect(screen.getByRole('button', { name: 'Go' }).closest('.bubble')).not.toBeNull();
  });
});

describe('TypedText', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const typed = (c: HTMLElement) => c.querySelector('.typed-live')!.textContent;

  it('types the text out letter by letter, ending with all of it', () => {
    vi.useFakeTimers();
    const { container } = render(<TypedText text="Add a league first." />);
    expect(typed(container)).toBe('');
    act(() => { vi.advanceTimersByTime(200); });
    const part = typed(container)!;
    expect(part.length).toBeGreaterThan(0);
    expect(part.length).toBeLessThan('Add a league first.'.length);
    expect('Add a league first.'.startsWith(part)).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(typed(container)).toBe('Add a league first.');
  });

  it('gives assistive technology the whole sentence at once, and hides the typed copy', () => {
    vi.useFakeTimers();
    const { container } = render(<TypedText text="Hello there" />);
    expect(container.querySelector('.sr')).toHaveTextContent('Hello there');
    expect(container.querySelector('.typed')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps room for the whole text from the first moment', () => {
    vi.useFakeTimers();
    const { container } = render(<TypedText text="Hello there" />);
    expect(container.querySelector('.typed-ghost')).toHaveTextContent('Hello there');
  });

  it('never makes the reader wait more than about a second and a half, however long the text', () => {
    vi.useFakeTimers();
    const long = 'word '.repeat(60).trim();
    const { container } = render(<TypedText text={long} />);
    act(() => { vi.advanceTimersByTime(1700); });
    expect(typed(container)).toBe(long);
  });

  it('stays silent while held, and starts a moment after it is let go', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TypedText text="Hello there" hold />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(typed(container)).toBe('');
    rerender(<TypedText text="Hello there" hold={false} />);
    act(() => { vi.advanceTimersByTime(60); });
    expect(typed(container)).toBe('');
    act(() => { vi.advanceTimersByTime(1500); });
    expect(typed(container)).toBe('Hello there');
  });

  it('starts again when the text changes', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TypedText text="First" />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(typed(container)).toBe('First');
    rerender(<TypedText text="Second text" />);
    expect(typed(container)).toBe('');
    act(() => { vi.advanceTimersByTime(1500); });
    expect(typed(container)).toBe('Second text');
  });

  it('waits for its delay before the first text only, a replacement starts at once', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<TypedText text="Hello" delay={500} />);
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<TypedText text="Another text" delay={500} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(typed(container)!.length).toBeGreaterThan(0);
  });

  it('waits for its delay before the first letter', () => {
    vi.useFakeTimers();
    const { container } = render(<TypedText text="Hello" delay={500} />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(typed(container)).toBe('');
    act(() => { vi.advanceTimersByTime(600); });
    expect(typed(container)).toBe('Hello');
  });

  it('just shows the text when the reader prefers less motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container } = render(<TypedText text="Hello there" />);
    expect(typed(container)).toBe('Hello there');
  });
});

describe('where the mascot says it left from', () => {
  const box = (top: number) => ({ left: 300, top, width: 168, height: 168, right: 468, bottom: top + 168, x: 300, y: top, toJSON: () => ({}) }) as DOMRect;

  it('is where it last was, not where it is by the time it is removed, when the rest of the page has already gone', () => {
    vi.mocked(flight.mascotLeft).mockClear();
    const { container, unmount } = render(<Mascot size={168} />);
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () => box(130); // on screen, with the old page's header above it
    act(() => { fireEvent.resize(window); }); // it notices that it is there
    svg.getBoundingClientRect = () => box(64); // as React removes the old header first, everything shifts up
    unmount();
    expect(flight.mascotLeft).toHaveBeenCalledTimes(1);
    expect(vi.mocked(flight.mascotLeft).mock.calls[0]![0]!.top).toBe(130);
  });

  it('follows the page when it scrolls', () => {
    vi.mocked(flight.mascotLeft).mockClear();
    const { container, unmount } = render(<Mascot size={168} />);
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () => box(80);
    act(() => { fireEvent.scroll(window); });
    unmount();
    expect(vi.mocked(flight.mascotLeft).mock.calls[0]![0]!.top).toBe(80);
  });

  it('reports its place as it appears too', () => {
    vi.mocked(flight.mascotAppeared).mockClear();
    const { container } = render(<Mascot />);
    expect(flight.mascotAppeared).toHaveBeenCalledWith(container.querySelector('svg'));
  });
});

