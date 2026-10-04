import { useEffect, useId, useRef, useState } from 'react';
import { FIELD_GROUPS, isRuleOn, type FieldDef } from '../scoring/fields';
import { PRESET_LABELS } from '../scoring/presets';
import { POINTS_ALLOWED_TIERS, type PresetId, type Profile } from '../scoring/types';
import { followedStore, sideOf } from '../storage/followed';
import { addProfile, applyPreset, clearPointsAllowedBands, deleteProfile, profilesStore, renameProfile, setPointsAllowedBand, setRuleEnabled, setTier, setValue } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';
import { ImportLeaguesDialog } from './ImportLeaguesDialog';
import { disconnectLeagueSource, isLocallyModified } from '../leagues/import';
import { ESPN_SCORING_MAP_VERSION } from '../leagues/espn/statMap';

function NumberField({ label, value, step, onChange, enabled = true, onToggle, note }: {
  label: string; value: number; step: number; onChange: (n: number) => void;
  enabled?: boolean; onToggle?: (on: boolean) => void; note?: string;
}) {
  const [text, setText] = useState(String(value));
  const [msg, setMsg] = useState('');
  const msgId = useId();
  // Follow outside changes (presets) without fighting partial input such as "0." or "".
  useEffect(() => {
    if (Number.parseFloat(text) !== value) {
      setText(String(value));
      setMsg(''); // a message about the old value would be stale
    }
  }, [value]);
  return (
    <div className="num-field">
      {onToggle && (
        <label className="rule-toggle">
          <input type="checkbox" checked={enabled} aria-label={`Count ${label}`} onChange={(e) => onToggle(e.target.checked)} />
          <span aria-hidden="true">{enabled ? 'On' : 'Off'}</span>
        </label>
      )}
      <label>
        {label}
        <input
          type="number"
          disabled={!enabled}
          aria-describedby={[msg ? msgId : '', note ? `${msgId}-note` : ''].filter(Boolean).join(' ') || undefined}
          inputMode="decimal"
          step={step}
          value={text}
          onBlur={() => {
            if (!Number.isFinite(Number.parseFloat(text))) {
              setText(String(value));
              setMsg(`Enter a number. Restored ${value}.`);
            }
          }}
          onChange={(e) => {
            setMsg('');
            setText(e.target.value);
            const n = Number.parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
      </label>
      {note && <span id={`${msgId}-note`} className="field-note">{note}</span>}
      <span id={msgId} className="field-msg" role="status">{msg}</span>
    </div>
  );
}

const CORE_GROUPS = ['Offense', 'Kicker', 'IDP', 'Team defense'];

function uniqueName(raw: string, others: Profile[]): string {
  const base = raw.trim() || 'Untitled league';
  const taken = new Set(others.map((p) => p.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
  return name;
}

function NameField({ profile, others }: { profile: Profile; others: Profile[] }) {
  const [text, setText] = useState(profile.name);
  const [msg, setMsg] = useState('');
  const msgId = useId();
  return (
    <div className="field-wrap">
      <label className="field-label">
        Name
        <input
          value={text}
          aria-describedby={msg ? msgId : undefined}
          onChange={(e) => {
            setMsg('');
            setText(e.target.value);
            // An empty name is never stored, so the profile always has an accessible name.
            if (e.target.value.trim()) renameProfile(profile.id, e.target.value);
          }}
          onBlur={() => {
            const name = uniqueName(text, others);
            if (!text.trim()) setMsg(`Name was empty. Using ${name}.`);
            else if (name !== text.trim()) setMsg(`That name is taken. Using ${name}.`);
            setText(name);
            renameProfile(profile.id, name);
          }}
        />
      </label>
      <span id={msgId} className="field-msg" role="status">{msg}</span>
    </div>
  );
}

function ProfileForm({ profile, profiles, usedBy, opponents, onDeleted, onRefresh }: { profile: Profile; profiles: Profile[]; usedBy: number; opponents: number; onDeleted: (moveTo: string) => void; onRefresh: () => void }) {
  const others = profiles.filter((p) => p.id !== profile.id);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  // Set by the click handlers only, so mounting (or StrictMode re-running effects) never moves focus.
  const pendingFocus = useRef<'confirm' | 'delete' | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'confirm') (confirmRef.current?.querySelector<HTMLElement>('select') ?? cancelBtn.current)?.focus();
    if (target === 'delete') deleteBtn.current?.focus();
  }, [deleting]);

  // Picking in the select changes nothing; only the Apply preset button asks for confirmation (WCAG 3.2.2).
  const [picked, setPicked] = useState<PresetId | null>(null);
  const preset: PresetId | 'custom' = picked ?? profile.preset;
  function applyPicked() {
    if (preset === 'custom') return;
    if (window.confirm(`Replace all values in ${profile.name} with the ${PRESET_LABELS[preset]} preset?`)) {
      applyPreset(profile.id, preset);
    }
    setPicked(null); // cancel or apply: the select shows what the profile really uses
  }

  return (
    <section className="profile-form" aria-label={`Edit ${profile.name}`}>
      <NameField profile={profile} others={others} />
      <div className="preset-row">
        <label className="field-label">
          Preset
          <select value={preset} onChange={(e) => setPicked(e.target.value as PresetId)}>
            {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => <option key={id} value={id}>{PRESET_LABELS[id]}</option>)}
            <option value="custom" disabled>Custom</option>
          </select>
        </label>
        <button type="button" className="btn press" disabled={preset === 'custom' || preset === profile.preset} onClick={applyPicked}>Apply preset</button>
      </div>

      {FIELD_GROUPS.map((group) => {
        const rows = (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.fields.map((f: FieldDef) => (
              <NumberField
                key={f.key}
                label={f.label}
                step={f.step}
                value={profile.values[f.key]}
                enabled={isRuleOn(profile.values, f.key)}
                onToggle={(on) => setRuleEnabled(profile.id, f.key, on)}
                note={f.live === false && profile.values[f.key] !== 0 ? 'Not tracked in the live game feed, so it never scores.' : undefined}
                onChange={(n) => setValue(profile.id, f.key, n)}
              />
            ))}
            {group.title === 'Team defense' && !profile.values.pointsAllowedBands &&
              POINTS_ALLOWED_TIERS.map((tier, i) => (
                <NumberField key={tier} label={`${tier} points allowed`} step={1} value={profile.values.pointsAllowed[i] ?? 0} onChange={(n) => setTier(profile.id, i, n)} />
              ))}
          </fieldset>
        );
        if (CORE_GROUPS.includes(group.title)) return rows;
        const anyOn = group.fields.some((f) => profile.values[f.key] !== 0 && isRuleOn(profile.values, f.key));
        return (
          <details key={group.title} className="rule-group" open={anyOn}>
            <summary>{group.title}</summary>
            {rows}
          </details>
        );
      })}

      {profile.values.pointsAllowedBands && (
        <fieldset>
          <legend>Team defense points allowed</legend>
          {profile.values.pointsAllowedBands.map((band, index) => (
            <NumberField
              key={`${band.min}-${band.max ?? 'plus'}`}
              label={`${band.min}${band.max === null ? '+' : `-${band.max}`} points allowed`}
              step={0.5}
              value={band.points}
              onChange={(points) => setPointsAllowedBand(profile.id, index, 'points', points)}
            />
          ))}
          <button type="button" className="btn" onClick={() => clearPointsAllowedBands(profile.id)}>Use standard points-allowed tiers</button>
        </fieldset>
      )}

      {profile.source && (
        <section className="source-details" aria-label="Imported ESPN source">
          <h3>ESPN source</h3>
          <p>{`League ${profile.source.leagueId}, season ${profile.source.season}`}</p>
          <p>{`Last imported ${new Date(profile.source.importedAt).toLocaleString()}`}</p>
          {isLocallyModified(profile) && <p className="source-modified" role="status">Modified locally. Refresh will ask how to handle these values.</p>}
          {profile.source.mappingVersion < ESPN_SCORING_MAP_VERSION && <p className="source-modified" role="status">Imported with an older ESPN stat mapping that missed some rules. Refresh settings to apply the current one.</p>}
          {profile.source.issues.length > 0 && (
            <details className="compat-warning">
              <summary>{`Scoring compatibility (${profile.source.issues.length} ${profile.source.issues.length === 1 ? 'warning' : 'warnings'})`}</summary>
              <ul>{profile.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issue.message}</li>)}</ul>
            </details>
          )}
          <div className="source-actions">
            <button type="button" className="btn" onClick={onRefresh}>Refresh settings</button>
            <button type="button" className="btn" onClick={() => disconnectLeagueSource(profile.id)}>Disconnect source</button>
          </div>
        </section>
      )}

      {!deleting && (
        <div>
          <button ref={deleteBtn} type="button" className="btn btn-danger" disabled={others.length === 0} aria-describedby={others.length === 0 ? 'last-profile-note' : undefined} onClick={() => {
              pendingFocus.current = 'confirm';
              setDeleting(true);
            }}>
            Delete profile
          </button>
          {others.length === 0 && <p id="last-profile-note" className="muted">You need at least one profile.</p>}
        </div>
      )}
      {deleting && (
        <div ref={confirmRef} className="confirm" role="group" aria-label="Confirm delete">
          {usedBy > 0 ? (
            <label className="field-label">
              {`Move ${usedBy} followed ${usedBy === 1 ? 'card' : 'cards'} to`}
              <select value={moveTo} aria-describedby={opponents > 0 ? 'confirm-opponents' : undefined} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <p id="confirm-question">Delete {profile.name}? None of your cards use it.</p>
          )}
          {/* Opponent cards belong to this league, so they are removed with it, never moved. */}
          {opponents > 0 && <p id="confirm-opponents">{`Also removes ${opponents} opponent ${opponents === 1 ? 'card' : 'cards'}.`}</p>}
          <button
            type="button"
            className="btn btn-danger"
            aria-describedby={[usedBy > 0 ? '' : 'confirm-question', opponents > 0 ? 'confirm-opponents' : ''].filter(Boolean).join(' ') || undefined}
            onClick={() => {
              if (deleteProfile(profile.id, moveTo)) onDeleted(moveTo);
            }}
          >
            Delete {profile.name}
          </button>
          <button
            ref={cancelBtn}
            type="button"
            aria-describedby={[usedBy > 0 ? '' : 'confirm-question', opponents > 0 ? 'confirm-opponents' : ''].filter(Boolean).join(' ') || undefined}
            className="btn"
            onClick={() => {
              pendingFocus.current = 'delete';
              setDeleting(false);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  usePageTitle('Settings');
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  const [selectedId, setSelectedId] = useState(profiles[0]!.id);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshProfileId, setRefreshProfileId] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  const pendingImportNotice = useRef('');
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0]!;
  const inProfile = followed.filter((f) => f.profileId === profile.id);
  const opponents = inProfile.filter((f) => sideOf(f) === 'opponent').length;

  // After a delete the removed list button is gone, so focus the newly selected profile.
  const refocusProfile = useRef<string | null>(null);
  useEffect(() => {
    const id = refocusProfile.current;
    refocusProfile.current = null;
    if (id) document.querySelector<HTMLElement>(`[data-profile="${CSS.escape(id)}"]`)?.focus();
  });

  function closeImport() {
    setImportOpen(false);
    setRefreshProfileId(undefined);
    if (pendingImportNotice.current) {
      setNotice(pendingImportNotice.current);
      pendingImportNotice.current = '';
    }
  }

  function imported(message: string) {
    pendingImportNotice.current = message;
    setImportOpen(false);
    setRefreshProfileId(undefined);
  }

  return (
    <>
      <Header />
      <main className="wrap">
        <h2 className="section-title" tabIndex={-1} data-page-title>Scoring profiles</h2>
        <div className="settings-grid">
          <div>
            <h3 className="sr" id="profiles-heading">Profiles</h3>
            <ul className="profile-list" aria-labelledby="profiles-heading">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button type="button" data-profile={p.id} aria-current={p.id === profile.id ? 'true' : undefined} onClick={() => setSelectedId(p.id)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn press" onClick={() => setSelectedId(addProfile('New league'))}>
              Add profile
            </button>
            <button type="button" className="btn press" onClick={() => { setRefreshProfileId(undefined); setImportOpen(true); }}>
              Import leagues
            </button>
          </div>
          <ProfileForm
            key={profile.id}
            profile={profile}
            profiles={profiles}
            usedBy={inProfile.length - opponents}
            opponents={opponents}
            onRefresh={() => { setRefreshProfileId(profile.id); setImportOpen(true); }}
            onDeleted={(id) => {
              refocusProfile.current = id;
              setSelectedId(id);
            }}
          />
        </div>
        <p className={notice ? 'page-note' : 'sr'} role="status" aria-live="polite">{notice}</p>
      </main>
      <ImportLeaguesDialog
        open={importOpen}
        refreshProfileId={refreshProfileId}
        onClose={closeImport}
        onImported={imported}
      />
    </>
  );
}
