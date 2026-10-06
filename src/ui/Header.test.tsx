import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { Header } from './Header';
import { MascotSays } from './Mascot';

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('header mascot', () => {
  it('has no icon at the left, and the mascot to the right of the title', () => {
    const { container } = inRouter(<Header />);
    const brand = container.querySelector('.brand')!;
    expect(brand.querySelector('.brand-ball')).toBeNull();
    expect(brand.firstChild?.textContent).toBe('Stat Watch'); // the title comes first
    expect(brand.querySelector('.mascot')).not.toBeNull(); // then the mascot
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stat Watch');
  });

  it('makes no entrance of its own: the header is rebuilt on every page', () => {
    const { container } = inRouter(<Header />);
    expect(container.querySelector('.brand .mascot')).toHaveClass('no-entrance');
  });

  it('steps aside while the page shows a mascot of its own, and comes back after', () => {
    const { container, rerender } = inRouter(<><Header /><MascotSays text="Add a league first." /></>);
    expect(container.querySelector('.brand .mascot')).toBeNull();
    expect(container.querySelector('.mascot-says .mascot')).not.toBeNull();
    rerender(<MemoryRouter><Header /></MemoryRouter>);
    expect(container.querySelector('.brand .mascot')).not.toBeNull();
  });

  describe('on a wide screen', () => {
    beforeEach(() => vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('1000px'), addEventListener: () => {}, removeEventListener: () => {} })));
    afterEach(() => vi.unstubAllGlobals());

    it('sits on the header\'s bottom edge with its legs hanging over it, bigger than beside the title', () => {
      const { container } = inRouter(<Header />);
      const seat = container.querySelector('.brand-seat') as HTMLElement;
      expect(seat).toHaveClass('is-seated');
      const mascot = seat.querySelector('.mascot')!;
      expect(mascot).toHaveClass('seated');
      expect(Number(mascot.getAttribute('width'))).toBeGreaterThan(52);
      expect(seat.style.getPropertyValue('--hang')).toMatch(/^\d+(\.\d+)?px$/); // how far below the edge the drawing reaches
    });

    it('draws longer legs and no shadow on the ground when seated', () => {
      const { container } = inRouter(<Header />);
      expect(container.querySelector('.brand .mascot ellipse.detail')).toBeNull();
    });
  });

  it('stands beside the title, at its small size, on a narrower screen', () => {
    const { container } = inRouter(<Header />);
    expect(container.querySelector('.brand-seat')).not.toHaveClass('is-seated');
    expect(container.querySelector('.brand .mascot')).not.toHaveClass('seated');
    expect(container.querySelector('.brand .mascot')).toHaveAttribute('width', '52');
  });
});
