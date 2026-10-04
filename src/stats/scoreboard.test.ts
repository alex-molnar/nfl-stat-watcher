import type { EspnScoreboard } from '../espn/types';
import { gameForTeam, toGames } from './scoreboard';

const sb: EspnScoreboard = {
  events: [
    {
      id: '401872975',
      date: '2026-10-04T20:25Z',
      status: { period: 2, displayClock: '6:41', type: { state: 'in', completed: false, shortDetail: '6:41 - 2nd' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '10', team: { id: '25', abbreviation: 'SF', displayName: 'San Francisco 49ers', color: 'aa0000' } },
        { homeAway: 'away', score: '3', team: { id: '7', abbreviation: 'DEN', displayName: 'Denver Broncos' } },
      ] }],
    },
    { id: 'broken', date: '2026-10-04T20:25Z', status: { period: 0, displayClock: '0:00', type: { state: 'pre', completed: false, shortDetail: '' } }, competitions: [] },
  ],
};

describe('toGames', () => {
  it('maps events to games and skips events without two competitors', () => {
    expect(toGames(sb)).toEqual([{
      eventId: '401872975', state: 'in', period: 2, clock: '6:41', kickoff: '2026-10-04T20:25Z',
      home: { id: '25', abbr: 'SF', color: '#aa0000', score: 10 },
      away: { id: '7', abbr: 'DEN', color: '#555555', score: 3 },
    }]);
  });
});

describe('gameForTeam', () => {
  it('finds a game by home or away team, or null for a bye', () => {
    const games = toGames(sb);
    expect(gameForTeam(games, '7')?.eventId).toBe('401872975');
    expect(gameForTeam(games, '25')?.eventId).toBe('401872975');
    expect(gameForTeam(games, '12')).toBeNull();
  });
});
