import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import { MascotSays } from './Mascot';

const flight = vi.hoisted(() => {
  const state = { flying: false, watchers: new Set<() => void>() };
  return {
    state,
    set(value: boolean) { state.flying = value; state.watchers.forEach((notify) => notify()); },
  };
});
vi.mock('./mascotFlight', () => ({
  mascotAppeared: vi.fn(),
  mascotLeft: vi.fn(),
  resetMascotFlight: vi.fn(),
  isMascotFlying: () => flight.state.flying,
  subscribeMascotFlight: (notify: () => void) => { flight.state.watchers.add(notify); return () => void flight.state.watchers.delete(notify); },
}));

const typed = (c: HTMLElement) => c.querySelector('.typed-live')!.textContent;
const bubble = (c: HTMLElement) => c.querySelector('.bubble')!;

describe('the bubble waits for the mascot to jump into place', () => {
  beforeEach(() => { flight.set(false); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is not shown, and says nothing, while the mascot is in the air', () => {
    flight.set(true);
    const { container } = render(<MascotSays text="Add a league first." />);
    expect(bubble(container)).toHaveClass('waiting');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(typed(container)).toBe(''); // nothing typed however long the jump takes
  });

  it('appears when the mascot lands, and starts talking a moment after', () => {
    flight.set(true);
    const { container } = render(<MascotSays text="Add a league first." />);
    act(() => { flight.set(false); });
    expect(bubble(container)).not.toHaveClass('waiting');
    expect(typed(container)).toBe(''); // a moment of calm first
    act(() => { vi.advanceTimersByTime(60); });
    expect(typed(container)).toBe('');
    act(() => { vi.advanceTimersByTime(1500); });
    expect(typed(container)).toBe('Add a league first.');
  });

  it('stops and starts over if a jump begins after the talking has started', () => {
    const { container } = render(<MascotSays text="Add a league first." />);
    act(() => { vi.advanceTimersByTime(700); });
    expect(typed(container)!.length).toBeGreaterThan(0);
    act(() => { flight.set(true); }); // the old mascot leaves just after this one appeared
    expect(typed(container)).toBe('');
    expect(bubble(container)).toHaveClass('waiting');
    act(() => { flight.set(false); });
    act(() => { vi.advanceTimersByTime(1700); });
    expect(typed(container)).toBe('Add a league first.');
  });

  it('is there and talking as usual when no jump is happening', () => {
    const { container } = render(<MascotSays text="Add a league first." />);
    expect(bubble(container)).not.toHaveClass('waiting');
    act(() => { vi.advanceTimersByTime(2200); });
    expect(typed(container)).toBe('Add a league first.');
  });
});
