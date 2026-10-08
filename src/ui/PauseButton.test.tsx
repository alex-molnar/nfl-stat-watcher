import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../test/render';

describe('the live updates button', () => {
  it('is icons only: live it glows, turns its arrows and offers Pause; paused it is still and offers Play', async () => {
    renderAt('/');
    const live = screen.getByRole('button', { name: 'Pause live updates' });
    expect(live).toHaveClass('is-live');
    expect(live).toHaveAttribute('aria-pressed', 'false');
    expect(live).toHaveTextContent(''); // no words, the name is the label
    expect(live.querySelector('.live-refresh')).not.toBeNull();
    expect(live.querySelector('.live-state path')).toHaveAttribute('d', expect.stringContaining('M7 4h3.5')); // two bars
    await userEvent.click(live);
    const paused = screen.getByRole('button', { name: 'Resume live updates' });
    expect(paused).not.toHaveClass('is-live');
    expect(paused).toHaveAttribute('aria-pressed', 'true');
    expect(paused.querySelector('.live-state path')).toHaveAttribute('d', expect.stringContaining('M7 4.5v15')); // a triangle
    await userEvent.click(paused);
    expect(screen.getByRole('button', { name: 'Pause live updates' })).toHaveClass('is-live');
  });
});
