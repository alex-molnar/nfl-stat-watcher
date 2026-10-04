import type { EspnScoreboard } from '../espn/types';
import { PRESETS, copyValues } from '../scoring/presets';
import type { Profile } from '../scoring/types';
import type { FollowedEntry } from '../storage/types';

export const scoreboardFixture: EspnScoreboard = {
  events: [
    {
      id: '401872964',
      date: '2026-10-02T00:15Z',
      status: { period: 4, displayClock: '0:00', type: { state: 'post', completed: true, shortDetail: 'Final' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '27', team: { id: '5', abbreviation: 'CLE', displayName: 'Cleveland Browns', color: '472a08' } },
        { homeAway: 'away', score: '24', team: { id: '23', abbreviation: 'PIT', displayName: 'Pittsburgh Steelers', color: '000000' } },
      ] }],
    },
    {
      id: '401872975',
      date: '2026-10-04T20:25Z',
      status: { period: 0, displayClock: '0:00', type: { state: 'pre', completed: false, shortDetail: '10/4 - 4:25 PM EDT' } },
      competitions: [{ competitors: [
        { homeAway: 'home', score: '0', team: { id: '25', abbreviation: 'SF', displayName: 'San Francisco 49ers', color: 'aa0000' } },
        { homeAway: 'away', score: '0', team: { id: '7', abbreviation: 'DEN', displayName: 'Denver Broncos', color: '0a2343' } },
      ] }],
    },
  ],
};

export const profilesFixture: Profile[] = [
  { id: 'p1', name: 'Office league', preset: 'ppr', values: copyValues(PRESETS.ppr) },
  { id: 'p2', name: 'Friends league', preset: 'standard', values: copyValues(PRESETS.standard) },
];

export const warren: FollowedEntry = { kind: 'player', espnId: '4569987', name: 'Jaylen Warren', teamId: '23', teamAbbr: 'PIT', position: 'RB', jersey: '30', profileId: 'p1' };
export const pitDefense: FollowedEntry = { kind: 'defense', espnId: '23', name: 'Pittsburgh Steelers', teamId: '23', teamAbbr: 'PIT', position: 'D/ST', profileId: 'p1' };
export const mahomes: FollowedEntry = { kind: 'player', espnId: '3139477', name: 'Patrick Mahomes', teamId: '12', teamAbbr: 'KC', position: 'QB', jersey: '15', profileId: 'p2' };
