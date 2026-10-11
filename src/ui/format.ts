import { i18n } from '../i18n';
import type { en } from '../i18n/en';
import type { GameStats } from '../stats/types';
import { applied } from '../scoring/score';
import type { ScoringValues, StepStat, ValueKey } from '../scoring/types';
import type { GameInfo } from '../stats/scoreboard';
import type { NameDisplayMode } from '../storage/nameDisplay';
import type { FollowedEntry } from '../storage/types';

export type StatItem = { value: string; label: string };

const OFFENSE = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'PK']);
export const isOffense = (position: string) => OFFENSE.has(position);

type StatKey = keyof (typeof en)['shell']['stats'];
const stat = (key: StatKey) => i18n.t(($) => $.shell.stats[key]);

/**
 * The stats the entry's league gives points for (a weight or a step rule that is not 0 and not switched off), in the
 * breakdown's order, whatever the position. Each shows only when it is not 0, except a team defense's points allowed.
 */
export function statLine(entry: FollowedEntry, game: GameStats | undefined, values: ScoringValues): StatItem[] {
  if (!game) return [];
  const v = applied(values);
  const steps = new Set((v.steps ?? []).filter((r) => r.points !== 0).map((r) => r.stat));
  const scores = (...keys: (ValueKey | StepStat)[]) => keys.some((k) => steps.has(k as StepStat) || (k in v && v[k as ValueKey] !== 0));
  const out: StatItem[] = [];
  const add = (earns: boolean, value: number, key: StatKey, shown: number | string = value) => {
    if (earns && value !== 0) out.push({ value: String(shown), label: stat(key) });
  };

  if (entry.kind === 'defense') {
    const d = game.defenses[entry.teamId];
    if (!d) return [];
    add(scores('dstSack'), d.sacks, 'sacks');
    add(scores('dstInterception'), d.interceptions, 'int');
    add(scores('dstFumbleRecovery'), d.fumbleRecoveries, 'fumRec');
    add(scores('dstSafety'), d.safeties, 'safeties');
    add(scores('dstBlockedKick'), d.blockedKicks ?? 0, 'blocked');
    add(scores('dstTd'), d.touchdowns, 'td');
    add(YARDS_ALLOWED.some((k) => scores(k)), d.yardsAllowed ?? 0, 'ydsAllowed');
    out.push({ value: String(d.pointsAllowed), label: stat('ptsAllowed') }); // 0 is a shutout, the best a defense can do
    return out;
  }

  const s = game.players[entry.espnId];
  if (!s) return [];
  const p = s.passing, ru = s.rushing, re = s.receiving, f = s.fumbles, r = s.returns, k = s.kicking, d = s.defense;
  if (p) {
    add(scores('passAttempt', 'passCompletion', 'passIncompletion'), p.attempts, 'comp', `${p.completions}/${p.attempts}`);
    add(scores('passYards', 'pass300', 'pass400'), p.yards, 'passYds');
    add(scores('passTd', 'passTd40', 'passTd50'), p.touchdowns, 'passTd');
    add(scores('interception'), p.interceptions, 'int');
    add(scores('sacked'), p.sacked ?? 0, 'sacked');
  }
  if (ru) {
    add(scores('rushAttempt'), ru.attempts, 'carries');
    add(scores('rushYards', 'rush100', 'rush200'), ru.yards, 'rushYds');
    add(scores('rushTd', 'rushTd40', 'rushTd50'), ru.touchdowns, 'rushTd');
  }
  if (re) {
    add(scores('recTarget'), re.targets, 'targets');
    add(scores('reception'), re.receptions, 'catches');
    add(scores('recYards', 'rec100', 'rec200'), re.yards, 'recYds');
    add(scores('recTd', 'recTd40', 'recTd50'), re.touchdowns, 'recTd');
  }
  add(scores('twoPoint'), s.twoPointConversions, 'twoPt');
  if (f) {
    add(scores('fumble'), f.fumbles, 'fumbles');
    add(scores('fumbleLost'), f.lost, 'fumLost');
  }
  if (r) {
    add(true, (scores('kickReturnYards') ? r.kickYards ?? 0 : 0) + (scores('puntReturnYards') ? r.puntYards ?? 0 : 0), 'retYds');
    add(scores('returnTd'), r.touchdowns, 'retTd');
  }
  if (k) {
    add(scores(...FIELD_GOALS), k.fgAttempts, 'fg', `${k.fgMade}/${k.fgAttempts}`);
    add(scores('xpMade', 'xpMissed'), k.xpAttempts, 'xp', `${k.xpMade}/${k.xpAttempts}`);
  }
  if (d) {
    add(scores('soloTackle', 'assistedTackle', 'tackle'), d.totalTackles, 'tackles');
    add(scores('sack'), d.sacks, 'sacks');
    add(scores('tackleForLoss'), d.tacklesForLoss, 'tfl');
    add(scores('qbHit'), d.qbHits, 'qbHits');
    add(scores('passDefended'), d.passesDefended, 'pd');
    add(scores('defensiveTd'), d.touchdowns, 'defTd');
  }
  // Only pure defenders score recoveries, as in scorePlayer.
  if (f && !p && !ru && !re && (d || s.interceptions)) add(scores('fumbleRecovery'), f.recovered, 'fumRec');
  add(scores('idpInterception'), s.interceptions?.interceptions ?? 0, 'int');
  add(scores('forcedFumble'), s.forcedFumbles ?? 0, 'ff');
  add(scores('stuff'), s.stuffs ?? 0, 'stuffs');
  add(scores('safety'), s.safeties, 'safeties');
  add(scores('blockedKick'), s.blockedKicks ?? 0, 'blocked');
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
