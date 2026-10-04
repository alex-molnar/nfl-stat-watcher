import { describe, expect, it } from 'vitest';
import type { FollowedEntry } from '../storage/types';
import { liveRank } from './liveOrder';
import type { GameInfo } from './scoreboard';
import type { GameStats } from './types';

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

  it('orders a bucket by skill players, then quarterbacks, then kickers, then defenses and IDP', () => {
    const order = ['RB', 'WR', 'TE', 'QB', 'K', 'LB'].map((position) => rank(entry({ position, teamId: position === 'LB' ? '7' : '25' }))!);
    expect(order[0]).toBe(order[1]);
    expect(order[1]).toBe(order[2]);
    expect(order[2]).toBeLessThan(order[3]!);
    expect(order[3]).toBeLessThan(order[4]!);
    expect(order[4]).toBeLessThan(order[5]!);
    expect(rank(entry({ position: 'PK' }))).toBe(rank(entry({ position: 'K' })));
  });

  it('puts a quarterback with the ball ahead of a running back whose defense is on the field, and a skill player ahead of a quarterback on the field', () => {
    const sf = (position: string, teamId = '25') => rank(entry({ position, teamId }))!; // SF has the ball at midfield
    expect(sf('QB')).toBeLessThan(sf('RB', '7'));
    expect(sf('RB')).toBeLessThan(sf('QB'));
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
