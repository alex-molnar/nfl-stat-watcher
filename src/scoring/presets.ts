import type { PresetId, ScoringValues } from './types';

const BASE: ScoringValues = {
  passYards: 0.04, passTd: 4, interception: -2,
  rushYards: 0.1, rushTd: 6,
  reception: 1, recYards: 0.1, recTd: 6,
  twoPoint: 2, fumbleLost: -2, returnTd: 6,
  fg0to39: 3, fg40to49: 4, fg50plus: 5, fgMissed: -1, xpMade: 1, xpMissed: -1,
  soloTackle: 1, assistedTackle: 0.5, sack: 2, tackleForLoss: 1, qbHit: 0.5,
  passDefended: 1, idpInterception: 3, fumbleRecovery: 2, defensiveTd: 6, safety: 2,
  dstSack: 1, dstInterception: 2, dstFumbleRecovery: 2, dstSafety: 2, dstTd: 6,
  pointsAllowed: [10, 7, 4, 1, 0, -1, -4],
};

export const copyValues = (v: ScoringValues): ScoringValues => ({ ...v, pointsAllowed: [...v.pointsAllowed] });

export const PRESETS: Record<PresetId, ScoringValues> = {
  standard: { ...copyValues(BASE), reception: 0 },
  half: { ...copyValues(BASE), reception: 0.5 },
  ppr: copyValues(BASE),
};

export const PRESET_LABELS: Record<PresetId, string> = { standard: 'Standard', half: 'Half PPR', ppr: 'PPR' };
