import { FIELD_GROUPS } from '../../scoring/fields';
import { PRESETS, copyValues } from '../../scoring/presets';
import { VALUE_KEYS, type ScoringValues } from '../../scoring/types';
import { ESPN_SCORING_MAP_VERSION, ESPN_STAT_MAP, SCOPE_POSITIONS, TOUCHDOWN_GROUPS, effectivePoints, issueForItem, type Scope } from './statMap';
import type { EspnLeagueSettings, EspnScoringItem, ImportIssue, LeagueImportDraft } from '../types';

const POINTS_ALLOWED_RANGES: Array<{ min: number; max: number | null; statIds: number[] }> = [
  { min: 0, max: 0, statIds: [89, 188] },
  { min: 1, max: 6, statIds: [90, 189] },
  { min: 7, max: 13, statIds: [91, 190] },
  { min: 14, max: 17, statIds: [92, 191] },
  { min: 18, max: 21, statIds: [121, 192] },
  { min: 22, max: 27, statIds: [122, 193] },
  { min: 28, max: 34, statIds: [123, 194] },
  { min: 35, max: 45, statIds: [124, 195] },
  { min: 46, max: null, statIds: [125, 196] },
];
const POINTS_ALLOWED_IDS = new Set(POINTS_ALLOWED_RANGES.flatMap(({ statIds }) => statIds));
const TWO_POINT_IDS = [19, 26, 44, 62];
const TOUCHDOWN_IDS = new Set(TOUCHDOWN_GROUPS.flatMap(({ statIds }) => statIds));

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const NOT_LIVE_LABELS = new Map(FIELD_GROUPS.flatMap(({ fields }) => fields.filter((field) => field.live === false).map((field) => [field.key, field.label] as const)));

function addIssue(issues: ImportIssue[], issue: ImportIssue) {
  if (!issues.some((existing) => existing.code === issue.code && existing.providerKeys[0] === issue.providerKeys[0] && existing.message === issue.message)) issues.push(issue);
}

/** One value for every lineup slot in the scope, or null when ESPN scores them differently. */
function acrossScope(item: EspnScoringItem, scope: Scope): number | null {
  const values = SCOPE_POSITIONS[scope].map((position) => effectivePoints(item, position));
  const unique = new Set(values);
  return unique.size === 1 ? values[0]! : null;
}

function hasModifier(item: EspnScoringItem): boolean {
  return item.statOffset !== null || item.scoringPeriodId !== null || item.statPeriodId !== null
    || (!!item.pointsByDistance && Object.keys(item.pointsByDistance).length > 0);
}

export function normalizeEspnLeague(league: EspnLeagueSettings): LeagueImportDraft {
  const values = copyValues(PRESETS.standard);
  for (const key of VALUE_KEYS) values[key] = 0;
  values.pointsAllowed = Array(7).fill(0) as number[];
  delete values.pointsAllowedBands;
  delete values.off;
  delete values.steps;
  const issues: ImportIssue[] = [];
  const active = league.scoringItems.filter((item) => item.isActive !== false && item.isDisabled !== true);
  const usable: EspnScoringItem[] = [];

  for (const item of active) {
    if (hasModifier(item)) {
      addIssue(issues, issueForItem(item, 'stat offsets, periods or distance-specific weights are not represented'));
      continue;
    }
    usable.push(item);
  }

  const handledElsewhere = (id: number) => POINTS_ALLOWED_IDS.has(id) || TWO_POINT_IDS.includes(id) || TOUCHDOWN_IDS.has(id);
  for (const item of usable) {
    const rule = ESPN_STAT_MAP[item.statId];
    if (!rule && !handledElsewhere(item.statId)) {
      addIssue(issues, issueForItem(item, 'this stat ID is not in the reviewed ESPN stat map', 'unknown-rule'));
      continue;
    }
    if (handledElsewhere(item.statId)) continue;
    if (!rule?.targets) {
      addIssue(issues, issueForItem(item, 'this award has no equivalent in this site’s scoring'));
      continue;
    }
    // ESPN adds the awards of every stat that scores the same thing, so contributions accumulate.
    for (const target of rule.targets) {
      const points = acrossScope(item, target.scope);
      if (points === null) {
        addIssue(issues, issueForItem(item, 'position overrides differ and cannot be represented by one profile value'));
        continue;
      }
      if (target.step) {
        const { stat, every } = target.step;
        const steps = (values.steps ??= []);
        const existing = steps.find((rule) => rule.stat === stat && rule.every === every);
        if (existing) existing.points = round(existing.points + points); else steps.push({ stat, every, points });
      } else {
        values[target.key] = round(values[target.key] + points / (target.per ?? 1));
      }
    }
  }

  if (values.steps) {
    values.steps = values.steps.filter((rule) => rule.points !== 0);
    if (values.steps.length === 0) delete values.steps;
  }

  for (const group of TOUCHDOWN_GROUPS) {
    const items = usable.filter(({ statId }) => group.statIds.includes(statId));
    if (items.length === 0) continue;
    const points = items.map((item) => acrossScope(item, group.scope));
    if (points.some((point) => point === null)) {
      for (const item of items) addIssue(issues, issueForItem(item, 'position overrides differ and cannot be represented by one profile value'));
      continue;
    }
    const distinct = [...new Set(points as number[])];
    if (distinct.length > 1) {
      for (const item of items) addIssue(issues, issueForItem(item, `${group.label} have different awards; the site uses one value, so the highest was kept`));
    }
    values[group.key] = Math.max(...distinct);
  }

  const twoPointItems = usable.filter(({ statId }) => TWO_POINT_IDS.includes(statId));
  if (twoPointItems.length > 0) {
    const totals = twoPointItems.filter(({ statId }) => statId === 62);
    const categories = twoPointItems.filter(({ statId }) => statId !== 62);
    const allPoints = twoPointItems.map((item) => acrossScope(item, 'offense'));
    const completeCategories = [19, 26, 44].every((id) => categories.some((item) => item.statId === id));
    const overlappingTotals = totals.length > 0 && categories.length > 0;
    if (!overlappingTotals && allPoints.every((point) => point !== null) && new Set(allPoints).size === 1 && (totals.length === 1 || (totals.length === 0 && completeCategories))) {
      values.twoPoint = allPoints[0]!;
    } else {
      addIssue(issues, issueForItem(twoPointItems[0]!, overlappingTotals
        ? 'both total and category-specific 2-point awards are enabled; their stacking cannot be represented as one value'
        : 'the configured category-specific awards cannot be represented as one combined conversion value'));
    }
  }

  const bandItems = usable.filter(({ statId }) => POINTS_ALLOWED_IDS.has(statId));
  if (bandItems.length > 0) {
    values.pointsAllowedBands = POINTS_ALLOWED_RANGES.map(({ min, max, statIds }) => {
      const candidates = bandItems.filter(({ statId }) => statIds.includes(statId));
      const weights = candidates.map((item) => effectivePoints(item, '16'));
      const conflicting = candidates.length > 1;
      if (conflicting) {
        for (const item of candidates) addIssue(issues, issueForItem(item, 'conflicts with another ESPN stat ID for the same points-allowed range'));
      }
      return { min, max, points: conflicting ? 0 : weights[0] ?? 0 };
    });
  }

  const notLive = [...NOT_LIVE_LABELS].filter(([key]) => values[key] !== 0).map(([, label]) => label);
  if (notLive.length > 0) {
    addIssue(issues, {
      code: 'stat-limitation',
      providerKeys: ['stats:notLive'],
      message: `Imported, but the live game feed does not supply these stats, so they never score: ${notLive.join(', ')}.`,
    });
  }
  const approx = FIELD_GROUPS.flatMap(({ fields }) => fields.filter((field) => field.approx && values[field.key] !== 0).map((field) => field.label));
  if (approx.length > 0) {
    addIssue(issues, {
      code: 'stat-limitation',
      providerKeys: ['stats:playText'],
      message: 'Blocked kicks are read from ESPN’s play-by-play wording (punts, field goals and extra points), so they might not be accurate if ESPN words a play differently.',
    });
  }
  addIssue(issues, {
    code: 'stat-limitation',
    providerKeys: ['stats:pointsAllowed'],
    message: 'The site uses the opponent team’s full score and total yards for D/ST rules; ESPN can exclude special teams, safeties or defensive scores.',
  });

  // A league only turns on what it scores; everything else starts off but keeps its slot in the editor.
  const off = VALUE_KEYS.filter((key) => values[key] === 0);
  if (off.length > 0) values.off = off;

  const baselineValues = copyValues(values);
  return {
    name: league.name,
    values,
    source: {
      provider: 'espn',
      leagueId: league.leagueId,
      season: league.season,
      transport: league.transport,
      importedAt: new Date().toISOString(),
      mappingVersion: ESPN_SCORING_MAP_VERSION,
      rawSettings: league.rawSettings,
      baselineValues,
      lineupSlotCounts: { ...league.lineupSlotCounts },
      issues,
    },
  };
}
