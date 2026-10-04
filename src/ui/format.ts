import type { GameStats } from '../stats/types';
import type { GameInfo } from '../stats/scoreboard';
import type { FollowedEntry } from '../storage/types';

export type StatItem = { value: string; label: string };

const OFFENSE = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'PK']);
export const isOffense = (position: string) => OFFENSE.has(position);

const items = (pairs: [number | string, string][]): StatItem[] => pairs.map(([v, label]) => ({ value: String(v), label }));

export function statLine(entry: FollowedEntry, game: GameStats | undefined): StatItem[] {
  if (!game) return [];
  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    return d ? items([[d.sacks, 'sacks'], [d.interceptions, 'INT'], [d.fumbleRecoveries, 'fum rec'], [d.pointsAllowed, 'pts allowed']]) : [];
  }
  const s = game.players[entry.espnId];
  if (!s) return [];
  const rec = s.receiving ?? { receptions: 0, targets: 0, yards: 0, touchdowns: 0 };
  const rush = s.rushing ?? { attempts: 0, yards: 0, touchdowns: 0 };
  switch (entry.position) {
    case 'QB': {
      const p = s.passing ?? { completions: 0, attempts: 0, yards: 0, touchdowns: 0, interceptions: 0 };
      return items([[`${p.completions}/${p.attempts}`, 'comp'], [p.yards, 'pass yds'], [p.touchdowns, 'pass TD'], [p.interceptions, 'INT'], [rush.yards, 'rush yds']]);
    }
    case 'RB':
    case 'FB':
      return items([[rush.attempts, 'carries'], [rush.yards, 'rush yds'], [rec.receptions, 'catches'], [rec.yards, 'rec yds'], [rush.touchdowns + rec.touchdowns, 'TD']]);
    case 'WR':
    case 'TE':
      return items([[`${rec.receptions}/${rec.targets}`, 'catches'], [rec.yards, 'rec yds'], [rec.touchdowns, 'TD']]);
    case 'K':
    case 'PK': {
      const k = s.kicking ?? { fgMade: 0, fgAttempts: 0, longest: 0, xpMade: 0, xpAttempts: 0, madeDistances: [] };
      return items([[`${k.fgMade}/${k.fgAttempts}`, 'FG'], [k.longest, 'long'], [`${k.xpMade}/${k.xpAttempts}`, 'XP']]);
    }
    default: {
      const d = s.defense ?? { totalTackles: 0, soloTackles: 0, sacks: 0, tacklesForLoss: 0, passesDefended: 0, qbHits: 0, touchdowns: 0 };
      return items([[d.totalTackles, 'tackles'], [d.sacks, 'sacks'], [d.tacklesForLoss, 'TFL'], [d.passesDefended, 'PD'], [s.interceptions?.interceptions ?? 0, 'INT']]);
    }
  }
}

export function isRedZone(entry: FollowedEntry, game: GameInfo | null, stats: GameStats | undefined): boolean {
  const s = stats?.situation;
  return (
    entry.kind === 'player' && isOffense(entry.position) && game?.state === 'in' &&
    !!s && s.possessionTeamId === entry.teamId && s.yardsToEndzone <= 20
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** White or near-black text, whichever has more contrast on the team color. */
export function textOn(hex: string): '#ffffff' | '#111111' {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance('#111111') + 0.05);
  return onWhite >= onDark ? '#ffffff' : '#111111';
}

export function resultText(game: GameInfo, teamId: string): string {
  const home = game.home.id === teamId;
  const us = home ? game.home : game.away;
  const them = home ? game.away : game.home;
  const verb = us.score > them.score ? 'Won' : us.score < them.score ? 'Lost' : 'Tied';
  return `${verb} ${us.score}-${them.score} ${home ? 'vs' : 'at'} ${them.abbr}`;
}

export const kickoffText = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
