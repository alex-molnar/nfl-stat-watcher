import type { Injury } from './types';

export type InjuryTone = 'out' | 'doubtful' | 'questionable' | 'other';

/** Designations that mean the player will not play: out, injured reserve, suspended and similar. */
const OUT = /^(out|injured reserve|ir\b|suspen|pup|nfi|reserve)/i;

export const isOut = (injury: Injury | undefined): boolean => !!injury && OUT.test(injury.status.trim());

export function injuryTone(injury: Injury): InjuryTone {
  if (isOut(injury)) return 'out';
  if (/^doubtful/i.test(injury.status)) return 'doubtful';
  if (/^(questionable|day)/i.test(injury.status)) return 'questionable';
  return 'other';
}

/** "Out", or "Questionable · Hamstring" when ESPN names the injury. */
export const injuryLabel = (injury: Injury): string => (injury.type ? `${injury.status} · ${injury.type}` : injury.status);

const ATHLETE_ID = /\/id\/(\d+)\//;

/**
 * ESPN's league-wide injury report, keyed by athlete id. Unlike the per-game report, which lists only five players per
 * team, it is complete. "Active" entries are healthy players and are left out. The athlete id is only present in the
 * player card link.
 */
export function parseLeagueInjuries(json: unknown): Record<string, Injury> {
  const injuries: Record<string, Injury> = {};
  const teams = (json as { injuries?: { injuries?: unknown[] }[] } | null)?.injuries;
  if (!Array.isArray(teams)) return injuries;
  for (const team of teams) {
    for (const raw of team?.injuries ?? []) {
      const item = raw as { status?: unknown; athlete?: { links?: { rel?: string[]; href?: string }[] }; details?: { type?: string; returnDate?: string } };
      const status = typeof item.status === 'string' ? item.status.trim().slice(0, 40) : '';
      if (!status || /^active$/i.test(status)) continue;
      const card = item.athlete?.links?.find((link) => link.rel?.includes('playercard'));
      const id = card?.href ? ATHLETE_ID.exec(card.href)?.[1] : undefined;
      if (!id) continue;
      const type = item.details?.type?.trim();
      injuries[id] = {
        status,
        ...(type && !/^not specified$/i.test(type) ? { type: type.slice(0, 40) } : {}),
        ...(item.details?.returnDate ? { returnDate: item.details.returnDate } : {}),
      };
    }
  }
  return injuries;
}

/** The designation for a player: the game's own report while it has one (it updates every few seconds in a live game), else the league report. */
export const injuryOf = (athleteId: string, game: { injuries?: Record<string, Injury> } | undefined, league: Record<string, Injury> | undefined): Injury | undefined =>
  game?.injuries?.[athleteId] ?? league?.[athleteId];
