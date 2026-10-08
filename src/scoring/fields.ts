import { i18n } from '../i18n';
import type { StepRule, ValueKey } from './types';

export type { ValueKey };

export interface FieldDef {
  key: ValueKey;
  /** In the language of the page at the moment it is read; `fieldLabel(key, 'en')` is the English one. */
  readonly label: string;
  step: number;
  /** False when the live game feed cannot supply the stat, so the weight is stored but never scores. */
  live?: false;
  /** Scored from ESPN's play-by-play wording, which can change, so the weight may not match ESPN exactly. */
  approx?: true;
}

const NOT_LIVE = false as const;

/** A field's label, read when asked (never at import time), in the page's language or the given one. */
export const fieldLabel = (key: ValueKey, lng?: string): string => i18n.t(($) => $.leagues.fields[key], { lng });

const f = (key: ValueKey, step: number, extra: { live?: false; approx?: true } = {}): FieldDef => ({
  key, step, ...extra, get label() { return fieldLabel(key); },
});

export type GroupId = 'offense' | 'offenseBonuses' | 'offenseVolume' | 'kicker' | 'idp' | 'teamDefense' | 'yardsAllowed';
const groupTitle = (id: GroupId): string => i18n.t(($) => $.leagues.groups[id]);

export const FIELD_GROUPS: { id: GroupId; readonly title: string; fields: FieldDef[] }[] = [
  {
    id: 'offense', get title() { return groupTitle('offense'); },
    fields: [
      f('passYards', 0.01),
      f('passTd', 1),
      f('interception', 1),
      f('rushYards', 0.01),
      f('rushTd', 1),
      f('reception', 0.5),
      f('recYards', 0.01),
      f('recTd', 1),
      f('twoPoint', 1),
      f('fumbleLost', 1),
      f('returnTd', 1),
    ],
  },
  {
    id: 'offenseBonuses', get title() { return groupTitle('offenseBonuses'); },
    fields: [
      f('passTd40', 1),
      f('passTd50', 1),
      f('pass300', 1),
      f('pass400', 1),
      f('rushTd40', 1),
      f('rushTd50', 1),
      f('rush100', 1),
      f('rush200', 1),
      f('recTd40', 1),
      f('recTd50', 1),
      f('rec100', 1),
      f('rec200', 1),
    ],
  },
  {
    id: 'offenseVolume', get title() { return groupTitle('offenseVolume'); },
    fields: [
      f('passAttempt', 0.01),
      f('passCompletion', 0.01),
      f('passIncompletion', 0.01),
      f('rushAttempt', 0.01),
      f('recTarget', 0.1),
      f('fumble', 1),
      f('sacked', 0.5),
      f('fumbleRecoveryTd', 1, { live: NOT_LIVE }),
      f('kickReturnYards', 0.01),
      f('puntReturnYards', 0.01),
    ],
  },
  {
    id: 'kicker', get title() { return groupTitle('kicker'); },
    fields: [
      f('fg0to39', 1),
      f('fg40to49', 1),
      f('fg50to59', 1),
      f('fg60plus', 1),
      f('fgMissed', 1),
      f('fgMissed0to39', 1),
      f('fgMissed40to49', 1),
      f('fgMissed50to59', 1),
      f('fgMissed60plus', 1),
      f('xpMade', 1),
      f('xpMissed', 1),
    ],
  },
  {
    id: 'idp', get title() { return groupTitle('idp'); },
    fields: [
      f('soloTackle', 0.5),
      f('assistedTackle', 0.5),
      f('sack', 0.5),
      f('tackleForLoss', 0.5),
      f('stuff', 0.5, { approx: true }),
      f('qbHit', 0.5),
      f('passDefended', 0.5),
      f('idpInterception', 1),
      f('fumbleRecovery', 1),
      f('forcedFumble', 1, { approx: true }),
      f('defensiveTd', 1),
      f('safety', 1),
      f('blockedKick', 1, { approx: true }),
    ],
  },
  {
    id: 'teamDefense', get title() { return groupTitle('teamDefense'); },
    fields: [
      f('dstSack', 0.5),
      f('dstInterception', 1),
      f('dstFumbleRecovery', 1),
      f('dstSafety', 1),
      f('dstTd', 1),
      f('dstBlockedKick', 1, { approx: true }),
      f('twoPointReturn', 1, { live: NOT_LIVE }),
      f('onePointSafety', 1, { live: NOT_LIVE }),
    ],
  },
  {
    id: 'yardsAllowed', get title() { return groupTitle('yardsAllowed'); },
    fields: [
      f('yardsAllowed0', 1),
      f('yardsAllowed100', 1),
      f('yardsAllowed200', 1),
      f('yardsAllowed300', 1),
      f('yardsAllowed350', 1),
      f('yardsAllowed400', 1),
      f('yardsAllowed450', 1),
      f('yardsAllowed500', 1),
      f('yardsAllowed550', 1),
    ],
  },
];

export const isRuleOn = (values: { off?: readonly ValueKey[] }, key: ValueKey): boolean => !values.off?.includes(key);

/** "Every 25 passing yards", for a stepped rule, in the page's language. */
export const stepLabel = (rule: Pick<StepRule, 'stat' | 'every'>): string => i18n.t(($) => $.leagues.steps[rule.stat], { every: rule.every });
