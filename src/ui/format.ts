import { i18n } from '../i18n';
import type { en } from '../i18n/en';
import type { GameStats } from '../stats/types';
import { fieldLabel, stepLabel } from '../scoring/fields';
import { applied, scoreEntry } from '../scoring/score';
import type { ScoreKey, ScoringValues, StepStat, ValueKey } from '../scoring/types';
import type { GameInfo } from '../stats/scoreboard';
import type { NameDisplayMode } from '../storage/nameDisplay';
import type { FollowedEntry } from '../storage/types';

/** `rules` is how the league scores the stat and what it earned this game, one line each, for the stat's tooltip. */
export type StatItem = { value: string; label: string; rules: string };

const OFFENSE = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'PK']);
export const isOffense = (position: string) => OFFENSE.has(position);

/** Points as the breakdown shows them: always signed, two decimals. */
export const signedPoints = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}`;

type StatKey = keyof (typeof en)['shell']['stats'];
const stat = (key: StatKey) => i18n.t(($) => $.shell.stats[key]);
type Rule = ValueKey | StepStat;

/**
 * The stats the entry's league gives points for (a weight or a step rule that is not 0 and not switched off), in the
 * breakdown's order, whatever the position. Each shows only when it is not 0, except a team defense's points allowed.
 */
export function statLine(entry: FollowedEntry, game: GameStats | undefined, values: ScoringValues): StatItem[] {
  if (!game) return [];
  const v = applied(values);
  const { byRule } = scoreEntry(entry, game, values);
  const steps = (v.steps ?? []).filter((r) => r.points !== 0);
  const scores = (...keys: Rule[]) => keys.some((k) => steps.some((r) => r.stat === k) || (k in v && v[k as ValueKey] !== 0));
  const earned = (keys: ScoreKey[]) => i18n.t(($) => $.shell.entry.statEarned, { points: signedPoints(keys.reduce((sum, k) => sum + (byRule[k] ?? 0), 0)) });
  const rulesFor = (keys: Rule[]) => [
    ...keys.filter((k) => k in v && v[k as ValueKey] !== 0).map((k) => `${fieldLabel(k as ValueKey)}: ${v[k as ValueKey]}`),
    ...steps.filter((r) => keys.includes(r.stat)).map((r) => `${stepLabel(r)}: ${r.points}`),
    earned(keys),
  ].join('\n');
  const out: StatItem[] = [];
  const add = (keys: Rule[], value: number, key: StatKey, shown: number | string = value) => {
    if (scores(...keys) && value !== 0) out.push({ value: String(shown), label: stat(key), rules: rulesFor(keys) });
  };

  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    if (!d) return [];
    add(['dstSack'], d.sacks, 'sacks');
    add(['dstInterception'], d.interceptions, 'int');
    add(['dstFumbleRecovery'], d.fumbleRecoveries, 'fumRec');
    add(['dstSafety'], d.safeties, 'safeties');
    add(['dstBlockedKick'], d.blockedKicks ?? 0, 'blocked');
    add(['dstTd'], d.touchdowns, 'td');
    // Allowed yards and points score by the band they fall in, so the tooltip names that band rather than every weight.
    const band = (label: string, keys: ScoreKey[]) => `${label}: ${signedPoints(keys.reduce((sum, k) => sum + (byRule[k] ?? 0), 0))}\n${earned(keys)}`;
    if (scores(...YARDS_ALLOWED) && d.yardsAllowed) {
      out.push({ value: String(d.yardsAllowed), label: stat('ydsAllowed'), rules: band(i18n.t(($) => $.leagues.score.yardsAllowed, { yards: d.yardsAllowed }), YARDS_ALLOWED) });
    }
    // Always shown: 0 is a shutout, the best a defense can do.
    out.push({ value: String(d.pointsAllowed), label: stat('ptsAllowed'), rules: band(i18n.t(($) => $.leagues.score.pointsAllowed, { points: d.pointsAllowed }), ['pointsAllowed']) });
    return out;
  }

  const s = game.players[entry.espnId];
  if (!s) return [];
  const p = s.passing, ru = s.rushing, re = s.receiving, f = s.fumbles, r = s.returns, k = s.kicking, d = s.defense;
  if (p) {
    add(['passAttempt', 'passCompletion', 'passIncompletion'], p.attempts, 'comp', `${p.completions}/${p.attempts}`);
    add(['passYards', 'pass300', 'pass400'], p.yards, 'passYds');
    add(['passTd', 'passTd40', 'passTd50'], p.touchdowns, 'passTd');
    add(['interception'], p.interceptions, 'int');
    add(['sacked'], p.sacked ?? 0, 'sacked');
  }
  if (ru) {
    add(['rushAttempt'], ru.attempts, 'carries');
    add(['rushYards', 'rush100', 'rush200'], ru.yards, 'rushYds');
    add(['rushTd', 'rushTd40', 'rushTd50'], ru.touchdowns, 'rushTd');
  }
  if (re) {
    add(['recTarget'], re.targets, 'targets');
    add(['reception'], re.receptions, 'catches');
    add(['recYards', 'rec100', 'rec200'], re.yards, 'recYds');
    add(['recTd', 'recTd40', 'recTd50'], re.touchdowns, 'recTd');
  }
  add(['twoPoint'], s.twoPointConversions, 'twoPt');
  if (f) {
    add(['fumble'], f.fumbles, 'fumbles');
    add(['fumbleLost'], f.lost, 'fumLost');
  }
  if (r) {
    add(['kickReturnYards', 'puntReturnYards'], (scores('kickReturnYards') ? r.kickYards ?? 0 : 0) + (scores('puntReturnYards') ? r.puntYards ?? 0 : 0), 'retYds');
    add(['returnTd'], r.touchdowns, 'retTd');
  }
  if (k) {
    add(FIELD_GOALS, k.fgAttempts, 'fg', `${k.fgMade}/${k.fgAttempts}`);
    add(['xpMade', 'xpMissed'], k.xpAttempts, 'xp', `${k.xpMade}/${k.xpAttempts}`);
  }
  if (d) {
    add(['soloTackle', 'assistedTackle', 'tackle'], d.totalTackles, 'tackles');
    add(['sack'], d.sacks, 'sacks');
    add(['tackleForLoss'], d.tacklesForLoss, 'tfl');
    add(['qbHit'], d.qbHits, 'qbHits');
    add(['passDefended'], d.passesDefended, 'pd');
    add(['defensiveTd'], d.touchdowns, 'defTd');
  }
  // Only pure defenders score recoveries, as in scorePlayer.
  if (f && !p && !ru && !re && (d || s.interceptions)) add(['fumbleRecovery'], f.recovered, 'fumRec');
  add(['idpInterception'], s.interceptions?.interceptions ?? 0, 'int');
  add(['forcedFumble'], s.forcedFumbles ?? 0, 'ff');
  add(['stuff'], s.stuffs ?? 0, 'stuffs');
  add(['safety'], s.safeties, 'safeties');
  add(['blockedKick'], s.blockedKicks ?? 0, 'blocked');
  return out;
}

const FIELD_GOALS: ValueKey[] = ['fg0to39', 'fg40to49', 'fg50to59', 'fg60plus', 'fgMissed', 'fgMissed0to39', 'fgMissed40to49', 'fgMissed50to59', 'fgMissed60plus'];
const YARDS_ALLOWED: ValueKey[] = ['yardsAllowed0', 'yardsAllowed100', 'yardsAllowed200', 'yardsAllowed300', 'yardsAllowed350', 'yardsAllowed400', 'yardsAllowed450', 'yardsAllowed500', 'yardsAllowed550'];

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
  const values = { us: us.score, them: them.score, opponent: them.abbr };
  if (us.score > them.score) return home ? i18n.t(($) => $.shell.result.wonHome, values) : i18n.t(($) => $.shell.result.wonAway, values);
  if (us.score < them.score) return home ? i18n.t(($) => $.shell.result.lostHome, values) : i18n.t(($) => $.shell.result.lostAway, values);
  return home ? i18n.t(($) => $.shell.result.tiedHome, values) : i18n.t(($) => $.shell.result.tiedAway, values);
}

export const kickoffText = (iso: string) =>
  new Date(iso).toLocaleString(i18n.language, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

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
