import type { PresetId, ScoringValues } from './types';

const BASE: ScoringValues = {
  passAttempt: 0, passCompletion: 0, passIncompletion: 0, passYards: 0.04, passTd: 4, passTd40: 0, passTd50: 0, pass300: 0, pass400: 0, interception: -2, sacked: 0,
  rushAttempt: 0, rushYards: 0.1, rushTd: 6, rushTd40: 0, rushTd50: 0, rush100: 0, rush200: 0,
  recTarget: 0, reception: 1, recYards: 0.1, recTd: 6, recTd40: 0, recTd50: 0, rec100: 0, rec200: 0,
  twoPoint: 2, fumble: 0, fumbleLost: -2, fumbleRecoveryTd: 0, returnTd: 6, kickReturnYards: 0, puntReturnYards: 0,
  fg0to39: 3, fg40to49: 4, fg50to59: 5, fg60plus: 5, fgMissed: -1, fgMissed0to39: 0, fgMissed40to49: 0, fgMissed50to59: 0, fgMissed60plus: 0, xpMade: 1, xpMissed: -1,
  soloTackle: 1, assistedTackle: 0.5, sack: 2, tackleForLoss: 1, qbHit: 0.5,
  passDefended: 1, idpInterception: 3, fumbleRecovery: 2, forcedFumble: 0, stuff: 0, defensiveTd: 6, safety: 2, blockedKick: 0,
  dstSack: 1, dstInterception: 2, dstFumbleRecovery: 2, dstSafety: 2, dstTd: 6, dstBlockedKick: 0, twoPointReturn: 0, onePointSafety: 0,
  yardsAllowed0: 0, yardsAllowed100: 0, yardsAllowed200: 0, yardsAllowed300: 0, yardsAllowed350: 0, yardsAllowed400: 0, yardsAllowed450: 0, yardsAllowed500: 0, yardsAllowed550: 0,
  pointsAllowed: [10, 7, 4, 1, 0, -1, -4],
};

export const copyValues = (v: ScoringValues): ScoringValues => ({
  ...v,
  pointsAllowed: [...v.pointsAllowed],
  ...(v.pointsAllowedBands ? { pointsAllowedBands: v.pointsAllowedBands.map((band) => ({ ...band })) } : {}),
  ...(v.steps ? { steps: v.steps.map((rule) => ({ ...rule })) } : {}),
  ...(v.off ? { off: [...v.off] } : {}),
});

export const PRESETS: Record<PresetId, ScoringValues> = {
  standard: { ...copyValues(BASE), reception: 0 },
  half: { ...copyValues(BASE), reception: 0.5 },
  ppr: copyValues(BASE),
};

export const PRESET_LABELS: Record<PresetId, string> = { standard: 'Standard', half: 'Half PPR', ppr: 'PPR' };
