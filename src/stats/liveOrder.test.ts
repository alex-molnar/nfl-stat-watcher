import { describe, expect, it } from 'vitest';
import type { FollowedEntry } from '../storage/types';
import { BOOST_MS, RankHolds, boostedRank, liveRank } from './liveOrder';
import type { GameInfo } from './scoreboard';
import type { GameStats } from './types';
import { DEFAULT_POSITION_ORDER } from './positionOrder';

const game = { state: 'in' } as GameInfo;
const entry = (over: Partial<FollowedEntry>): FollowedEntry => ({ kind: 'player', espnId: '1', name: 'X', teamId: '25', teamAbbr: 'SF', position: 'WR', profileId: 'p1', ...over });
const stats = (possessionTeamId: string, yardsToEndzone: number): GameStats => ({
  players: {}, defenses: {}, situation: { possessionTeamId, yardsToEndzone, downDistanceText: '', lastPlayText: '' },
});
const rank = (e: FollowedEntry, s = stats('25', 60)) => liveRank(e, game, s);

describe('liveRank', () => {
  it('has no rank until the game situation is known', () => {
    expect(liveRank(entry({}), game, undefined)).toBeNull();
    expect(liveRank(entry({}), game, { players: {}, defenses: {}, situation: null })).toBeNull();
  });

  it('puts red zone players first, then the side that has the ball, then the other side', () => {
    const inRedZone = stats('25', 12);
    expect(rank(entry({ position: 'WR' }), inRedZone)).toBeLessThan(rank(entry({ teamId: '7', kind: 'defense', position: 'D/ST' }), inRedZone)!);
    // Offense with the ball outside the red zone, and a defense stopping them, share the middle bucket.
    expect(Math.floor(rank(entry({ position: 'WR' }))! / 10)).toBe(1);
    expect(Math.floor(rank(entry({ teamId: '7', kind: 'defense', position: 'D/ST' }))! / 10)).toBe(1);
    expect(Math.floor(rank(entry({ teamId: '7', position: 'WR' }))! / 10)).toBe(2); // offense, ball is the other way
    expect(Math.floor(rank(entry({ kind: 'defense', position: 'D/ST' }))! / 10)).toBe(2); // defense while its own offense has the ball
    expect(Math.floor(rank(entry({ teamId: '7', position: 'LB' }))! / 10)).toBe(1); // IDP on the defense
  });

  it('does not count a defense with the ball in the opponent red zone as red zone', () => {
    expect(Math.floor(rank(entry({ kind: 'defense', position: 'D/ST' }), stats('25', 8))! / 10)).toBe(2);
  });

  it('orders all nine position groups separately within the same activity bucket', () => {
    const ranks = DEFAULT_POSITION_ORDER.map((position) => rank(entry({ position, kind: position === 'D/ST' ? 'defense' : 'player', teamId: ['DL', 'LB', 'DB', 'D/ST'].includes(position) ? '7' : '25' }))!);
    expect(ranks).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
    expect(rank(entry({ position: 'PK' }))).toBe(rank(entry({ position: 'K' })));
  });

  it('uses a custom position order without overriding activity or injury priority', () => {
    const order = [...DEFAULT_POSITION_ORDER].reverse();
    const custom = (e: FollowedEntry, s = stats('25', 60)) => liveRank(e, game, s, undefined, order)!;
    expect(custom(entry({ position: 'WR' }))).toBeLessThan(custom(entry({ position: 'RB' })));
    expect(custom(entry({ position: 'QB' }), stats('25', 8))).toBeLessThan(custom(entry({ kind: 'defense', position: 'D/ST', teamId: '7' }), stats('25', 8)));
    expect(custom(entry({ position: 'QB' }))).toBeLessThan(custom(entry({ position: 'WR', teamId: '7' })));
    expect(custom(entry({ position: 'QB' }))).toBeLessThan(custom(entry({ position: 'WR' }), { ...stats('25', 8), injuries: { '1': { status: 'Out' } } }));
  });

  it('puts a quarterback with the ball ahead of a running back on either side', () => {
    const sf = (position: string, teamId = '25') => rank(entry({ position, teamId }))!; // SF has the ball at midfield
    expect(sf('QB')).toBeLessThan(sf('RB', '7'));
    expect(sf('QB')).toBeLessThan(sf('RB'));
    expect(sf('K')).toBeLessThan(sf('RB', '7'));
    // A defense on the field is still ahead of any offensive player stuck on the wrong side.
    expect(rank(entry({ teamId: '7', kind: 'defense', position: 'D/ST' }))).toBeLessThan(sf('RB', '7'));
  });
});

describe('after a score', () => {
  const over = { players: {}, defenses: {}, situation: { possessionTeamId: '25', yardsToEndzone: 2, downDistanceText: '', lastPlayText: '', driveOver: true as const } };
  it('drops the scorer from red zone and from the side of the ball, and so does the defense', () => {
    for (const e of [entry({}), entry({ position: 'QB' }), entry({ teamId: '7', kind: 'defense', position: 'D/ST' }), entry({ teamId: '7', position: 'LB' })]) {
      expect(Math.floor(liveRank(e, game, over)! / 10)).toBe(2);
    }
  });
});

describe('injured players', () => {
  const withInjury = (status: string): GameStats => ({ ...stats('25', 60), injuries: { '1': { status } } });
  it('puts a player ruled out last, even in the red zone, even with the ball, even before the situation is known', () => {
    const wr = entry({ position: 'WR' });
    expect(liveRank(wr, game, { ...stats('25', 8), injuries: { '1': { status: 'Out' } } })).toBe(50);
    expect(liveRank(wr, game, withInjury('Out'))).toBeGreaterThan(liveRank(entry({ teamId: '7', position: 'RB', espnId: '2' }), game, withInjury('Out'))!);
    expect(liveRank(wr, game, { players: {}, defenses: {}, situation: null, injuries: { '1': { status: 'Out' } } })).toBe(50);
  });
  it('leaves questionable and doubtful players where the ball puts them', () => {
    const wr = entry({ position: 'WR' });
    expect(liveRank(wr, game, withInjury('Questionable'))).toBe(liveRank(wr, game, stats('25', 60)));
    expect(liveRank(wr, game, withInjury('Doubtful'))).toBe(liveRank(wr, game, stats('25', 60)));
  });
  it('never marks a team defense out', () => {
    expect(liveRank(entry({ kind: 'defense', position: 'D/ST', espnId: '1' }), game, withInjury('Out'))).toBeLessThan(50);
  });
});

describe('RankHolds', () => {
  it('keeps the rank from before the play while the hold runs, then lets the card drop', () => {
    const holds = new RankHolds();
    holds.hold('scorer', 1, 5_000, 1_000);
    expect(holds.rank('scorer', 20, 1_000)).toBe(1);
    expect(holds.rank('scorer', 20, 4_999)).toBe(1);
    expect(holds.rank('scorer', 20, 5_000)).toBe(20);
    expect(holds.rank('scorer', 22, 6_000)).toBe(22);
  });

  it('never holds a card that was not involved, which moves at once', () => {
    const holds = new RankHolds();
    holds.hold('scorer', 1, 5_000, 1_000);
    expect(holds.rank('bystander', 20, 2_000)).toBe(20);
  });

  it('keeps the original rank when a second play lands during a hold, and lasts longer', () => {
    const holds = new RankHolds();
    holds.hold('scorer', 1, 5_000, 1_000);
    holds.hold('scorer', 20, 7_000, 3_000);
    expect(holds.rank('scorer', 22, 6_000)).toBe(1);
    expect(holds.rank('scorer', 22, 7_000)).toBe(22);
  });

  it('says when the next hold ends, so the page can re-sort then', () => {
    const holds = new RankHolds();
    expect(holds.nextExpiry(0)).toBeNull();
    holds.hold('a', 1, 5_000, 0);
    holds.hold('b', 2, 3_000, 0);
    expect(holds.nextExpiry(1_000)).toBe(3_000);
    expect(holds.nextExpiry(4_000)).toBe(5_000);
    expect(holds.nextExpiry(6_000)).toBeNull();
  });
});

describe('boosts', () => {
  it('keeps boosts below the previous activity bucket even with all positions and unknown ones', () => {
    for (let position = 0; position <= 9; position++) {
      expect(boostedRank(10 + position)).toBeGreaterThan(9);
      expect(boostedRank(10 + position)).toBeLessThan(10);
      expect(boostedRank(20 + position)).toBeGreaterThan(19);
      expect(boostedRank(20 + position)).toBeLessThan(20);
    }
  });
  it('lifts a rank to the top of its own group and never into the group above', () => {
    // Groups: red zone 0-3, on the field 10-13, the rest 20-23.
    expect(boostedRank(11)).toBeLessThan(10); // a quarterback on the field passes the skill players (10)...
    expect(boostedRank(11)).toBeGreaterThan(3); // ...but stays below every red zone card
    expect(boostedRank(13)).toBeLessThan(10);
    expect(boostedRank(21)).toBeLessThan(20);
    expect(boostedRank(21)).toBeGreaterThan(13);
    expect(boostedRank(1)).toBeLessThan(0); // the top group simply lifts within itself
  });

  it('keeps the position order among boosted cards and leaves unranked and out cards alone', () => {
    expect(boostedRank(10)).toBeLessThan(boostedRank(11));
    expect(boostedRank(11)).toBeLessThan(boostedRank(13));
    expect(boostedRank(40)).toBe(40);
    expect(boostedRank(50)).toBe(50);
  });

  it('boosts for a while, extends on another play, and then lets the card settle back', () => {
    const holds = new RankHolds();
    holds.boost('qb', 10_000);
    expect(holds.rank('qb', 11, 5_000)).toBe(boostedRank(11));
    expect(holds.rank('other', 10, 5_000)).toBe(10);
    holds.boost('qb', 20_000);
    expect(holds.rank('qb', 11, 15_000)).toBe(boostedRank(11));
    expect(holds.rank('qb', 11, 20_000)).toBe(11);
  });

  it('holds first, then boosts, and reports the next time either ends', () => {
    const holds = new RankHolds();
    holds.hold('qb', 11, 4_000, 0);
    holds.boost('qb', 30_000);
    expect(holds.nextExpiry(1_000)).toBe(4_000);
    expect(holds.rank('qb', 21, 1_000)).toBe(11);
    expect(holds.rank('qb', 21, 4_000)).toBe(boostedRank(21));
    expect(holds.nextExpiry(5_000)).toBe(30_000);
    expect(BOOST_MS).toBe(30_000);
  });

  it('never lets a hold delay a card moving up, only stop it sliding down', () => {
    const holds = new RankHolds();
    holds.hold('qb', 11, 4_000, 0);
    holds.boost('qb', 30_000);
    expect(holds.rank('qb', 11, 1_000)).toBe(boostedRank(11)); // lifted straight away, not pinned at 11
    const scorer = new RankHolds();
    scorer.hold('wr', 0, 4_000, 0);
    scorer.boost('wr', 30_000);
    expect(scorer.rank('wr', 20, 1_000)).toBe(0); // a card whose rank would fall is held
    expect(scorer.rank('wr', 20, 4_000)).toBe(boostedRank(20));
  });
});
