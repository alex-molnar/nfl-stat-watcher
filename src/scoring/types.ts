export interface ScoringValues {
  passYards: number; passTd: number; interception: number;
  rushYards: number; rushTd: number;
  reception: number; recYards: number; recTd: number;
  twoPoint: number; fumbleLost: number; returnTd: number;
  fg0to39: number; fg40to49: number; fg50plus: number; fgMissed: number; xpMade: number; xpMissed: number;
  soloTackle: number; assistedTackle: number; sack: number; tackleForLoss: number; qbHit: number;
  passDefended: number; idpInterception: number; fumbleRecovery: number; defensiveTd: number; safety: number;
  dstSack: number; dstInterception: number; dstFumbleRecovery: number; dstSafety: number; dstTd: number;
  pointsAllowed: number[]; // 7 tiers, see POINTS_ALLOWED_TIERS
}

export type PresetId = 'standard' | 'half' | 'ppr';

export interface Profile {
  id: string;
  name: string;
  preset: PresetId | 'custom';
  values: ScoringValues;
}

export interface ScoreLine { label: string; points: number }
export interface ScoreResult { total: number; breakdown: ScoreLine[] }

export const POINTS_ALLOWED_TIERS = ['0', '1-6', '7-13', '14-20', '21-27', '28-34', '35+'] as const;
