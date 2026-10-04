import type { ScoringValues } from './types';

export type ValueKey = Exclude<keyof ScoringValues, 'pointsAllowed'>;

export const FIELD_GROUPS: { title: string; fields: { key: ValueKey; label: string; step: number }[] }[] = [
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
    title: 'Kicker',
    fields: [
      { key: 'fg0to39', label: 'Field goal 0-39 yards', step: 1 },
      { key: 'fg40to49', label: 'Field goal 40-49 yards', step: 1 },
      { key: 'fg50plus', label: 'Field goal 50+ yards', step: 1 },
      { key: 'fgMissed', label: 'Missed field goal', step: 1 },
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
      { key: 'tackleForLoss', label: 'Tackle for loss', step: 0.5 },
      { key: 'qbHit', label: 'QB hit', step: 0.5 },
      { key: 'passDefended', label: 'Pass defended', step: 0.5 },
      { key: 'idpInterception', label: 'Interception', step: 1 },
      { key: 'fumbleRecovery', label: 'Fumble recovery', step: 1 },
      { key: 'defensiveTd', label: 'Defensive TD', step: 1 },
      { key: 'safety', label: 'Safety', step: 1 },
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
    ],
  },
];
