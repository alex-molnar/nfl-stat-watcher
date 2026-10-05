import type { GameStats } from '../stats/types';
import type { GameInfo } from '../stats/scoreboard';
import type { NameDisplayMode } from '../storage/nameDisplay';
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
    !!s && !s.driveOver && s.possessionTeamId === entry.teamId && s.yardsToEndzone <= 20
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** White or black text, whichever has more contrast on the team color. */
export function textOn(hex: string): '#ffffff' | '#000000' {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance('#000000') + 0.05);
  return onWhite >= onDark ? '#ffffff' : '#000000';
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

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
// Lower-case words that belong to the last name: "Amon-Ra St. Brown", "Jaylen Van Dyke".
const PARTICLES = new Set(['st', 'st.', 'van', 'von', 'de', 'del', 'der', 'di', 'da', 'la', 'le']);

/** A player's name as the Name display mode wants it. Names are stored in full; defenses are team names and stay as they are. */
export function displayName(entry: Pick<FollowedEntry, 'kind' | 'name'>, mode: NameDisplayMode): string {
  if (entry.kind === 'defense' || mode === 'full') return entry.name;
  const words = entry.name.trim().split(/\s+/);
  let end = words.length;
  while (end > 1 && SUFFIXES.has(words[end - 1]!.toLowerCase())) end--;
  let start = end - 1;
  while (start > 1 && PARTICLES.has(words[start - 1]!.toLowerCase())) start--;
  if (start === 0) return entry.name; // a single word has no first name to shorten or move
  const first = words.slice(0, start).join(' ');
  const last = words.slice(start, end).concat(words.slice(end)).join(' ');
  if (mode === 'formal') return `${last}, ${first}`;
  return `${first.includes('.') ? first : `${first[0]}.`} ${last}`; // "D.J." is already initials
}
