import { CAMP_PROFILE_ID, campEntries, fakeAthlete, fakeClipAthletes, fakeGames, fakeSummary, isFake, setSandbox } from './campSandbox';
import { getAthlete, getClipAthletes, getSummary } from './client';
import { normalizeSummary } from '../stats/normalize';
import { scoreEntry } from '../scoring/score';
import { PRESETS } from '../scoring/presets';

afterEach(() => setSandbox(false));

describe('the practice players of Rookie camp', () => {
  it('are one player per card state: playing now, still to play, final', () => {
    setSandbox(true);
    expect(fakeGames().map((g) => g.state).sort()).toEqual(['in', 'post', 'pre']);
    const [live, pre, final] = campEntries();
    expect([live!.position, pre!.position, final!.position]).toEqual(['QB', 'RB', 'WR']);
    expect(campEntries().every((e) => e.profileId === CAMP_PROFILE_ID && isFake(e.espnId) && isFake(e.teamId))).toBe(true);
    const games = fakeGames();
    expect(games.find((g) => g.eventId === 'camp-e-live')!.home.id).toBe(live!.teamId);
    expect(games.find((g) => g.eventId === 'camp-e-pre')!.home.id).toBe(pre!.teamId);
    expect(games.find((g) => g.eventId === 'camp-e-final')!.home.id).toBe(final!.teamId);
  });

  it('read like real games: the app’s own parsing finds their stats, a live situation and a highlight tagged with the final game’s player', () => {
    setSandbox(true);
    const [live, , final] = campEntries();
    const liveStats = normalizeSummary(fakeSummary('camp-e-live')!);
    expect(liveStats.players[live!.espnId]!.passing).toMatchObject({ completions: 14, attempts: 21, yards: 178, touchdowns: 1 });
    expect(liveStats.situation).toMatchObject({ possessionTeamId: live!.teamId, yardsToEndzone: 38 });
    expect(scoreEntry(live!, liveStats, PRESETS.ppr).total).toBeGreaterThan(0);

    const finalStats = normalizeSummary(fakeSummary('camp-e-final')!);
    expect(finalStats.players[final!.espnId]!.receiving).toMatchObject({ receptions: 7, yards: 112, touchdowns: 1 });
    const clips = finalStats.highlights ?? [];
    expect(clips).toHaveLength(1);
    expect(clips[0]!.mp4).toBe(`${location.origin}/camp-clip.mp4`); // a clip of this site's own is kept, not only https ones
    expect(fakeClipAthletes(clips[0]!.id)).toEqual([final!.espnId]);

    expect(normalizeSummary(fakeSummary('camp-e-pre')!).highlights ?? []).toEqual([]);
  });

  it('move on while the sandbox is on: the live game gets closer to the end zone, and ends in a touchdown', () => {
    vi.useFakeTimers();
    try {
      setSandbox(true);
      const yards = () => normalizeSummary(fakeSummary('camp-e-live')!).situation!.yardsToEndzone;
      expect(yards()).toBe(38);
      vi.advanceTimersByTime(40_000);
      const done = normalizeSummary(fakeSummary('camp-e-live')!);
      expect(done.situation!.driveOver).toBe(true); // the touchdown ended the drive
      vi.advanceTimersByTime(60_000);
      expect(normalizeSummary(fakeSummary('camp-e-live')!).players['camp-live-qb']!.passing!.touchdowns).toBe(2); // and it stays there
    } finally {
      vi.useRealTimers();
    }
  });

  it('are answered here, and a real id is not: the client asks ESPN for everything else', async () => {
    const fetched = vi.fn(async () => new Response(JSON.stringify({ athlete: { id: '1', displayName: 'Real Person' }, videos: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetched);
    expect((await getAthlete('camp-live-qb')).athlete.displayName).toBe('Cole Harlan');
    expect(fakeAthlete('4040715')).toBeNull();
    expect(await getClipAthletes('900001')).toEqual(['camp-final-wr']);
    expect(fetched).not.toHaveBeenCalled();
    await getAthlete('4040715');
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(fakeSummary('401772345')).toBeNull();
    await getSummary('camp-e-pre');
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});
