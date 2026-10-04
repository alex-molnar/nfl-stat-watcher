import type { EspnAthleteRef, EspnPlay, EspnStatCategory, EspnSummary } from '../espn/types';
import type { DefenseStats, GameStats, PlayerStats, Situation } from './types';

const num = (s: string | undefined) => {
  const n = Number.parseFloat(s ?? '');
  return Number.isFinite(n) ? n : 0;
};

function pick(cat: EspnStatCategory, values: string[] | undefined, key: string): number {
  const i = cat.keys.indexOf(key);
  return i === -1 || !values ? 0 : num(values[i]);
}

function pair(cat: EspnStatCategory, values: string[], key: string): [number, number] {
  const i = cat.keys.indexOf(key);
  const [a, b] = (i === -1 ? '' : values[i] ?? '').split('/');
  return [num(a), num(b)];
}

/** "Aaron Rodgers" -> "A.Rodgers", the way ESPN play text names players. */
export function shortName(a: Pick<EspnAthleteRef, 'firstName' | 'lastName' | 'displayName'>): string {
  const parts = a.displayName.split(' ');
  const first = a.firstName ?? parts[0] ?? '';
  const last = (a.lastName ?? parts.slice(1).join(' ')).split(' ')[0] ?? '';
  return `${first.charAt(0)}.${last}`;
}

export function allPlays(s: EspnSummary): EspnPlay[] {
  const plays = [...(s.drives?.previous ?? []).flatMap((d) => d.plays), ...(s.drives?.current?.plays ?? [])];
  const seen = new Set<string>();
  return plays.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export function situationFrom(plays: EspnPlay[]): Situation | null {
  const last = plays.at(-1);
  if (!last) return null;
  const spot = last.end?.team?.id && last.end.yardsToEndzone != null ? last.end : last.start;
  if (!spot.team?.id || spot.yardsToEndzone == null) return null;
  return {
    possessionTeamId: spot.team.id,
    yardsToEndzone: spot.yardsToEndzone,
    downDistanceText: spot.downDistanceText ?? '',
    lastPlayText: last.text,
  };
}

type Named = { id: string; teamId: string; short: string };

const FIELD_GOAL = /(\d+) yard field goal is GOOD/i;
const FIELD_GOAL_MISS = /(\d+) yard field goal is (?:No Good|BLOCKED)/i;
/** "punt is BLOCKED by S.Fehoko", "extra point is Blocked (T.Booker)", "field goal is BLOCKED (W.Anderson)". */
const BLOCKED_KICK = /\b(?:field goal|punt|extra point|PAT) is blocked(?: by |\s*\()([^,)]+)/i;
/** "FUMBLES (J.Parrish)" names the player who forced it; sack plays add "Fumble Forced by 98-M.Crosby". */
const FUMBLE_BY = /FUMBLES \(([^)]+)\)/;
const FUMBLE_FORCED_BY = /Fumble Forced by (?:\d+-)?([^,. ]+\.[^,. ]+)/i;
/** "... for no gain (G.Gaines; T.Bernard)": a rush for no gain or a loss with its tacklers. */
const STUFF = /\bfor (?:no gain|-\d+ yards?)\s*\(([^)]*)\)/;
const TD_YARDS = /for (-?\d+) yards?, TOUCHDOWN/i;
const TD_VOID = /NULLIFIED|REVERSED|WIPED/i;
const TWO_POINT = /TWO-POINT CONVERSION ATTEMPT\.(.*?)ATTEMPT SUCCEEDS/i;
const SAFETY = /\bSAFETY\b/;

/** Credits the length of a passing or rushing touchdown to the players named in its play text. */
function applyTouchdownYards(play: EspnPlay, offense: string, players: Record<string, PlayerStats>, names: Named[]) {
  const kind = play.type?.text;
  if (kind !== 'Passing Touchdown' && kind !== 'Rushing Touchdown') return;
  if (TD_VOID.test(play.text)) return;
  const match = TD_YARDS.exec(play.text);
  if (!match || match.index === undefined) return;
  const yards = Number(match[1]);
  const lead = play.text.slice(0, match.index);
  const mentioned = names
    .filter((n) => n.teamId === offense && players[n.id])
    .map((n) => ({ n, at: lead.lastIndexOf(n.short) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at);
  const credit = (id: string, key: 'pass' | 'rush' | 'rec') => {
    const p = players[id];
    if (p) (p.tdYards ??= { pass: [], rush: [], rec: [] })[key].push(yards);
  };
  if (kind === 'Passing Touchdown') {
    const passer = mentioned.find(({ n }) => players[n.id]?.passing);
    const receiver = [...mentioned].reverse().find(({ n }) => players[n.id]?.receiving && n.id !== passer?.n.id);
    if (passer) credit(passer.n.id, 'pass');
    if (receiver) credit(receiver.n.id, 'rec');
  } else {
    const runner = [...mentioned].reverse().find(({ n }) => players[n.id]?.rushing);
    if (runner) credit(runner.n.id, 'rush');
  }
}

function applyPlays(
  plays: EspnPlay[],
  players: Record<string, PlayerStats>,
  defenses: Record<string, DefenseStats>,
  names: Named[],
) {
  for (const play of plays) {
    const offense = play.start.team?.id;
    if (!offense) continue;

    const fg = FIELD_GOAL.exec(play.text);
    if (fg) {
      const kicker = names.find((n) => n.teamId === offense && players[n.id]?.kicking && play.text.includes(n.short));
      players[kicker?.id ?? '']?.kicking?.madeDistances.push(Number(fg[1]));
    }

    const miss = FIELD_GOAL_MISS.exec(play.text);
    if (miss) {
      const kicker = names.find((n) => n.teamId === offense && players[n.id]?.kicking && play.text.includes(n.short));
      const k = players[kicker?.id ?? '']?.kicking;
      if (k) (k.missedDistances ??= []).push(Number(miss[1]));
    }

    applyTouchdownYards(play, offense, players, names);

    const block = BLOCKED_KICK.exec(play.text);
    if (block && !TD_VOID.test(play.text)) {
      const defense = Object.keys(defenses).find((id) => id !== offense);
      if (defense) defenses[defense]!.blockedKicks = (defenses[defense]!.blockedKicks ?? 0) + 1;
      const blocker = names.find((n) => n.teamId !== offense && n.short === block[1]!.trim());
      if (blocker) players[blocker.id]!.blockedKicks = (players[blocker.id]!.blockedKicks ?? 0) + 1;
    }

    if (!TD_VOID.test(play.text)) {
      const forcer = (FUMBLE_FORCED_BY.exec(play.text)?.[1] ?? FUMBLE_BY.exec(play.text)?.[1])?.trim();
      const forced = forcer && names.find((n) => n.teamId !== offense && n.short === forcer);
      if (forced) players[forced.id]!.forcedFumbles = (players[forced.id]!.forcedFumbles ?? 0) + 1;

      const stop = play.type?.text === 'Rush' ? STUFF.exec(play.text) : null;
      if (stop) {
        const tacklers = stop[1]!.split(';').map((name) => name.trim()).filter(Boolean);
        for (const name of tacklers) {
          const tackler = names.find((n) => n.teamId !== offense && n.short === name);
          if (tackler) players[tackler.id]!.stuffs = (players[tackler.id]!.stuffs ?? 0) + 1 / tacklers.length;
        }
      }
    }

    const two = TWO_POINT.exec(play.text);
    if (two) {
      for (const n of names) {
        if (n.teamId === offense && two[1]!.includes(n.short)) players[n.id]!.twoPointConversions += 1;
      }
    }

    if (SAFETY.test(play.text)) {
      const defense = Object.keys(defenses).find((id) => id !== offense);
      if (defense) {
        defenses[defense]!.safeties += 1;
        for (const n of names) {
          if (n.teamId === defense && play.text.includes(n.short)) players[n.id]!.safeties += 1;
        }
      }
    }
  }
}

function yardsAllowedOf(s: EspnSummary, opponentId: string | undefined): { yardsAllowed?: number } {
  const stat = s.boxscore.teams?.find((t) => t.team.id === opponentId)?.statistics.find((c) => c.name === 'totalYards');
  const yards = Number.parseFloat(stat?.displayValue ?? '');
  return Number.isFinite(yards) ? { yardsAllowed: yards } : {};
}

export function normalizeSummary(s: EspnSummary): GameStats {
  const players: Record<string, PlayerStats> = {};
  const names: Named[] = [];
  const teams = s.boxscore.players ?? [];
  const player = (id: string) => (players[id] ??= { twoPointConversions: 0, safeties: 0 });

  for (const team of teams) {
    for (const cat of team.statistics) {
      for (const { athlete, stats } of cat.athletes) {
        if (!names.some((n) => n.id === athlete.id)) {
          names.push({ id: athlete.id, teamId: team.team.id, short: shortName(athlete) });
        }
        const p = player(athlete.id);
        const v = (key: string) => pick(cat, stats, key);
        switch (cat.name) {
          case 'passing': {
            const [completions, attempts] = pair(cat, stats, 'completions/passingAttempts');
            p.passing = { completions, attempts, yards: v('passingYards'), touchdowns: v('passingTouchdowns'), interceptions: v('interceptions'), sacked: pair(cat, stats, 'sacks-sackYardsLost')[0] };
            break;
          }
          case 'rushing':
            p.rushing = { attempts: v('rushingAttempts'), yards: v('rushingYards'), touchdowns: v('rushingTouchdowns') };
            break;
          case 'receiving':
            p.receiving = { receptions: v('receptions'), targets: v('receivingTargets'), yards: v('receivingYards'), touchdowns: v('receivingTouchdowns') };
            break;
          case 'fumbles':
            p.fumbles = { fumbles: v('fumbles'), lost: v('fumblesLost'), recovered: v('fumblesRecovered') };
            break;
          case 'defensive':
            p.defense = {
              totalTackles: v('totalTackles'), soloTackles: v('soloTackles'), sacks: v('sacks'),
              tacklesForLoss: v('tacklesForLoss'), passesDefended: v('passesDefended'), qbHits: v('QBHits'),
              touchdowns: v('defensiveTouchdowns'),
            };
            break;
          case 'interceptions':
            p.interceptions = { interceptions: v('interceptions'), touchdowns: v('interceptionTouchdowns') };
            break;
          case 'kickReturns':
          case 'puntReturns':
            p.returns = {
              ...p.returns,
              touchdowns: (p.returns?.touchdowns ?? 0) + v(cat.name === 'kickReturns' ? 'kickReturnTouchdowns' : 'puntReturnTouchdowns'),
              [cat.name === 'kickReturns' ? 'kickYards' : 'puntYards']: v(cat.name === 'kickReturns' ? 'kickReturnYards' : 'puntReturnYards'),
            };
            break;
          case 'kicking': {
            const [fgMade, fgAttempts] = pair(cat, stats, 'fieldGoalsMade/fieldGoalAttempts');
            const [xpMade, xpAttempts] = pair(cat, stats, 'extraPointsMade/extraPointAttempts');
            p.kicking = { fgMade, fgAttempts, longest: v('longFieldGoalMade'), xpMade, xpAttempts, madeDistances: [] };
            break;
          }
        }
      }
    }
  }

  const scores: Record<string, number> = {};
  for (const c of s.header.competitions[0]?.competitors ?? []) scores[c.team.id] = num(c.score);

  const total = (team: (typeof teams)[number] | undefined, name: string, key: string) => {
    const cat = team?.statistics.find((c) => c.name === name);
    return cat ? pick(cat, cat.totals, key) : 0;
  };

  const defenses: Record<string, DefenseStats> = {};
  for (const team of teams) {
    const opp = teams.find((t) => t.team.id !== team.team.id);
    defenses[team.team.id] = {
      sacks: total(team, 'defensive', 'sacks'),
      interceptions: total(team, 'interceptions', 'interceptions'),
      fumbleRecoveries: total(opp, 'fumbles', 'fumblesLost'),
      touchdowns:
        total(team, 'defensive', 'defensiveTouchdowns') +
        total(team, 'kickReturns', 'kickReturnTouchdowns') +
        total(team, 'puntReturns', 'puntReturnTouchdowns'),
      safeties: 0,
      pointsAllowed: opp ? scores[opp.team.id] ?? 0 : 0,
      ...yardsAllowedOf(s, opp?.team.id),
    };
  }

  const plays = allPlays(s);
  applyPlays(plays, players, defenses, names);
  return { players, defenses, situation: situationFrom(plays) };
}
