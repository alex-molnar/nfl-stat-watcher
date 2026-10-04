import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Stat Watch' })).toBeInTheDocument();
});
