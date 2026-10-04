import type { StepStat, ValueKey } from './types';

export type { ValueKey };

export interface FieldDef {
  key: ValueKey;
  label: string;
  step: number;
  /** False when the live game feed cannot supply the stat, so the weight is stored but never scores. */
  live?: false;
  /** Scored from ESPN's play-by-play wording, which can change, so the weight may not match ESPN exactly. */
  approx?: true;
}

const NOT_LIVE = false as const;

export const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Offense',
    fields: [
      { key: 'passYards', label: 'Per passing yard', step: 0.01 },
      { key: 'passTd', label: 'Passing TD', step: 1 },
      { key: 'interception', label: 'Interception thrown', step: 1 },
      { key: 'rushYards', label: 'Per rushing yard', step: 0.01 },
      { key: 'rushTd', label: 'Rushing TD', step: 1 },
      { key: 'reception', label: 'Reception', step: 0.5 },
      { key: 'recYards', label: 'Per receiving yard', step: 0.01 },
      { key: 'recTd', label: 'Receiving TD', step: 1 },
      { key: 'twoPoint', label: '2-point conversion', step: 1 },
      { key: 'fumbleLost', label: 'Fumble lost', step: 1 },
      { key: 'returnTd', label: 'Kick or punt return TD', step: 1 },
    ],
  },
  {
    title: 'Offense bonuses',
    fields: [
      { key: 'passTd40', label: '40+ yard passing TD', step: 1 },
      { key: 'passTd50', label: '50+ yard passing TD', step: 1 },
      { key: 'pass300', label: '300-399 yard passing game', step: 1 },
      { key: 'pass400', label: '400+ yard passing game', step: 1 },
      { key: 'rushTd40', label: '40+ yard rushing TD', step: 1 },
      { key: 'rushTd50', label: '50+ yard rushing TD', step: 1 },
      { key: 'rush100', label: '100-199 yard rushing game', step: 1 },
      { key: 'rush200', label: '200+ yard rushing game', step: 1 },
      { key: 'recTd40', label: '40+ yard receiving TD', step: 1 },
      { key: 'recTd50', label: '50+ yard receiving TD', step: 1 },
      { key: 'rec100', label: '100-199 yard receiving game', step: 1 },
      { key: 'rec200', label: '200+ yard receiving game', step: 1 },
    ],
  },
  {
    title: 'Offense volume',
    fields: [
      { key: 'passAttempt', label: 'Pass attempt', step: 0.01 },
      { key: 'passCompletion', label: 'Pass completion', step: 0.01 },
      { key: 'passIncompletion', label: 'Incomplete pass', step: 0.01 },
      { key: 'rushAttempt', label: 'Rush attempt', step: 0.01 },
      { key: 'recTarget', label: 'Target', step: 0.1 },
      { key: 'fumble', label: 'Fumble (lost or not)', step: 1 },
      { key: 'sacked', label: 'Time sacked', step: 0.5 },
      { key: 'fumbleRecoveryTd', label: 'Fumble recovered for TD', step: 1, live: NOT_LIVE },
      { key: 'kickReturnYards', label: 'Per kickoff return yard', step: 0.01 },
      { key: 'puntReturnYards', label: 'Per punt return yard', step: 0.01 },
    ],
  },
  {
    title: 'Kicker',
    fields: [
      { key: 'fg0to39', label: 'Field goal 0-39 yards', step: 1 },
      { key: 'fg40to49', label: 'Field goal 40-49 yards', step: 1 },
      { key: 'fg50to59', label: 'Field goal 50-59 yards', step: 1 },
      { key: 'fg60plus', label: 'Field goal 60+ yards', step: 1 },
      { key: 'fgMissed', label: 'Missed field goal (any distance)', step: 1 },
      { key: 'fgMissed0to39', label: 'Missed field goal 0-39 yards', step: 1 },
      { key: 'fgMissed40to49', label: 'Missed field goal 40-49 yards', step: 1 },
      { key: 'fgMissed50to59', label: 'Missed field goal 50-59 yards', step: 1 },
      { key: 'fgMissed60plus', label: 'Missed field goal 60+ yards', step: 1 },
      { key: 'xpMade', label: 'Extra point', step: 1 },
      { key: 'xpMissed', label: 'Missed extra point', step: 1 },
    ],
  },
  {
    title: 'IDP',
    fields: [
      { key: 'soloTackle', label: 'Solo tackle', step: 0.5 },
      { key: 'assistedTackle', label: 'Assisted tackle', step: 0.5 },
      { key: 'sack', label: 'Sack', step: 0.5 },
      { key: 'tackleForLoss', label: 'Tackle for loss or stuff', step: 0.5 },
      { key: 'qbHit', label: 'QB hit', step: 0.5 },
      { key: 'passDefended', label: 'Pass defended', step: 0.5 },
      { key: 'idpInterception', label: 'Interception', step: 1 },
      { key: 'fumbleRecovery', label: 'Fumble recovery', step: 1 },
      { key: 'forcedFumble', label: 'Forced fumble', step: 1, live: NOT_LIVE },
      { key: 'defensiveTd', label: 'Defensive TD', step: 1 },
      { key: 'safety', label: 'Safety', step: 1 },
      { key: 'blockedKick', label: 'Blocked kick', step: 1, approx: true },
    ],
  },
  {
    title: 'Team defense',
    fields: [
      { key: 'dstSack', label: 'Sack', step: 0.5 },
      { key: 'dstInterception', label: 'Interception', step: 1 },
      { key: 'dstFumbleRecovery', label: 'Fumble recovery', step: 1 },
      { key: 'dstSafety', label: 'Safety', step: 1 },
      { key: 'dstTd', label: 'Defense or return TD', step: 1 },
      { key: 'dstBlockedKick', label: 'Blocked kick', step: 1, approx: true },
      { key: 'twoPointReturn', label: '2-point return', step: 1, live: NOT_LIVE },
      { key: 'onePointSafety', label: '1-point safety', step: 1, live: NOT_LIVE },
    ],
  },
  {
    title: 'Team defense yards allowed',
    fields: [
      { key: 'yardsAllowed0', label: 'Under 100 yards allowed', step: 1 },
      { key: 'yardsAllowed100', label: '100-199 yards allowed', step: 1 },
      { key: 'yardsAllowed200', label: '200-299 yards allowed', step: 1 },
      { key: 'yardsAllowed300', label: '300-349 yards allowed', step: 1 },
      { key: 'yardsAllowed350', label: '350-399 yards allowed', step: 1 },
      { key: 'yardsAllowed400', label: '400-449 yards allowed', step: 1 },
      { key: 'yardsAllowed450', label: '450-499 yards allowed', step: 1 },
      { key: 'yardsAllowed500', label: '500-549 yards allowed', step: 1 },
      { key: 'yardsAllowed550', label: '550+ yards allowed', step: 1 },
    ],
  },
];

export const isRuleOn = (values: { off?: readonly ValueKey[] }, key: ValueKey): boolean => !values.off?.includes(key);

export const STEP_LABELS: Record<StepStat, string> = {
  passYards: 'passing yards', rushYards: 'rushing yards', recYards: 'receiving yards', passAttempt: 'pass attempts', passCompletion: 'pass completions',
  passIncompletion: 'incomplete passes', rushAttempt: 'rush attempts', reception: 'receptions', tackle: 'total tackles',
  kickReturnYards: 'kickoff return yards', puntReturnYards: 'punt return yards',
};
