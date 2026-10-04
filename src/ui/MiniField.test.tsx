import { render, screen } from '@testing-library/react';
import type { GameInfo } from '../stats/scoreboard';
import { MiniField } from './MiniField';

const game = {
  home: { id: '12', abbr: 'KC', color: '#E31837', score: 7 },
  away: { id: '4', abbr: 'CIN', color: '#FB4F14', score: 3 },
} as GameInfo;
const situation = (yardsToEndzone: number) => ({ possessionTeamId: '12', yardsToEndzone, downDistanceText: '2nd & 6 at CIN 25', lastPlayText: '' });

describe('MiniField', () => {
  it('names the team with the ball and the distance, without repeating the down text', () => {
    render(<MiniField game={game} situation={situation(25)} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('KC has the ball, 25 yards from the end zone');
  });

  it('uses the singular for one yard', () => {
    render(<MiniField game={game} situation={situation(1)} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('KC has the ball, 1 yard from the end zone');
  });
});
