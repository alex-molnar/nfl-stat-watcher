import { useEffect, useRef, useState } from 'react';
import { FIELD_GROUPS } from '../scoring/fields';
import { PRESET_LABELS } from '../scoring/presets';
import { POINTS_ALLOWED_TIERS, type PresetId, type Profile } from '../scoring/types';
import { followedStore } from '../storage/followed';
import { addProfile, applyPreset, deleteProfile, profilesStore, renameProfile, setTier, setValue } from '../storage/profiles';
import { useStore } from '../storage/useStore';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (presets) without fighting partial input such as "0." or "".
  useEffect(() => {
    if (Number.parseFloat(text) !== value) setText(String(value));
  }, [value]);
  return (
    <label className="num-field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={text}
        onBlur={() => {
          if (!Number.isFinite(Number.parseFloat(text))) setText(String(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

function uniqueName(raw: string, others: Profile[]): string {
  const base = raw.trim() || 'Untitled league';
  const taken = new Set(others.map((p) => p.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
  return name;
}

function NameField({ profile, others }: { profile: Profile; others: Profile[] }) {
  const [text, setText] = useState(profile.name);
  return (
    <label className="field-label">
      Name
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // An empty name is never stored, so the profile always has an accessible name.
          if (e.target.value.trim()) renameProfile(profile.id, e.target.value);
        }}
        onBlur={() => {
          const name = uniqueName(text, others);
          setText(name);
          renameProfile(profile.id, name);
        }}
      />
    </label>
  );
}

function ProfileForm({ profile, profiles, usedBy, onDeleted }: { profile: Profile; profiles: Profile[]; usedBy: number; onDeleted: (moveTo: string) => void }) {
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

  function choosePreset(preset: PresetId) {
    if (window.confirm(`Replace all values in ${profile.name} with the ${PRESET_LABELS[preset]} preset?`)) applyPreset(profile.id, preset);
  }

  return (
    <section className="profile-form" aria-label={`Edit ${profile.name}`}>
      <NameField profile={profile} others={others} />
      <label className="field-label">
        Preset
        <select value={profile.preset} onChange={(e) => choosePreset(e.target.value as PresetId)}>
          {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => <option key={id} value={id}>{PRESET_LABELS[id]}</option>)}
          <option value="custom" disabled>Custom</option>
        </select>
      </label>

      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          {group.fields.map((f) => (
            <NumberField key={f.key} label={f.label} step={f.step} value={profile.values[f.key]} onChange={(n) => setValue(profile.id, f.key, n)} />
          ))}
          {group.title === 'Team defense' &&
            POINTS_ALLOWED_TIERS.map((tier, i) => (
              <NumberField key={tier} label={`${tier} points allowed`} step={1} value={profile.values.pointsAllowed[i] ?? 0} onChange={(n) => setTier(profile.id, i, n)} />
            ))}
        </fieldset>
      ))}

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
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <p>Delete {profile.name}? No followed cards use it.</p>
          )}
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (deleteProfile(profile.id, moveTo)) onDeleted(moveTo);
            }}
          >
            Delete {profile.name}
          </button>
          <button
            ref={cancelBtn}
            type="button"
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
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0]!;

  return (
    <>
      <Header />
      <main className="wrap">
        <h2 className="section-title">Scoring profiles</h2>
        <div className="settings-grid">
          <nav aria-label="Profiles">
            <ul className="profile-list">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-current={p.id === profile.id ? 'true' : undefined} onClick={() => setSelectedId(p.id)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn press" onClick={() => setSelectedId(addProfile('New league'))}>
              Add profile
            </button>
          </nav>
          <ProfileForm
            key={profile.id}
            profile={profile}
            profiles={profiles}
            usedBy={followed.filter((f) => f.profileId === profile.id).length}
            onDeleted={setSelectedId}
          />
        </div>
      </main>
    </>
  );
}
