import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { useQueryClient } from '@tanstack/react-query';
import { espnSettingsQueryKey, loadEspnLeagueSettings, EspnLoadError } from '../leagues/espn/client';
import { PrivateLeagueHelp } from './PrivateLeagueHelp';
import { isConnectorConfigured } from '../leagues/espn/connection';
import { EspnSettingsError, parseEspnLeagueInput, parsePastedEspnSettings } from '../leagues/espn/parse';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { commitLeagueImports, isLocallyModified, leagueIdentity, type LeagueImportTarget } from '../leagues/import';
import type { EspnLeagueSettings, LeagueImportDraft } from '../leagues/types';
import { FIELD_GROUPS, stepLabel } from '../scoring/fields';
import { issueText } from '../leagues/espn/statMap';
import { track } from '../metrics/track';
import { profilesStore } from '../storage/profiles';
import { useStore } from '../storage/useStore';

type LoadState = 'loading' | 'ready' | 'error';
interface ImportEntry {
  key: string;
  input: string;
  state: LoadState;
  draft?: LeagueImportDraft;
  error?: string;
  needsAccess?: boolean;
  selected: boolean;
  acknowledged: boolean;
  targetId: string;
  localEditDecision?: 'replace' | 'preserve';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
  refreshProfileId?: string;
}

function summarizeLineup(counts: Record<string, number>): string {
  const active = Object.entries(counts).filter(([id, count]) => id !== '20' && id !== '21' && count > 0);
  return active.length ? active.map(([id, count]) => i18n.t(($) => $.leagues.importLeagues.slot, { id, count })).join(', ') : i18n.t(($) => $.leagues.importLeagues.noSlots);
}

function importedValues(draft: LeagueImportDraft): string[] {
  const values: string[] = [];
  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      const points = draft.values[field.key];
      if (points !== 0) values.push(i18n.t(($) => $.leagues.importLeagues.valueLine, { label: field.label, points }));
    }
  }
  for (const rule of draft.values.steps ?? []) values.push(i18n.t(($) => $.leagues.importLeagues.valueLine, { label: stepLabel(rule), points: rule.points }));
  if (draft.values.pointsAllowedBands) values.push(i18n.t(($) => $.leagues.importLeagues.bandRanges, { n: draft.values.pointsAllowedBands.length }));
  else if (draft.values.pointsAllowed.some((points) => points !== 0)) values.push(i18n.t(($) => $.leagues.importLeagues.bandScoring));
  return values;
}

function settingsUrl(input: string, season: string): string | null {
  try {
    const { leagueId, season: fromLink } = parseEspnLeagueInput(input);
    const year = season || fromLink;
    return year ? `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mSettings` : null;
  } catch {
    return null;
  }
}

export function ImportLeaguesDialog({ open, onClose, onImported, refreshProfileId }: Props) {
  const { t } = useTranslation();
  const hint = useHint();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [leagueInputs, setLeagueInputs] = useState('');
  // Starts as the current year, the season most people import; it can still be changed or cleared.
  const [season, setSeason] = useState(() => String(new Date().getFullYear()));
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const closeHandled = useRef(true);
  const profiles = useStore(profilesStore);
  const queryClient = useQueryClient();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      closeHandled.current = false;
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!refreshProfileId) return;
    const profile = profiles.find((candidate) => candidate.id === refreshProfileId);
    if (!profile?.source) return;
    setLeagueInputs(`${profile.source.leagueId}`);
    setSeason(profile.source.season);
    setEntries([]);
  }, [refreshProfileId, profiles]);

  function upsert(entry: ImportEntry) {
    setEntries((current) => {
      const index = current.findIndex((candidate) => candidate.key === entry.key);
      if (index < 0) return [...current, entry];
      const next = [...current];
      next[index] = entry;
      return next;
    });
  }

  async function loadOne(input: string, signal?: AbortSignal, selected = true) {
    const value = input.trim();
    const key = `${value.toLowerCase()}:${season}`;
    upsert({ key, input: value, state: 'loading', selected, acknowledged: false, targetId: '' });
    try {
      const parsed = parseEspnLeagueInput(value);
      const requestedSeason = season || parsed.season || '';
      if (!requestedSeason) throw new Error(t(($) => $.leagues.importLeagues.chooseSeason));
      const settings = await queryClient.fetchQuery({
        queryKey: espnSettingsQueryKey(parsed.leagueId, requestedSeason),
        queryFn: ({ signal: querySignal }) => loadEspnLeagueSettings(value, requestedSeason, signal ?? querySignal),
        // Explicit refresh must reach ESPN; reusing the five-minute import cache
        // would silently mark an unchanged snapshot as newly refreshed.
        staleTime: refreshProfileId ? 0 : 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: (failureCount, cause) => failureCount < 1 && cause instanceof EspnLoadError && cause.kind === 'network-error',
      });
      if (signal?.aborted) return;
      applySettings(key, value, settings, selected);
      track('league_load', { result: 'ok' });
    } catch (cause) {
      if (signal?.aborted) return;
      const text = cause instanceof Error ? cause.message : t(($) => $.leagues.importLeagues.loadFailed);
      const needsAccess = cause instanceof EspnLoadError && cause.kind === 'access-denied';
      track('league_load', { result: needsAccess ? 'private' : 'error' });
      upsert({ key, input: value, state: 'error', error: text, needsAccess, selected, acknowledged: false, targetId: '' });
    }
  }

  function applySettings(key: string, input: string, settings: EspnLeagueSettings, selected: boolean) {
    const draft = normalizeEspnLeague(settings);
    const identity = leagueIdentity(draft.source);
    const matching = profiles.find((profile) => profile.source && leagueIdentity(profile.source) === identity);
    upsert({
      key,
      input,
      state: 'ready',
      draft,
      selected,
      acknowledged: draft.source.issues.length === 0,
      targetId: matching?.id ?? '',
    });
    setError('');
  }

  function importPasted(entry: ImportEntry, text: string): string | null {
    try {
      const parsed = parseEspnLeagueInput(entry.input);
      const requestedSeason = season || parsed.season || '';
      applySettings(entry.key, entry.input, parsePastedEspnSettings(text, parsed.leagueId, requestedSeason), entry.selected);
      return null;
    } catch (cause) {
      return cause instanceof EspnSettingsError || cause instanceof Error ? cause.message : t(($) => $.leagues.importLeagues.readFailed);
    }
  }

  async function loadAll() {
    const inputs = leagueInputs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!/^\d{4}$/.test(season)) {
      setError(t(($) => $.leagues.importLeagues.chooseSeasonToLoad));
      return;
    }
    if (inputs.length === 0) {
      setError(t(($) => $.leagues.importLeagues.pasteOne));
      return;
    }
    const existing = new Set<string>();
    const unique = inputs.filter((input) => {
      const key = `${input.toLowerCase()}:${season}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    setError('');
    setBusy(true);
    setMessage(t(($) => $.leagues.importLeagues.loading, { count: unique.length }));
    const controller = new AbortController();
    const dialog = ref.current as (HTMLDialogElement & { __importAbort?: AbortController }) | null;
    if (dialog) dialog.__importAbort = controller;
    let next = 0;
    const worker = async () => {
      while (next < unique.length && !controller.signal.aborted) {
        const input = unique[next]!;
        next += 1;
        await loadOne(input, controller.signal);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, unique.length) }, worker));
    if (!controller.signal.aborted) setMessage(t(($) => $.leagues.importLeagues.review));
    setBusy(false);
  }

  function abortPending() {
    const dialog = ref.current as (HTMLDialogElement & { __importAbort?: AbortController }) | null;
    dialog?.__importAbort?.abort();
    setBusy(false);
  }

  function handleDialogClose() {
    abortPending();
    if (closeHandled.current) return;
    closeHandled.current = true;
    onClose();
  }

  function cancel() {
    abortPending();
    const dialog = ref.current;
    if (dialog?.open) dialog.close();
    else handleDialogClose();
  }

  const ready = entries.filter((entry) => entry.state === 'ready' && entry.draft);
  const selected = ready.filter((entry) => entry.selected);
  const canImport = selected.length > 0 && !busy && selected.every((entry) => entry.acknowledged
    && !!entry.draft
    && (!entry.targetId || profiles.some((profile) => profile.id === entry.targetId))
    && (!entry.draft.source.issues.length || entry.acknowledged)
    && (!entry.targetId || !profiles.find((profile) => profile.id === entry.targetId)?.source
      || !isLocallyModified(profiles.find((profile) => profile.id === entry.targetId)!)
      || !!entry.localEditDecision));

  function commit() {
    if (!canImport) return;
    try {
      const targets: LeagueImportTarget[] = selected.map((entry) => ({
        sourceIdentity: leagueIdentity(entry.draft!.source),
        profileId: entry.targetId || null,
        localEditDecision: entry.localEditDecision,
      }));
      const result = commitLeagueImports(selected.map((entry) => entry.draft!), targets);
      for (const entry of selected) track('league_import', { transport: entry.draft!.source.transport, mode: profiles.find((profile) => profile.id === entry.targetId)?.source ? 'refresh' : 'new', issues: entry.draft!.source.issues.length ? 'some' : 'none' });
      onImported(result.persisted
        ? t(($) => $.leagues.importLeagues.imported, { count: result.importedIds.length })
        : t(($) => $.leagues.importLeagues.importedSession, { count: result.importedIds.length }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(($) => $.leagues.importLeagues.saveFailed));
    }
  }

  return (
    <dialog ref={ref} aria-labelledby="import-title" onClose={handleDialogClose} {...backdropClose}>
      <DialogMascot />
      <div className="dlg import-dlg">
        <div className="dlg-head">
          <h2 id="import-title">{t(($) => $.leagues.importLeagues.title)}</h2>
          <button type="button" className="close" aria-label={t(($) => $.leagues.importLeagues.close)} onClick={cancel}>×</button>
        </div>
        <label className="field-label" data-camp="import-links">
          {t(($) => $.leagues.importLeagues.links)}
          <textarea ref={inputRef} rows={3} {...hint(t(($) => $.leagues.importLeagues.linksHint))} value={leagueInputs} disabled={busy} onChange={(event) => { setLeagueInputs(event.target.value); setEntries([]); setMessage(''); setError(''); }} placeholder={t(($) => $.leagues.importLeagues.linksPlaceholder)} />
        </label>
        <label className="field-label" data-camp="import-season">
          {t(($) => $.leagues.importLeagues.season)}
          <input type="number" min="2000" max="2100" step="1" {...hint(t(($) => $.leagues.importLeagues.seasonHint))} value={season} disabled={busy} onChange={(event) => { setSeason(event.target.value); setEntries([]); setMessage(''); setError(''); }} placeholder={t(($) => $.leagues.importLeagues.seasonPlaceholder)} />
        </label>
        <p className="muted">{t(($) => $.leagues.importLeagues.privacy)}</p>
        <button type="button" className="btn btn-primary" data-camp="import-load" {...hint(t(($) => $.leagues.importLeagues.loadHint))} onClick={() => void loadAll()} disabled={busy}>{t(($) => $.leagues.importLeagues.load)}</button>
        {(message || error) && <p className={error ? 'error msg' : 'muted msg'} role={error ? 'alert' : 'status'} aria-live="polite">{error || message}</p>}
        {entries.length > 0 && (
          <section className="import-results" aria-label={t(($) => $.leagues.importLeagues.results)}>
            {entries.map((entry) => {
              const draft = entry.draft;
              const cardId = `league-card-${encodeURIComponent(entry.key)}`;
              const leagueLabel = draft ? t(($) => $.leagues.importLeagues.leagueLabel, { league: draft.source.leagueId, season: draft.source.season }) : t(($) => $.leagues.importLeagues.leagueLabel, { league: entry.input.slice(0, 120), season });
              const existing = draft?.source ? profiles.find((profile) => profile.source && leagueIdentity(profile.source) === leagueIdentity(draft.source)) : undefined;
              const target = entry.targetId ? profiles.find((profile) => profile.id === entry.targetId) : undefined;
              const locallyModified = !!target && isLocallyModified(target);
              return (
                <article className="import-card" key={entry.key} aria-labelledby={`${cardId}-title`}>
                  <h3 id={`${cardId}-title`}>{draft?.name ?? t(($) => $.leagues.importLeagues.cardTitle, { league: entry.input.slice(0, 120) })}</h3>
                  {draft && (
                    <label className="import-select">
                      <input type="checkbox" aria-labelledby={`${cardId}-title ${cardId}-meta`} checked={entry.selected} onChange={(event) => upsert({ ...entry, selected: event.target.checked })} />
                      <span><small id={`${cardId}-meta`}>{t(($) => $.leagues.importLeagues.meta, { league: draft.source.leagueId, season: draft.source.season, transport: draft.source.transport === 'browser-session' ? t(($) => $.leagues.importLeagues.transportSession) : draft.source.transport === 'settings-file' ? t(($) => $.leagues.importLeagues.transportFile) : t(($) => $.leagues.importLeagues.transportPublic) })}</small></span>
                    </label>
                  )}
                  {entry.state === 'loading' && <p role="status">{t(($) => $.leagues.importLeagues.loadingLeague, { leagueLabel })}</p>}
                  {entry.state === 'error' && (
                    <div>
                      {!entry.needsAccess && <p className="error" role="status">{entry.error}</p>}
                      {entry.needsAccess && isConnectorConfigured() && <button type="button" className="btn" aria-label={t(($) => $.leagues.importLeagues.connectRetryLabel, { leagueLabel })} disabled={busy} onClick={() => {
                        const controller = new AbortController();
                        const dialog = ref.current as (HTMLDialogElement & { __importAbort?: AbortController }) | null;
                        if (dialog) dialog.__importAbort = controller;
                        setBusy(true);
                        void loadOne(entry.input, controller.signal, entry.selected).finally(() => setBusy(false));
                      }}>{t(($) => $.leagues.importLeagues.connectRetry)}</button>}
                      {entry.needsAccess && <PrivateLeagueHelp url={settingsUrl(entry.input, season)} what="settings" leagueLabel={leagueLabel} onImport={(text) => importPasted(entry, text)} />}
                    </div>
                  )}
                  {draft && (
                    <div className="import-preview">
                      <p className="muted">{t(($) => $.leagues.importLeagues.lineupSlots, { slots: summarizeLineup(draft.source.lineupSlotCounts) })}</p>
                      <p>{importedValues(draft).length ? importedValues(draft).join(' · ') : t(($) => $.leagues.importLeagues.noRules)}</p>
                      {existing && (
                        <label className="field-label">
                          {t(($) => $.leagues.importLeagues.target, { leagueLabel })}
                          <select value={entry.targetId} onChange={(event) => upsert({ ...entry, targetId: event.target.value, localEditDecision: undefined })}>
                            {profiles.filter((profile) => !profile.source || profile.id === existing.id).map((profile) => <option key={profile.id} value={profile.id}>{profile.id === existing.id ? t(($) => $.leagues.importLeagues.refreshTarget, { name: profile.name }) : t(($) => $.leagues.importLeagues.replaceTarget, { name: profile.name })}</option>)}
                          </select>
                        </label>
                      )}
                      {!existing && (
                        <label className="field-label">
                          {t(($) => $.leagues.importLeagues.target, { leagueLabel })}
                          <select value={entry.targetId} onChange={(event) => upsert({ ...entry, targetId: event.target.value, localEditDecision: undefined })}>
                            <option value="">{t(($) => $.leagues.importLeagues.newProfile)}</option>
                            {profiles.filter((profile) => !profile.source).map((profile) => <option key={profile.id} value={profile.id}>{t(($) => $.leagues.importLeagues.useTarget, { name: profile.name })}</option>)}
                          </select>
                        </label>
                      )}
                      {locallyModified && (
                        <label className="field-label">
                          {t(($) => $.leagues.importLeagues.localEdits, { leagueLabel })}
                          <select value={entry.localEditDecision ?? ''} onChange={(event) => upsert({ ...entry, localEditDecision: event.target.value as 'replace' | 'preserve' || undefined })}>
                            <option value="">{t(($) => $.leagues.importLeagues.chooseUpdate)}</option>
                            <option value="replace">{t(($) => $.leagues.importLeagues.replaceLocal)}</option>
                            <option value="preserve">{t(($) => $.leagues.importLeagues.keepLocal)}</option>
                          </select>
                        </label>
                      )}
                      {draft.source.issues.length > 0 && (
                        <fieldset className="import-issues">
                          <legend>{t(($) => $.leagues.importLeagues.compat, { leagueLabel, n: draft.source.issues.length })}</legend>
                          <ul>{draft.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issueText(issue)}</li>)}</ul>
                          <label><input type="checkbox" checked={entry.acknowledged} onChange={(event) => upsert({ ...entry, acknowledged: event.target.checked })} /> {t(($) => $.leagues.importLeagues.acknowledge, { leagueLabel })}</label>
                        </fieldset>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={cancel}>{t(($) => $.leagues.importLeagues.cancel)}</button>
          <button type="button" className="btn btn-primary" data-camp="import-commit" disabled={!canImport} onClick={commit}>{t(($) => $.leagues.importLeagues.commit, { n: selected.length })}</button>
        </div>
      </div>
    </dialog>
  );
}
