import { i18n } from '../i18n';
import { copyValues } from '../scoring/presets';
import { nextLeagueColor } from '../scoring/leagueColor';
import { isValidScoringValues, type Profile, type ScoringValues } from '../scoring/types';
import { profilesStore } from '../storage/profiles';
import type { EspnLeagueSettings, LeagueImportDraft, LeagueImportResult, LeagueSource } from './types';
import { isLeagueSource } from './types';
import { normalizeEspnLeague } from './espn/scoring';

function identity(source: Pick<LeagueSource, 'provider' | 'leagueId' | 'season'>): string {
  return `${source.provider}:${source.leagueId}:${source.season}`;
}

export function leagueIdentity(source: Pick<LeagueSource, 'provider' | 'leagueId' | 'season'>): string {
  return identity(source);
}

function validSettingsShape(settings: EspnLeagueSettings): boolean {
  return /^\d{1,20}$/.test(settings.leagueId)
    && /^\d{4}$/.test(settings.season)
    && ['public-api', 'browser-session', 'settings-file'].includes(settings.transport)
    && settings.scoringItems.length <= 300
    && settings.scoringItems.every((item) => Number.isInteger(item.statId) && Number.isFinite(item.points))
    && Object.values(settings.lineupSlotCounts).every((count) => Number.isInteger(count) && count >= 0);
}

export function isValidLeagueImportDraft(draft: unknown): draft is LeagueImportDraft {
  if (typeof draft !== 'object' || draft === null) return false;
  const value = draft as Partial<LeagueImportDraft>;
  return typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 120
    && isLeagueSource(value.source)
    && isValidScoringValues(value.values);
}

function sameValues(a: ScoringValues, b: ScoringValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key as keyof ScoringValues]) === JSON.stringify(b[key as keyof ScoringValues]));
}

export function isLocallyModified(profile: Profile): boolean {
  return !!profile.source && !sameValues(profile.values, profile.source.baselineValues);
}

function availableName(raw: string, profiles: Profile[], excludingId?: string): string {
  const base = raw.trim() || i18n.t(($) => $.leagues.defaults.untitled);
  const used = new Set(profiles.filter((profile) => profile.id !== excludingId).map((profile) => profile.name.toLocaleLowerCase()));
  if (!used.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base} (${suffix})`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error(i18n.t(($) => $.leagues.errors.import.noUniqueName));
}

export interface LeagueImportTarget {
  sourceIdentity: string;
  profileId: string | null;
  localEditDecision?: 'replace' | 'preserve';
}

export function commitLeagueImports(
  drafts: LeagueImportDraft[],
  targets: LeagueImportTarget[],
): LeagueImportResult {
  if (drafts.length === 0 || drafts.length > 50 || drafts.some((draft) => !isValidLeagueImportDraft(draft))) {
    throw new Error(i18n.t(($) => $.leagues.errors.import.invalidDrafts));
  }
  if (targets.length !== drafts.length) throw new Error(i18n.t(($) => $.leagues.errors.import.chooseTargets));
  const current = profilesStore.get();
  const targetByIdentity = new Map(targets.map((target) => [target.sourceIdentity, target.profileId]));
  if (targetByIdentity.size !== targets.length) throw new Error(i18n.t(($) => $.leagues.errors.import.duplicateTargets));
  const identities = drafts.map(({ source }) => identity(source));
  if (new Set(identities).size !== identities.length) throw new Error(i18n.t(($) => $.leagues.errors.import.duplicateLeague));

  const claimedProfiles = new Set<string>();
  let next = [...current];
  const importedIds: string[] = [];
  for (const draft of drafts) {
    const key = identity(draft.source);
    const existingIdentity = current.find((profile) => profile.source && identity(profile.source) === key);
    const targetId = targetByIdentity.get(key);
    if (targetId === undefined) throw new Error(i18n.t(($) => $.leagues.errors.import.chooseTargets));
    if (existingIdentity && targetId !== existingIdentity.id) throw new Error(i18n.t(($) => $.leagues.errors.import.alreadyImported, { name: draft.name }));
    const target = targetId ? current.find((profile) => profile.id === targetId) : undefined;
    if (targetId && !target) throw new Error(i18n.t(($) => $.leagues.errors.import.profileGone));
    if (target?.source && identity(target.source) !== key) throw new Error(i18n.t(($) => $.leagues.errors.import.wrongTarget));
    const targetModified = !!target?.source && !sameValues(target.values, target.source.baselineValues);
    if (targetModified && !targets.find((candidate) => candidate.sourceIdentity === key)?.localEditDecision) {
      throw new Error(i18n.t(($) => $.leagues.errors.import.chooseLocal, { name: target.name }));
    }
    if (targetId && claimedProfiles.has(targetId)) throw new Error(i18n.t(($) => $.leagues.errors.import.differentProfile));
    if (targetId) claimedProfiles.add(targetId);

    const profileId = target?.id ?? crypto.randomUUID();
    const profile: Profile = {
      id: profileId,
      name: availableName(draft.name, next, profileId),
      // A refresh keeps the league's colour; a new league gets the next unused one.
      color: target?.color ?? nextLeagueColor(next.map((candidate) => candidate.color)),
      preset: 'custom',
      values: copyValues(targetModified && targets.find((candidate) => candidate.sourceIdentity === key)?.localEditDecision === 'preserve' ? target!.values : draft.values),
      // A refresh keeps the user's team choice for the same league and season.
      source: {
        ...structuredClone(draft.source),
        ...(target?.source?.teamId ? { teamId: target.source.teamId } : {}),
        ...(target?.source?.removeNonStarters ? { removeNonStarters: true } : {}),
      },
    };
    if (target) next = next.map((candidate) => candidate.id === target.id ? profile : candidate);
    else next.push(profile);
    importedIds.push(profileId);
  }

  const persisted = profilesStore.set(next);
  return { importedIds, persisted };
}

export function setLeagueTeam(profileId: string, teamId: string): void {
  profilesStore.set(profilesStore.get().map((profile) => (profile.id === profileId && profile.source ? { ...profile, source: { ...profile.source, teamId } } : profile)));
}

export function setLeagueRemoveNonStarters(profileId: string, removeNonStarters: boolean): void {
  profilesStore.set(profilesStore.get().map((profile) => {
    if (profile.id !== profileId || !profile.source) return profile;
    const { removeNonStarters: _old, ...rest } = profile.source;
    return { ...profile, source: removeNonStarters ? { ...rest, removeNonStarters: true } : rest };
  }));
}

export function disconnectLeagueSource(profileId: string): void {
  profilesStore.set(profilesStore.get().map((profile) => {
    if (profile.id !== profileId || !profile.source) return profile;
    const { source: _source, ...manualProfile } = profile;
    return manualProfile;
  }));
}

export function createEspnDraft(settings: EspnLeagueSettings): LeagueImportDraft {
  if (!validSettingsShape(settings)) throw new Error(i18n.t(($) => $.leagues.errors.import.invalidResponse));
  // Imported values are supplied by the pure scoring adapter; this guard prevents an unvalidated
  // provider object from bypassing its persisted source allowlist.
  const rawSettings = {
    scoringSettings: { scoringItems: settings.scoringItems },
    rosterSettings: { lineupSlotCounts: settings.lineupSlotCounts },
  };
  if (new TextEncoder().encode(JSON.stringify(rawSettings)).byteLength > 1_000_000) throw new Error(i18n.t(($) => $.leagues.errors.import.tooLarge));
  return normalizeEspnLeague({ ...settings, rawSettings });
}
