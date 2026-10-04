import type { EspnCompetitor, EspnScoreboard } from '../espn/types';

export interface TeamSide { id: string; abbr: string; color: string; score: number }

export interface GameInfo {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  period: number;
  clock: string;
  kickoff: string; // ISO date
  home: TeamSide;
  away: TeamSide;
}

const side = (c: EspnCompetitor): TeamSide => ({
  id: c.team.id,
  abbr: c.team.abbreviation,
  color: /^[0-9a-f]{6}$/i.test(c.team.color ?? '') ? `#${c.team.color}` : '#555555',
  score: Number(c.score ?? 0) || 0,
});

export function toGames(sb: EspnScoreboard): GameInfo[] {
  return sb.events.flatMap((e) => {
    const comps = e.competitions[0]?.competitors ?? [];
    const home = comps.find((c) => c.homeAway === 'home');
    const away = comps.find((c) => c.homeAway === 'away');
    if (!home || !away) return [];
    return [{
      eventId: e.id,
      state: e.status.type.state,
      period: e.status.period,
      clock: e.status.displayClock,
      kickoff: e.date,
      home: side(home),
      away: side(away),
    }];
  });
}

export function gameForTeam(games: GameInfo[], teamId: string): GameInfo | null {
  return games.find((g) => g.home.id === teamId || g.away.id === teamId) ?? null;
}
