import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Mascot, MascotSays } from './Mascot';

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

describe('MascotSays', () => {
  it('puts the mascot beside a bubble whose text is real, readable text', () => {
    const { container } = render(<MascotSays><p>Add a scoring league first.</p></MascotSays>);
    expect(container.querySelector('.mascot')).not.toBeNull();
    expect(screen.getByText('Add a scoring league first.').closest('.bubble')).not.toBeNull();
  });
});
