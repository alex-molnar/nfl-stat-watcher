import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FIELD_GROUPS, STEP_LABELS, isRuleOn, type FieldDef } from '../scoring/fields';
import { PRESET_LABELS } from '../scoring/presets';
import { POINTS_ALLOWED_TIERS, type PresetId, type Profile } from '../scoring/types';
import { followedStore, sideOf } from '../storage/followed';
import { addProfile, deleteProfile, profilesStore } from '../storage/profiles';
import { withBand, withColor, withName, withPreset, withRuleEnabled, withStepPoints, withTier, withValue, withoutBands } from '../scoring/edit';
import { useStore } from '../storage/useStore';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';
import { textOn } from './format';
import { uniqueName } from '../scoring/uniqueName';
import { ExportProfileDialog } from './ExportProfileDialog';
import { ImportLeaguesDialog } from './ImportLeaguesDialog';
import { ImportProfileDialog } from './ImportProfileDialog';
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

function NameField({ profile, others, onName }: { profile: Profile; others: Profile[]; onName: (name: string) => void }) {
  const [text, setText] = useState(profile.name);
  const [msg, setMsg] = useState('');
  const msgId = useId();
  // Follow the working copy when it is reset (Cancel) without fighting what is being typed.
  useEffect(() => { if (profile.name !== text) setText(profile.name); }, [profile.name]); // eslint-disable-line react-hooks/exhaustive-deps
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
            // An empty name is never kept, so the profile always has an accessible name.
            if (e.target.value.trim()) onName(e.target.value);
          }}
          onBlur={() => {
            const name = uniqueName(text, others);
            if (!text.trim()) setMsg(`Name was empty. Using ${name}.`);
            else if (name !== text.trim()) setMsg(`That name is taken. Using ${name}.`);
            setText(name);
            onName(name);
          }}
        />
      </label>
      <span id={msgId} className="field-msg" role="status">{msg}</span>
    </div>
  );
}

/** The league's colour: the tag on its player cards. A native colour input, so it is keyboard and screen reader friendly. */
function ColorField({ profile, onColor }: { profile: Profile; onColor: (color: string) => void }) {
  return (
    <div className="color-row">
      <label className="field-label color-field">
        Color
        <input type="color" value={profile.color ?? '#2563eb'} onChange={(e) => onColor(e.target.value)} />
      </label>
      <span className="chip" aria-hidden="true" style={{ background: profile.color, color: profile.color ? textOn(profile.color) : undefined }}>{profile.name}</span>
    </div>
  );
}

/** Save and Cancel for the unsaved changes; shown on the left menu and at the end of the form while there are any. */
export function SaveActions({ label, onSave, onCancel }: { label: string; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="save-actions" role="group" aria-label={label}>
      <p className="muted save-note">Unsaved changes</p>
      <button type="button" className="btn btn-primary press" onClick={onSave}>Save</button>
      <button type="button" className="btn press" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/**
 * A settings box (a fieldset) that folds away. Its own title is the toggle, so there is no second selector above it, and
 * the folded box keeps its border and title. The fields stay in the working copy while folded.
 */
function Box({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <fieldset className={open ? undefined : 'is-collapsed'}>
      <legend>
        <button type="button" className="box-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
          <span className="box-chevron" aria-hidden="true" />
          {title}
        </button>
      </legend>
      <div id={bodyId} className="box-body" hidden={!open}>{children}</div>
    </fieldset>
  );
}

type Edit = (change: (p: Profile) => Profile) => void;

/** Edits the working copy of one profile. Nothing here touches storage: Save and Cancel are the page's. */
function ProfileForm({ profile, stored, others, onEdit, onRefresh, footer }: { profile: Profile; stored: Profile; others: Profile[]; onEdit: Edit; onRefresh: () => void; footer: ReactNode }) {
  // Picking in the select changes nothing; only the Apply preset button asks for confirmation (WCAG 3.2.2).
  const [picked, setPicked] = useState<PresetId | null>(null);
  const preset: PresetId | 'custom' = picked ?? profile.preset;
  function applyPicked() {
    if (preset === 'custom') return;
    if (window.confirm(`Replace all values in ${profile.name} with the ${PRESET_LABELS[preset]} preset? Nothing is kept until you save.`)) {
      onEdit((p) => withPreset(p, preset));
    }
    setPicked(null); // cancel or apply: the select shows what the profile really uses
  }

  return (
    <section className="profile-form" aria-label={`Edit ${profile.name}`}>
      <NameField profile={profile} others={others} onName={(name) => onEdit((p) => withName(p, name))} />
      <ColorField profile={profile} onColor={(color) => onEdit((p) => withColor(p, color))} />
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
        // Core boxes start open; the others start open only when the league scores something in them.
        const anyOn = group.fields.some((f) => profile.values[f.key] !== 0 && isRuleOn(profile.values, f.key));
        return (
          <Box key={group.title} title={group.title} defaultOpen={CORE_GROUPS.includes(group.title) || anyOn}>
            {group.fields.map((f: FieldDef) => (
              <NumberField
                key={f.key}
                label={f.label}
                step={f.step}
                value={profile.values[f.key]}
                enabled={isRuleOn(profile.values, f.key)}
                onToggle={(on) => onEdit((p) => withRuleEnabled(p, f.key, on))}
                note={profile.values[f.key] === 0 ? undefined : f.live === false ? 'Not tracked in the live game feed, so it never scores.' : f.approx ? 'Read from ESPN play-by-play wording, so it may be inaccurate.' : undefined}
                onChange={(n) => onEdit((p) => withValue(p, f.key, n))}
              />
            ))}
            {group.title === 'Team defense' && !profile.values.pointsAllowedBands &&
              POINTS_ALLOWED_TIERS.map((tier, i) => (
                <NumberField key={tier} label={`${tier} points allowed`} step={1} value={profile.values.pointsAllowed[i] ?? 0} onChange={(n) => onEdit((p) => withTier(p, i, n))} />
              ))}
          </Box>
        );
      })}

      {profile.values.steps && profile.values.steps.length > 0 && (
        <Box title="Stepped rules">
          {profile.values.steps.map((rule, index) => (
            <NumberField key={`${rule.stat}-${rule.every}`} label={`Every ${rule.every} ${STEP_LABELS[rule.stat]}`} step={0.5} value={rule.points} onChange={(n) => onEdit((p) => withStepPoints(p, index, n))} />
          ))}
          <p className="field-note">ESPN awards these in whole steps, so 40 passing yards earns one 25-yard step, not 1.6.</p>
        </Box>
      )}

      {profile.values.pointsAllowedBands && (
        <Box title="Team defense points allowed">
          {profile.values.pointsAllowedBands.map((band, index) => (
            <NumberField
              key={`${band.min}-${band.max ?? 'plus'}`}
              label={`${band.min}${band.max === null ? '+' : `-${band.max}`} points allowed`}
              step={0.5}
              value={band.points}
              onChange={(points) => onEdit((p) => withBand(p, index, 'points', points))}
            />
          ))}
          <button type="button" className="btn" onClick={() => onEdit(withoutBands)}>Use standard points-allowed tiers</button>
        </Box>
      )}

      {stored.source && (
        <section className="source-details" aria-label="Imported ESPN source">
          <h3>ESPN source</h3>
          <p>{`League ${stored.source.leagueId}, season ${stored.source.season}`}</p>
          <p>{`Last imported ${new Date(stored.source.importedAt).toLocaleString()}`}</p>
          {isLocallyModified(stored) && <p className="source-modified" role="status">Modified locally. Refresh will ask how to handle these values.</p>}
          {stored.source.mappingVersion < ESPN_SCORING_MAP_VERSION && <p className="source-modified" role="status">Imported with an older ESPN stat mapping that missed some rules. Refresh settings to apply the current one.</p>}
          {stored.source.issues.length > 0 && (
            <details className="compat-warning">
              <summary>{`Scoring compatibility (${stored.source.issues.length} ${stored.source.issues.length === 1 ? 'warning' : 'warnings'})`}</summary>
              <ul>{stored.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issue.message}</li>)}</ul>
            </details>
          )}
          <div className="source-actions">
            <button type="button" className="btn" onClick={onRefresh}>Refresh settings</button>
            <button type="button" className="btn" onClick={() => disconnectLeagueSource(stored.id)}>Disconnect source</button>
          </div>
        </section>
      )}

      {footer}
    </section>
  );
}

/** Delete profile and its confirmation, in the left menu. Deleting is not an edit: it happens at once, after the question. */
function DeleteControl({ profile, profiles, usedBy, opponents, onDeleted }: { profile: Profile; profiles: Profile[]; usedBy: number; opponents: number; onDeleted: (moveTo: string) => void }) {
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

  return (
    <>
      {!deleting && (
        <div className="delete-control">
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
    </>
  );
}

/** What can be edited and saved; everything else on a profile (its ESPN source, saved team) is left alone by Save. */
const editable = (p: Profile) => JSON.stringify({ name: p.name, color: p.color, preset: p.preset, values: p.values });

export function LeaguesPage() {
  usePageTitle('Leagues');
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  // No league is selected until the user picks one.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importProfileOpen, setImportProfileOpen] = useState(false);
  const [refreshProfileId, setRefreshProfileId] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  const pendingImportNotice = useRef('');
  const stored = profiles.find((p) => p.id === selectedId) ?? null;
  const inProfile = stored ? followed.filter((f) => f.profileId === stored.id) : [];
  const opponents = inProfile.filter((f) => sideOf(f) === 'opponent').length;

  // The working copy: edits go here, and only Save writes them. It starts over when another league is picked or the
  // saved league changes underneath it (an import or a refresh), so it can never show stale values.
  const [edit, setEdit] = useState<{ id: string; base: string; profile: Profile } | null>(null);
  const base = stored ? editable(stored) : null;
  if (stored && base !== null && (!edit || edit.id !== stored.id || edit.base !== base)) setEdit({ id: stored.id, base, profile: stored });
  const draft = stored && edit?.id === stored.id ? edit.profile : stored;
  const dirty = !!stored && !!edit && edit.id === stored.id && editable(edit.profile) !== edit.base;
  const onEdit: Edit = (change) => setEdit((current) => (current ? { ...current, profile: change(current.profile) } : current));
  const others = stored ? profiles.filter((p) => p.id !== stored.id) : profiles;

  function save() {
    if (!stored || !draft) return;
    const taken = new Set(others.map((p) => p.name.toLowerCase()));
    let name = draft.name.trim() || 'Untitled league';
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${draft.name.trim() || 'Untitled league'} ${n}`;
    profilesStore.set(profilesStore.get().map((p) => (p.id === stored.id ? { ...p, name, color: draft.color, preset: draft.preset, values: draft.values } : p)));
    setNotice(`Saved ${name}.`);
  }

  function cancel() {
    if (stored) setEdit({ id: stored.id, base: editable(stored), profile: stored });
  }

  /** Leaving a league with unsaved changes asks first, so they are never lost by a stray click. */
  const mayLeave = () => !dirty || window.confirm(`Discard the unsaved changes to ${stored?.name}?`);

  // The browser's own prompt for closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
        <div className="settings-grid">
          {/* Sticky: the menu stays in view while the long form scrolls. */}
          <aside className="settings-side" aria-label="Profile actions">
            <h2 className="section-title" tabIndex={-1} data-page-title>Leagues</h2>
            <h3 className="sr" id="profiles-heading">Profiles</h3>
            <ul className="profile-list" aria-labelledby="profiles-heading">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-profile={p.id}
                    aria-current={p.id === stored?.id ? 'true' : undefined}
                    onClick={() => { if (p.id !== stored?.id && mayLeave()) setSelectedId(p.id); }}
                  >
                    {p.color && <i className="profile-dot" style={{ background: p.color }} aria-hidden="true" />}{p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn press" onClick={() => { if (mayLeave()) setSelectedId(addProfile('New league')); }}>
              Add profile
            </button>
            <button type="button" className="btn press" onClick={() => { setRefreshProfileId(undefined); setImportOpen(true); }}>
              Import leagues
            </button>
            <button type="button" className="btn press" onClick={() => setImportProfileOpen(true)}>
              Import StatWatch profile
            </button>
            <button type="button" className="btn press" onClick={() => setExportOpen(true)}>
              Export profile
            </button>
            {stored && <DeleteControl key={stored.id} profile={stored} profiles={profiles} usedBy={inProfile.length - opponents} opponents={opponents} onDeleted={(id) => { refocusProfile.current = id; setSelectedId(id); }} />}
            {dirty && <SaveActions label="Save or cancel changes" onSave={save} onCancel={cancel} />}
          </aside>
          {stored && draft ? (
            <ProfileForm
              key={stored.id}
              profile={draft}
              stored={stored}
              others={others}
              onEdit={onEdit}
              onRefresh={() => { setRefreshProfileId(stored.id); setImportOpen(true); }}
              footer={dirty ? <SaveActions label="Save or cancel changes, end of form" onSave={save} onCancel={cancel} /> : null}
            />
          ) : (
            <section className="profile-form profile-empty" aria-label="No league selected">
              <p>Select a league on the left to edit its scoring, or add or import one.</p>
            </section>
          )}
        </div>
        <p className={notice ? 'page-note' : 'sr'} role="status" aria-live="polite">{notice}</p>
      </main>
      <ExportProfileDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportProfileDialog open={importProfileOpen} onClose={() => setImportProfileOpen(false)} onImported={(message) => { setImportProfileOpen(false); setNotice(message); }} />
      <ImportLeaguesDialog
        open={importOpen}
        refreshProfileId={refreshProfileId}
        onClose={closeImport}
        onImported={imported}
      />
    </>
  );
}
