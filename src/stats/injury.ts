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
