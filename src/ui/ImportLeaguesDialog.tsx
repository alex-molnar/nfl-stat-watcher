import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { espnSettingsQueryKey, loadEspnLeagueSettings, EspnLoadError } from '../leagues/espn/client';
import { isConnectorConfigured } from '../leagues/espn/connection';
import { EspnSettingsError, parseEspnLeagueInput, parsePastedEspnSettings } from '../leagues/espn/parse';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { commitLeagueImports, isLocallyModified, leagueIdentity, type LeagueImportTarget } from '../leagues/import';
import type { EspnLeagueSettings, LeagueImportDraft } from '../leagues/types';
import { FIELD_GROUPS, STEP_LABELS } from '../scoring/fields';
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
  return active.length ? active.map(([id, count]) => `slot ${id} × ${count}`).join(', ') : 'No active lineup slots listed';
}

function importedValues(draft: LeagueImportDraft): string[] {
  const values: string[] = [];
  for (const group of FIELD_GROUPS) {
    for (const field of group.fields) {
      const points = draft.values[field.key];
      if (points !== 0) values.push(`${field.label}: ${points}`);
    }
  }
  for (const rule of draft.values.steps ?? []) values.push(`Every ${rule.every} ${STEP_LABELS[rule.stat]}: ${rule.points}`);
  if (draft.values.pointsAllowedBands) values.push(`${draft.values.pointsAllowedBands.length} D/ST points-allowed ranges`);
  else if (draft.values.pointsAllowed.some((points) => points !== 0)) values.push('D/ST points-allowed scoring');
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

/** Private leagues need the user's own ESPN session, which the app never sees: the user copies the page text across. */
function PrivateLeagueHelp({ input, season, leagueLabel, onImport }: { input: string; season: string; leagueLabel: string; onImport: (text: string) => string | null }) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const url = settingsUrl(input, season);
  return (
    <details className="private-help" open>
      <summary>Import {leagueLabel} from your own ESPN session</summary>
      <ol>
        <li>Stay signed in to ESPN in this browser{url ? <>, then <a href={url} target="_blank" rel="noreferrer">open this league’s settings data</a> in a new tab</> : ''}.</li>
        <li>Select everything on that page (Cmd or Ctrl plus A), copy it and paste it below. Only scoring and lineup settings are kept; nothing leaves your browser.</li>
      </ol>
      <label className="field-label">
        Settings JSON for {leagueLabel}
        <textarea rows={4} value={text} onChange={(event) => { setText(event.target.value); setProblem(''); }} placeholder="Paste the copied ESPN settings here" />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      <button type="button" className="btn" disabled={!text.trim()} onClick={() => setProblem(onImport(text) ?? '')}>Use pasted settings for {leagueLabel}</button>
    </details>
  );
}

export function ImportLeaguesDialog({ open, onClose, onImported, refreshProfileId }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [leagueInputs, setLeagueInputs] = useState('');
  const [season, setSeason] = useState('');
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
      if (!requestedSeason) throw new Error('Choose a season before loading leagues.');
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
    } catch (cause) {
      if (signal?.aborted) return;
      const text = cause instanceof Error ? cause.message : 'Could not load this league.';
      upsert({ key, input: value, state: 'error', error: text, needsAccess: cause instanceof EspnLoadError && cause.kind === 'access-denied', selected, acknowledged: false, targetId: '' });
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
      return cause instanceof EspnSettingsError || cause instanceof Error ? cause.message : 'Could not read those settings.';
    }
  }

  async function loadAll() {
    const inputs = leagueInputs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!/^\d{4}$/.test(season)) {
      setError('Choose a season to load these leagues.');
      return;
    }
    if (inputs.length === 0) {
      setError('Paste at least one ESPN league link or ID.');
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
    setMessage(`Loading ${unique.length} ${unique.length === 1 ? 'league' : 'leagues'}…`);
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
    if (!controller.signal.aborted) setMessage('Review each loaded league, then import the selected profiles.');
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
      onImported(result.persisted
        ? `Imported ${result.importedIds.length} ${result.importedIds.length === 1 ? 'league' : 'leagues'} and saved the profiles.`
        : `Imported ${result.importedIds.length} ${result.importedIds.length === 1 ? 'league' : 'leagues'} for this session; browser storage could not save them.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save these profiles.');
    }
  }

  return (
    <dialog ref={ref} aria-labelledby="import-title" onClose={handleDialogClose}>
      <div className="dlg import-dlg">
        <div className="dlg-head">
          <h2 id="import-title">Import ESPN leagues</h2>
          <button type="button" className="close" aria-label="Close import leagues dialog" onClick={cancel}>×</button>
        </div>
        <label className="field-label">
          ESPN fantasy football league links or IDs, one per line
          <textarea ref={inputRef} rows={3} value={leagueInputs} disabled={busy} onChange={(event) => { setLeagueInputs(event.target.value); setEntries([]); setMessage(''); setError(''); }} placeholder="Paste league links or decimal IDs" />
        </label>
        <label className="field-label">
          Season
          <input type="number" min="2000" max="2100" step="1" value={season} disabled={busy} onChange={(event) => { setSeason(event.target.value); setEntries([]); setMessage(''); setError(''); }} placeholder="For example, 2026" />
        </label>
        <p className="muted">Public settings load anonymously. For a private league you copy its settings page across from your own signed-in ESPN tab; Stat Watch never asks for your ESPN password.</p>
        <button type="button" className="btn btn-primary" onClick={() => void loadAll()} disabled={busy}>Load leagues</button>
        {(message || error) && <p className={error ? 'error msg' : 'muted msg'} role={error ? 'alert' : 'status'} aria-live="polite">{error || message}</p>}
        {entries.length > 0 && (
          <section className="import-results" aria-label="League import results">
            {entries.map((entry) => {
              const draft = entry.draft;
              const cardId = `league-card-${encodeURIComponent(entry.key)}`;
              const leagueLabel = draft ? `league ${draft.source.leagueId}, season ${draft.source.season}` : `league ${entry.input.slice(0, 120)}, season ${season}`;
              const existing = draft?.source ? profiles.find((profile) => profile.source && leagueIdentity(profile.source) === leagueIdentity(draft.source)) : undefined;
              const target = entry.targetId ? profiles.find((profile) => profile.id === entry.targetId) : undefined;
              const locallyModified = !!target && isLocallyModified(target);
              return (
                <article className="import-card" key={entry.key} aria-labelledby={`${cardId}-title`}>
                  <h3 id={`${cardId}-title`}>{draft?.name ?? `League ${entry.input.slice(0, 120)}`}</h3>
                  {draft && (
                    <label className="import-select">
                      <input type="checkbox" aria-labelledby={`${cardId}-title ${cardId}-meta`} checked={entry.selected} onChange={(event) => upsert({ ...entry, selected: event.target.checked })} />
                      <span><small id={`${cardId}-meta`}>League {draft.source.leagueId} · Season {draft.source.season} · {draft.source.transport === 'browser-session' ? 'Connected ESPN session' : draft.source.transport === 'settings-file' ? 'Settings file' : 'Public settings'}</small></span>
                    </label>
                  )}
                  {entry.state === 'loading' && <p role="status">Loading {leagueLabel}…</p>}
                  {entry.state === 'error' && (
                    <div>
                      <p className="error" role="status">{entry.error}</p>
                      {entry.needsAccess && isConnectorConfigured() && <button type="button" className="btn" aria-label={`Connect ESPN and retry ${leagueLabel}`} disabled={busy} onClick={() => {
                        const controller = new AbortController();
                        const dialog = ref.current as (HTMLDialogElement & { __importAbort?: AbortController }) | null;
                        if (dialog) dialog.__importAbort = controller;
                        setBusy(true);
                        void loadOne(entry.input, controller.signal, entry.selected).finally(() => setBusy(false));
                      }}>Connect ESPN and retry</button>}
                      {entry.needsAccess && <PrivateLeagueHelp input={entry.input} season={season} leagueLabel={leagueLabel} onImport={(text) => importPasted(entry, text)} />}
                    </div>
                  )}
                  {draft && (
                    <div className="import-preview">
                      <p className="muted">Lineup slots: {summarizeLineup(draft.source.lineupSlotCounts)}</p>
                      <p>{importedValues(draft).length ? importedValues(draft).join(' · ') : 'No scoring rules map directly to this site’s scoring fields.'}</p>
                      {existing && (
                        <label className="field-label">
                          Import target for {leagueLabel}
                          <select value={entry.targetId} onChange={(event) => upsert({ ...entry, targetId: event.target.value, localEditDecision: undefined })}>
                            {profiles.filter((profile) => !profile.source || profile.id === existing.id).map((profile) => <option key={profile.id} value={profile.id}>{profile.id === existing.id ? `Refresh ${profile.name}` : `Replace ${profile.name}`}</option>)}
                          </select>
                        </label>
                      )}
                      {!existing && (
                        <label className="field-label">
                          Import target for {leagueLabel}
                          <select value={entry.targetId} onChange={(event) => upsert({ ...entry, targetId: event.target.value, localEditDecision: undefined })}>
                            <option value="">Create a new profile</option>
                            {profiles.filter((profile) => !profile.source).map((profile) => <option key={profile.id} value={profile.id}>Use {profile.name}</option>)}
                          </select>
                        </label>
                      )}
                      {locallyModified && (
                        <label className="field-label">
                          This profile has local scoring edits for {leagueLabel}. Choose what to do
                          <select value={entry.localEditDecision ?? ''} onChange={(event) => upsert({ ...entry, localEditDecision: event.target.value as 'replace' | 'preserve' || undefined })}>
                            <option value="">Choose an update</option>
                            <option value="replace">Replace local values with ESPN settings</option>
                            <option value="preserve">Keep my local values and update the source snapshot</option>
                          </select>
                        </label>
                      )}
                      {draft.source.issues.length > 0 && (
                        <fieldset className="import-issues">
                          <legend>Scoring compatibility for {leagueLabel} ({draft.source.issues.length})</legend>
                          <ul>{draft.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issue.message}</li>)}</ul>
                          <label><input type="checkbox" checked={entry.acknowledged} onChange={(event) => upsert({ ...entry, acknowledged: event.target.checked })} /> Import the approximate profile for {leagueLabel} and keep these warnings visible</label>
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
          <button type="button" className="btn" onClick={cancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!canImport} onClick={commit}>Import selected leagues ({selected.length})</button>
        </div>
      </div>
    </dialog>
  );
}
