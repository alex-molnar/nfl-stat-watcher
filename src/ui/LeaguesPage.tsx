import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '../i18n';
import { FIELD_GROUPS, isRuleOn, stepLabel, type FieldDef, type GroupId } from '../scoring/fields';
import { PRESET_IDS, presetLabel } from '../scoring/presets';
import { POINTS_ALLOWED_TIERS, type PresetId, type Profile } from '../scoring/types';
import { followedStore, sideOf } from '../storage/followed';
import { newProfile, profilesStore } from '../storage/profiles';
import { withBand, withColor, withName, withPreset, withRuleEnabled, withStepPoints, withTier, withValue, withoutBands } from '../scoring/edit';
import { useStore } from '../storage/useStore';
import { Header } from './Header';
import { usePageTitle } from './usePageTitle';
import { textOn } from './format';
import { uniqueName } from '../scoring/uniqueName';
import { mascotEnabledStore } from '../storage/mascot';
import { DeleteLeagueDialog } from './DeleteLeagueDialog';
import { ExportProfileDialog } from './ExportProfileDialog';
import { ImportLeaguesDialog } from './ImportLeaguesDialog';
import { MascotSays } from './Mascot';
import { ImportProfileDialog } from './ImportProfileDialog';
import { disconnectLeagueSource, isLocallyModified } from '../leagues/import';
import { ESPN_SCORING_MAP_VERSION, issueText } from '../leagues/espn/statMap';

function NumberField({ label, value, step, onChange, enabled = true, onToggle, note }: {
  label: string; value: number; step: number; onChange: (n: number) => void;
  enabled?: boolean; onToggle?: (on: boolean) => void; note?: string;
}) {
  const { t } = useTranslation();
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
          <input type="checkbox" checked={enabled} aria-label={t(($) => $.leagues.numberField.count, { label })} onChange={(e) => onToggle(e.target.checked)} />
          <span aria-hidden="true">{enabled ? t(($) => $.leagues.numberField.on) : t(($) => $.leagues.numberField.off)}</span>
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
              setMsg(t(($) => $.leagues.numberField.restored, { value }));
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


const CORE_GROUPS: GroupId[] = ['offense', 'kicker', 'idp', 'teamDefense'];

function NameField({ profile, others, onName }: { profile: Profile; others: Profile[]; onName: (name: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(profile.name);
  const [msg, setMsg] = useState('');
  const msgId = useId();
  // Follow the working copy when it is reset (Cancel) without fighting what is being typed.
  useEffect(() => { if (profile.name !== text) setText(profile.name); }, [profile.name]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="field-wrap" data-camp="league-name">
      <label className="field-label">
        {t(($) => $.leagues.nameField.name)}
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
            if (!text.trim()) setMsg(t(($) => $.leagues.nameField.empty, { name }));
            else if (name !== text.trim()) setMsg(t(($) => $.leagues.nameField.taken, { name }));
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
  const { t } = useTranslation();
  return (
    <div className="color-row" data-camp="league-color">
      <label className="field-label color-field">
        {t(($) => $.leagues.colorField.color)}
        <input type="color" value={profile.color ?? '#2563eb'} onChange={(e) => onColor(e.target.value)} />
      </label>
      <span className="chip" aria-hidden="true" style={{ background: profile.color, color: profile.color ? textOn(profile.color) : undefined }}>{profile.name}</span>
    </div>
  );
}

/** Save and Cancel for the unsaved changes; shown on the left menu and at the end of the form while there are any. */
export function SaveActions({ label, onSave, onCancel }: { label: string; onSave: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="save-actions" role="group" aria-label={label}>
      <p className="muted save-note">{t(($) => $.leagues.saveActions.unsaved)}</p>
      <button type="button" className="btn btn-primary press" onClick={onSave}>{t(($) => $.leagues.saveActions.save)}</button>
      <button type="button" className="btn press" onClick={onCancel}>{t(($) => $.leagues.saveActions.cancel)}</button>
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
  const { t } = useTranslation();
  // Picking in the select changes nothing; only the Apply preset button asks for confirmation (WCAG 3.2.2).
  const [picked, setPicked] = useState<PresetId | null>(null);
  const preset: PresetId | 'custom' = picked ?? profile.preset;
  function applyPicked() {
    if (preset === 'custom') return;
    if (window.confirm(t(($) => $.leagues.form.applyConfirm, { name: profile.name, preset: presetLabel(preset) }))) {
      onEdit((p) => withPreset(p, preset));
    }
    setPicked(null); // cancel or apply: the select shows what the profile really uses
  }

  return (
    <section className="profile-form" aria-label={t(($) => $.leagues.form.edit, { name: profile.name })}>
      <NameField profile={profile} others={others} onName={(name) => onEdit((p) => withName(p, name))} />
      <ColorField profile={profile} onColor={(color) => onEdit((p) => withColor(p, color))} />
      <div className="preset-row">
        <label className="field-label" data-camp="league-preset">
          {t(($) => $.leagues.form.preset)}
          <select value={preset} onChange={(e) => setPicked(e.target.value as PresetId)}>
            {PRESET_IDS.map((id) => <option key={id} value={id}>{presetLabel(id)}</option>)}
            <option value="custom" disabled>{t(($) => $.leagues.form.custom)}</option>
          </select>
        </label>
        <button type="button" className="btn press" data-camp="league-apply" disabled={preset === 'custom' || preset === profile.preset} onClick={applyPicked}>{t(($) => $.leagues.form.applyPreset)}</button>
      </div>

      {FIELD_GROUPS.map((group) => {
        // Core boxes start open; the others start open only when the league scores something in them.
        const anyOn = group.fields.some((f) => profile.values[f.key] !== 0 && isRuleOn(profile.values, f.key));
        return (
          <Box key={group.id} title={group.title} defaultOpen={CORE_GROUPS.includes(group.id) || anyOn}>
            {group.fields.map((f: FieldDef) => (
              <NumberField
                key={f.key}
                label={f.label}
                step={f.step}
                value={profile.values[f.key]}
                enabled={isRuleOn(profile.values, f.key)}
                onToggle={(on) => onEdit((p) => withRuleEnabled(p, f.key, on))}
                note={profile.values[f.key] === 0 ? undefined : f.live === false ? t(($) => $.leagues.form.notLive) : f.approx ? t(($) => $.leagues.form.approx) : undefined}
                onChange={(n) => onEdit((p) => withValue(p, f.key, n))}
              />
            ))}
            {group.id === 'teamDefense' && !profile.values.pointsAllowedBands &&
              POINTS_ALLOWED_TIERS.map((tier, i) => (
                <NumberField key={tier} label={t(($) => $.leagues.form.tierPointsAllowed, { tier })} step={1} value={profile.values.pointsAllowed[i] ?? 0} onChange={(n) => onEdit((p) => withTier(p, i, n))} />
              ))}
          </Box>
        );
      })}

      {profile.values.steps && profile.values.steps.length > 0 && (
        <Box title={t(($) => $.leagues.form.steppedRules)}>
          {profile.values.steps.map((rule, index) => (
            <NumberField key={`${rule.stat}-${rule.every}`} label={stepLabel(rule)} step={0.5} value={rule.points} onChange={(n) => onEdit((p) => withStepPoints(p, index, n))} />
          ))}
          <p className="field-note">{t(($) => $.leagues.form.stepNote)}</p>
        </Box>
      )}

      {profile.values.pointsAllowedBands && (
        <Box title={t(($) => $.leagues.form.bandsTitle)}>
          {profile.values.pointsAllowedBands.map((band, index) => (
            <NumberField
              key={`${band.min}-${band.max ?? 'plus'}`}
              label={t(($) => $.leagues.form.bandPointsAllowed, { range: `${band.min}${band.max === null ? '+' : `-${band.max}`}` })}
              step={0.5}
              value={band.points}
              onChange={(points) => onEdit((p) => withBand(p, index, 'points', points))}
            />
          ))}
          <button type="button" className="btn" onClick={() => onEdit(withoutBands)}>{t(($) => $.leagues.form.standardTiers)}</button>
        </Box>
      )}

      {stored.source && (
        <section className="source-details" aria-label={t(($) => $.leagues.source.aria)}>
          <h3>{t(($) => $.leagues.source.heading)}</h3>
          <p>{t(($) => $.leagues.source.league, { leagueId: stored.source.leagueId, season: stored.source.season })}</p>
          <p>{t(($) => $.leagues.source.lastImported, { when: new Date(stored.source.importedAt).toLocaleString(i18n.language) })}</p>
          {isLocallyModified(stored) && <p className="source-modified" role="status">{t(($) => $.leagues.source.modified)}</p>}
          {stored.source.mappingVersion < ESPN_SCORING_MAP_VERSION && <p className="source-modified" role="status">{t(($) => $.leagues.source.oldMapping)}</p>}
          {stored.source.issues.length > 0 && (
            <details className="compat-warning">
              <summary>{t(($) => $.leagues.source.compat, { count: stored.source.issues.length })}</summary>
              <ul>{stored.source.issues.map((issue, index) => <li key={`${issue.providerKeys[0]}-${index}`}>{issueText(issue)}</li>)}</ul>
            </details>
          )}
          <div className="source-actions">
            <button type="button" className="btn" onClick={onRefresh}>{t(($) => $.leagues.source.refresh)}</button>
            <button type="button" className="btn" onClick={() => disconnectLeagueSource(stored.id)}>{t(($) => $.leagues.source.disconnect)}</button>
          </div>
        </section>
      )}

      {footer}
    </section>
  );
}

/** Delete league, in the left menu. Deleting is not an edit: it happens at once, after the dialog's question. */
function DeleteControl({ profile, profiles, usedBy, opponents, onDeleted }: { profile: Profile; profiles: Profile[]; usedBy: number; opponents: number; onDeleted: (nextId: string) => void }) {
  const { t } = useTranslation();
  const others = profiles.filter((p) => p.id !== profile.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="delete-control">
        <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
          {t(($) => $.leagues.page.deleteLeague)}
        </button>
      </div>
      <DeleteLeagueDialog open={open} onClose={() => setOpen(false)} profile={profile} others={others} mine={usedBy} opponents={opponents} onDeleted={onDeleted} />
    </>
  );
}

/** What can be edited and saved; everything else on a profile (its ESPN source, saved team) is left alone by Save. */
const editable = (p: Profile) => JSON.stringify({ name: p.name, color: p.color, preset: p.preset, values: p.values });

/** What the mascot says about a menu button while it is hovered or focused, when there is no league yet. */
type MenuHint = 'add' | 'import' | 'profile';

export function LeaguesPage() {
  const { t } = useTranslation();
  usePageTitle(t(($) => $.leagues.page.title));
  const profiles = useStore(profilesStore);
  const followed = useStore(followedStore);
  // No league is selected until the user picks one.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [hint, setHint] = useState<MenuHint | null>(null); // the menu button the mascot is explaining
  const [exportOpen, setExportOpen] = useState(false);
  const [importProfileOpen, setImportProfileOpen] = useState(false);
  const [refreshProfileId, setRefreshProfileId] = useState<string | undefined>();
  const [notice, setNotice] = useState('');
  const pendingImportNotice = useRef('');
  // "Add a league" starts a draft that is not in storage: Save adds it, Cancel throws it away.
  const [adding, setAdding] = useState<Profile | null>(null);
  const stored = profiles.find((p) => p.id === selectedId) ?? (adding?.id === selectedId ? adding : null);
  const isNew = !!stored && stored === adding;
  const inProfile = stored ? followed.filter((f) => f.profileId === stored.id) : [];
  const opponents = inProfile.filter((f) => sideOf(f) === 'opponent').length;

  // The working copy: edits go here, and only Save writes them. It starts over when another league is picked or the
  // saved league changes underneath it (an import or a refresh), so it can never show stale values.
  const [edit, setEdit] = useState<{ id: string; base: string; profile: Profile } | null>(null);
  const base = stored ? editable(stored) : null;
  if (stored && base !== null && (!edit || edit.id !== stored.id || edit.base !== base)) setEdit({ id: stored.id, base, profile: stored });
  const draft = stored && edit?.id === stored.id ? edit.profile : stored;
  const dirty = isNew || (!!stored && !!edit && edit.id === stored.id && editable(edit.profile) !== edit.base);
  const onEdit: Edit = (change) => setEdit((current) => (current ? { ...current, profile: change(current.profile) } : current));
  const others = stored ? profiles.filter((p) => p.id !== stored.id) : profiles;

  function save() {
    if (!stored || !draft) return;
    const taken = new Set(others.map((p) => p.name.toLowerCase()));
    const untitled = t(($) => $.leagues.defaults.untitled);
    let name = draft.name.trim() || untitled;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${draft.name.trim() || untitled} ${n}`;
    const saved = { ...stored, name, color: draft.color, preset: draft.preset, values: draft.values };
    profilesStore.set(isNew ? [...profilesStore.get(), saved] : profilesStore.get().map((p) => (p.id === stored.id ? saved : p)));
    if (isNew) setAdding(null);
    setNotice(t(($) => $.leagues.page.saved, { name }));
  }

  function cancel() {
    if (isNew) { setAdding(null); setSelectedId(null); return; }
    if (stored) setEdit({ id: stored.id, base: editable(stored), profile: stored });
  }

  /** Hover and keyboard focus both make the mascot explain a button, and leaving it puts the greeting back. */
  // With the mascot off the hints are tooltips instead, so they are still there for anyone who wants them.
  const mascotOn = useStore(mascotEnabledStore);
  const hintText = (key: MenuHint) => (key === 'add' ? t(($) => $.leagues.page.hintAdd) : key === 'import' ? t(($) => $.leagues.page.hintImport) : t(($) => $.leagues.page.hintProfile));
  const hintOn = (key: MenuHint) => (mascotOn
    ? { onMouseEnter: () => setHint(key), onMouseLeave: () => setHint(null), onFocus: () => setHint(key), onBlur: () => setHint(null) }
    : { title: hintText(key) });

  /** Leaving a league with unsaved changes asks first, so they are never lost by a stray click. */
  const mayLeave = () => !dirty || window.confirm(t(($) => $.leagues.page.discard, { name: stored?.name ?? '' }));

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
      <Header pageMascot={!stored} />
      <main className="wrap">
        <div className="settings-grid">
          {/* Sticky: the menu stays in view while the long form scrolls. */}
          <aside className="settings-side" aria-label={t(($) => $.leagues.page.profileActions)}>
            <h2 className="section-title" tabIndex={-1} data-page-title>{t(($) => $.leagues.page.title)}</h2>
            <h3 className="sr" id="profiles-heading">{t(($) => $.leagues.page.profiles)}</h3>
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
            <button type="button" className="btn press" data-camp="add-league" {...hintOn('add')} onClick={() => { if (mayLeave()) { const draft = newProfile(t(($) => $.leagues.defaults.newLeague), profiles); setAdding(draft); setSelectedId(draft.id); } }}>
              {t(($) => $.leagues.page.addLeague)}
            </button>
            <button type="button" className="btn press" data-camp="import-leagues" {...hintOn('import')} onClick={() => { setRefreshProfileId(undefined); setImportOpen(true); }}>
              {t(($) => $.leagues.page.importLeagues)}
            </button>
            <button type="button" className="btn press" {...hintOn('profile')} onClick={() => setImportProfileOpen(true)}>
              {t(($) => $.leagues.page.importProfile)}
            </button>
            <button type="button" className="btn press" aria-disabled={profiles.length === 0 || undefined} title={profiles.length === 0 ? t(($) => $.leagues.page.exportDisabled) : undefined} onClick={() => { if (profiles.length > 0) setExportOpen(true); }}>
              {t(($) => $.leagues.page.exportProfile)}
            </button>
            {stored && !isNew && <DeleteControl key={stored.id} profile={stored} profiles={profiles} usedBy={inProfile.length - opponents} opponents={opponents} onDeleted={(id) => { refocusProfile.current = id; setSelectedId(id); }} />}
            {dirty && <SaveActions label={t(($) => $.leagues.page.saveGroup)} onSave={save} onCancel={cancel} />}
          </aside>
          {stored && draft ? (
            <ProfileForm
              key={stored.id}
              profile={draft}
              stored={stored}
              others={others}
              onEdit={onEdit}
              onRefresh={() => { setRefreshProfileId(stored.id); setImportOpen(true); }}
              footer={dirty ? <SaveActions label={t(($) => $.leagues.page.saveGroupEnd)} onSave={save} onCancel={cancel} /> : null}
            />
          ) : (
            <MascotSays pointAt="left" minLines={6} text={hint ? hintText(hint) : profiles.length === 0 ? t(($) => $.leagues.page.noLeagues) : t(($) => $.leagues.page.selectLeague)} />
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
