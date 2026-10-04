import { render } from '@testing-library/react';
import { LEADER_TEXT, ScoreBar, leadText, leaderOf } from './ScoreBar';

describe('lead text', () => {
  it('says who leads by how much, or that it is tied', () => {
    expect(leadText(84.2, 71.8)).toBe('You lead by 12.40');
    expect(leadText(71.8, 84.2)).toBe('Opponent leads by 12.40');
    expect(leadText(0, 0)).toBe('Tied');
  });

  it('ignores float noise below a cent', () => {
    expect(leaderOf(0.1 + 0.2, 0.3)).toEqual({ leader: 'tied', by: 0 });
    expect(leadText(0.1 + 0.2, 0.3)).toBe('Tied');
  });

  it('announces only the leader, never the margin', () => {
    expect(LEADER_TEXT).toEqual({ mine: 'You lead', opponent: 'Opponent leads', tied: 'Tied' });
  });
});

describe('score bar', () => {
  it('spells out both sides with two decimals in one element', () => {
    const { container } = render(<ScoreBar mine={84.2} opponent={71.8} />);
    const bars = container.querySelectorAll('.score-bar');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveTextContent('You 84.20 You lead by 12.40 Opponent 71.80');
    expect(bars[0]).not.toHaveAttribute('role');
  });
});
