import { render, screen } from '@testing-library/react';
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
});
