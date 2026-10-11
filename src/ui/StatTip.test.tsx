import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatTip } from './StatTip';

describe('StatTip', () => {
  it('shows the league rules on hover, with what the stat earned last, and hides them again', async () => {
    render(<StatTip rules={'Per receiving yard: 0.1\n+2.70 pts this game'}><span>rec yds</span></StatTip>);
    const stat = screen.getByText('rec yds').parentElement!;
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(stat);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Per receiving yard: 0.1+2.70 pts this game');
    expect(tip.querySelector('.stat-tip-total')).toHaveTextContent('+2.70 pts this game');
    expect(stat).toHaveAttribute('aria-describedby', tip.id);
    await userEvent.unhover(stat);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
