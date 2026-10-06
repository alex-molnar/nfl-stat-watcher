// Fake players for Rookie camp's last drill, so every kind of card can be shown (playing now, still to play, final, with a highlight) at any
// time of year. They are answered here instead of by ESPN: the ids start with `camp-`, no real id does, so the client asks this module first and
// everything real still goes to ESPN. The teams and players are invented. The shapes are ESPN's own, so the app's normal parsing reads them.

import { toGames, type GameInfo } from '../stats/scoreboard';
import { campStore } from '../storage/camp';
import type { FollowedEntry } from '../storage/types';
import type { EspnAthleteResponse, EspnPlay, EspnSearchItem, EspnScoreboard, EspnStatCategory, EspnSummary, EspnTeamRef } from './types';

export const CAMP_PROFILE_ID = 'camp-league';
export const isFake = (id: string) => id.startsWith('camp-');

/** Whether the fake game cards are on: the scoreboard shows the fake games, and the camp's league holds the fake players. */
let on = false;
let startedAt = 0;
let kickoff = Date.now() + 3 * 3_600_000;
const listeners = new Set<() => void>();
export const sandboxOn = () => on;
export const subscribeSandbox = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export function setSandbox(next: boolean) {
  if (next === on) return;
  on = next;
  if (next) { startedAt = Date.now(); kickoff = startedAt + 3 * 3_600_000; }
  listeners.forEach((l) => l());
}

const team = (id: string, abbreviation: string, displayName: string, color: string): EspnTeamRef => ({ id, abbreviation, displayName, color });
const LKS = team('camp-t-lks', 'LKS', 'Lakeshore Lightning', '1d4ed8');
const MES = team('camp-t-mes', 'MES', 'Mesa Mustangs', 'b45309');
const GRZ = team('camp-t-grz', 'GRZ', 'Granite Grizzlies', '7c2d12');
const DLT = team('camp-t-dlt', 'DLT', 'Delta Dragons', '047857');
const SMT = team('camp-t-smt', 'SMT', 'Summit Stags', '6d28d9');
const PRA = team('camp-t-pra', 'PRA', 'Prairie Pumas', 'be123c');

const LIVE = 'camp-e-live';
const PRE = 'camp-e-pre';
const FINAL = 'camp-e-final';
const CLIP = 900001;

const PLAYERS = {
  live: { espnId: 'camp-live-qb', name: 'Cole Harlan', team: LKS, position: 'QB', jersey: '12', first: 'Cole', last: 'Harlan' },
  pre: { espnId: 'camp-pre-rb', name: 'Marcus Teller', team: GRZ, position: 'RB', jersey: '28', first: 'Marcus', last: 'Teller' },
  final: { espnId: 'camp-final-wr', name: 'Jalen Whitmore', team: SMT, position: 'WR', jersey: '11', first: 'Jalen', last: 'Whitmore' },
} as const;

/** The player the user adds in drill 2; the other two are in the practice league from the start. */
export const FINAL_ID = PLAYERS.final.espnId;

/**
 * Player search finds him, and only him, while the practice league is there and the camp is on its player drill: at any other time there is nothing
 * to find, so a real search for "Whitmore" shows real players only.
 */
export function fakeSearch(query: string): EspnSearchItem[] {
  const camp = campStore.get();
  if (!on || camp.phase !== 'running' || camp.step !== 1 || !/whitmore/i.test(query)) return [];
  return [{ id: FINAL_ID, displayName: PLAYERS.final.name, league: 'nfl' }];
}

/** The three followed entries, for the camp's league. */
export const campEntries = (): FollowedEntry[] =>
  Object.values(PLAYERS).map((p) => ({
    kind: 'player', espnId: p.espnId, name: p.name, teamId: p.team.id, teamAbbr: p.team.abbreviation, position: p.position, jersey: p.jersey, profileId: CAMP_PROFILE_ID,
  }));

const competitor = (t: EspnTeamRef, homeAway: 'home' | 'away', score?: number) => ({ homeAway, team: t, ...(score === undefined ? {} : { score: String(score) }) });

function scoreboard(): EspnScoreboard {
  const event = (id: string, date: string, state: 'pre' | 'in' | 'post', period: number, clock: string, detail: string, home: [EspnTeamRef, number], away: [EspnTeamRef, number]) => ({
    id,
    date,
    status: { period, displayClock: clock, type: { state, completed: state === 'post', shortDetail: detail } },
    competitions: [{ competitors: [competitor(home[0], 'home', home[1]), competitor(away[0], 'away', away[1])] }],
  });
  const now = new Date(startedAt - 3_600_000).toISOString(); // fixed while the sandbox is on, so the schedule stays equal between renders
  return {
    events: [
      event(LIVE, now, 'in', 3, '8:42', '8:42 - 3rd', [LKS, 17], [MES, 14]),
      event(PRE, new Date(kickoff).toISOString(), 'pre', 0, '0:00', 'Upcoming', [GRZ, 0], [DLT, 0]),
      event(FINAL, new Date(startedAt - 3 * 3_600_000).toISOString(), 'post', 4, '0:00', 'Final', [SMT, 27], [PRA, 20]),
    ],
  };
}

/** The fake games, to put beside the real scoreboard while the sandbox is on. */
export const fakeGames = (): GameInfo[] => toGames(scoreboard());

const header = (id: string, home: EspnTeamRef, away: EspnTeamRef, homeScore?: number, awayScore?: number) => ({
  id,
  competitions: [{ competitors: [competitor(home, 'home', homeScore), competitor(away, 'away', awayScore)] }],
});

// The live game moves on every ten seconds the sandbox has been on, from a pass in midfield to a touchdown, then stays there.
const STEP_MS = 10_000;
const PLAYS: { text: string; type: string; yardsToEndzone: number; down: string; scoring?: boolean }[] = [
  { text: 'C.Harlan pass short left to T.Briggs for 5 yards (J.Okoro)', type: 'Pass Reception', yardsToEndzone: 38, down: '2nd & 7 at MES 38' },
  { text: 'C.Harlan pass short middle to R.Vance for 15 yards (D.Lund)', type: 'Pass Reception', yardsToEndzone: 33, down: '3rd & 2 at MES 33' },
  { text: 'A.Pryor left end for 4 yards (D.Lund)', type: 'Rush', yardsToEndzone: 18, down: '1st & 10 at MES 18' },
  { text: 'C.Harlan pass short right to T.Briggs for 8 yards (J.Okoro)', type: 'Pass Reception', yardsToEndzone: 14, down: '2nd & 6 at MES 14' },
  { text: 'C.Harlan pass short right to T.Briggs for 6 yards, TOUCHDOWN', type: 'Passing Touchdown', yardsToEndzone: 6, down: '1st & Goal at MES 6', scoring: true },
];
const HARLAN = [
  { att: '14/21', yards: 178, tds: 1 },
  { att: '15/22', yards: 193, tds: 1 },
  { att: '15/22', yards: 193, tds: 1 },
  { att: '16/23', yards: 201, tds: 1 },
  { att: '17/24', yards: 207, tds: 2 },
];

const category = (name: string, keys: string[], athletes: EspnStatCategory['athletes']): EspnStatCategory => ({ name, keys, athletes });
const athleteRef = (p: (typeof PLAYERS)[keyof typeof PLAYERS]) => ({ id: p.espnId, displayName: p.name, firstName: p.first, lastName: p.last, jersey: p.jersey });

function liveSummary(): EspnSummary {
  const step = Math.min(PLAYS.length - 1, Math.floor((Date.now() - startedAt) / STEP_MS));
  const q = HARLAN[step]!;
  const plays: EspnPlay[] = PLAYS.slice(0, step + 1).map((p, i) => ({
    id: `camp-play-${i}`,
    text: p.text,
    type: { text: p.type },
    ...(p.scoring ? { scoringPlay: true } : {}),
    start: { team: { id: LKS.id }, yardsToEndzone: p.yardsToEndzone, downDistanceText: p.down },
  }));
  return {
    header: header(LIVE, LKS, MES, step === PLAYS.length - 1 ? 24 : 17, 14),
    boxscore: {
      players: [{
        team: { id: LKS.id, abbreviation: LKS.abbreviation },
        statistics: [category('passing', ['completions/passingAttempts', 'passingYards', 'passingTouchdowns', 'interceptions', 'sacks-sackYardsLost'], [
          { athlete: athleteRef(PLAYERS.live), stats: [q.att, String(q.yards), String(q.tds), '0', '1-7'] },
        ])],
      }],
    },
    drives: { current: { plays } },
  };
}

function preSummary(): EspnSummary {
  return { header: header(PRE, GRZ, DLT), boxscore: { players: [] } };
}

function finalSummary(): EspnSummary {
  return {
    header: header(FINAL, SMT, PRA, 27, 20),
    boxscore: {
      players: [{
        team: { id: SMT.id, abbreviation: SMT.abbreviation },
        statistics: [category('receiving', ['receptions', 'receivingYards', 'yardsPerReception', 'receivingTouchdowns', 'longReception', 'receivingTargets'], [
          { athlete: athleteRef(PLAYERS.final), stats: ['7', '112', '16.0', '1', '38', '9'] },
        ])],
      }],
    },
    videos: [{
      id: CLIP,
      headline: 'Whitmore hauls in a 38-yard touchdown',
      originalPublishDate: new Date(startedAt - 2 * 3_600_000).toISOString(),
      duration: 4,
      links: { source: { href: `${location.origin}/camp-clip.mp4` } }, // a small clip that ships with the app
    }],
  };
}

export function fakeSummary(eventId: string): EspnSummary | null {
  if (eventId === LIVE) return liveSummary();
  if (eventId === PRE) return preSummary();
  if (eventId === FINAL) return finalSummary();
  return null;
}

export function fakeAthlete(id: string): EspnAthleteResponse | null {
  const p = Object.values(PLAYERS).find((x) => x.espnId === id);
  return p ? { athlete: { id: p.espnId, displayName: p.name, jersey: p.jersey, position: { abbreviation: p.position }, team: { id: p.team.id, abbreviation: p.team.abbreviation } } } : null;
}

/** Who a clip is tagged with. */
export const fakeClipAthletes = (clipId: string): string[] | null => (clipId === String(CLIP) ? [PLAYERS.final.espnId] : null);
