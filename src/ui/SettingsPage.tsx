import { useEffect, useRef, useState } from 'react';
import { NAME_DISPLAY_MODES, nameDisplayStore, type NameDisplayMode } from '../storage/nameDisplay';
import { CAMP_KEY } from '../storage/camp';
import { DEFAULT_MASCOT_NAME, MAX_MASCOT_NAME, mascotEnabledStore, mascotNameStore } from '../storage/mascot';
import { startCamp } from '../storage/camp';
import { reloadAllStores } from '../storage/store';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { Header } from './Header';
import { SaveActions } from './LeaguesPage';
import { usePageTitle } from './usePageTitle';
import { DEFAULT_POSITION_ORDER, type PositionGroup } from '../stats/positionOrder';
import { positionOrderStore } from '../storage/positionOrder';
import { PositionOrderInput } from './PositionOrderInput';
import { bookmarkHelpStore } from '../storage/bookmarkHelp';

const MODE_LABELS: Record<NameDisplayMode, string> = { full: 'Full', initial: 'Initial', formal: 'Formal' };
const MODE_EXAMPLES: Record<NameDisplayMode, string> = { full: 'David Montgomery', initial: 'D. Montgomery', formal: 'Montgomery, David' };
type SettingsDraft = { mode: NameDisplayMode; mascot: boolean; name: string; positions: PositionGroup[]; bookmarkHelp: boolean };
const CATEGORIES = ['General', 'Position order', 'Site settings'] as const;
type Category = (typeof CATEGORIES)[number];

/** App-wide preferences. Like a league, changes wait in a working copy until Save. */
export function SettingsPage() {
  usePageTitle('Settings');
  const hint = useHint();
  const stored = useStore(nameDisplayStore);
  const storedMascot = useStore(mascotEnabledStore);
  const storedName = useStore(mascotNameStore);
  const storedPositions = useStore(positionOrderStore);
  const storedBookmarkHelp = useStore(bookmarkHelpStore);
  const [category, setCategory] = useState<Category>('General');
  const [draft, setDraft] = useState<SettingsDraft | null>(null); // null: no unsaved change
  const [notice, setNotice] = useState('');
  const confirmRef = useRef<HTMLDialogElement>(null);
  const mode = draft?.mode ?? stored;
  const mascot = draft?.mascot ?? storedMascot;
  const name = draft?.name ?? storedName;
  const positions = draft?.positions ?? storedPositions;
  const bookmarkHelp = draft?.bookmarkHelp ?? storedBookmarkHelp;
  const change = (patch: Partial<SettingsDraft>) => setDraft({ mode, mascot, name, positions, bookmarkHelp, ...patch });
  const dirty = mode !== stored || mascot !== storedMascot || name.trim() !== storedName || positions.some((p, i) => p !== storedPositions[i]) || bookmarkHelp !== storedBookmarkHelp;

  // The browser's own prompt for closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function save() {
    nameDisplayStore.set(mode);
    mascotEnabledStore.set(mascot);
    mascotNameStore.set(name.trim() || DEFAULT_MASCOT_NAME);
    positionOrderStore.set([...positions]);
    bookmarkHelpStore.set(bookmarkHelp);
    setDraft(null);
    setNotice('Saved settings.');
  }

  function clearData() {
    confirmRef.current?.close();
    try {
      // How far the user got in Rookie camp is kept: wiping it would offer the training camp again straight after, and it can be started from here any time.
      const camp = localStorage.getItem(CAMP_KEY);
      localStorage.clear();
      if (camp !== null) localStorage.setItem(CAMP_KEY, camp);
    } catch {
      setNotice('Could not clear your data: browser storage is blocked.');
      return;
    }
    reloadAllStores(); // every store falls back to its defaults, so the open app matches the empty storage
    setDraft(null);
    setNotice('Your data was cleared.');
  }

  return (
    <>
      <Header />
      <main className="wrap settings-page">
        <div className="settings-grid">
          <aside className="settings-side" aria-label="Settings categories">
            <h2 className="section-title" tabIndex={-1} data-page-title>Settings</h2>
            <ul className="profile-list" aria-label="Categories">
              {CATEGORIES.map((name) => (
                <li key={name}>
                  <button type="button" aria-current={category === name ? 'true' : undefined} aria-controls="settings-category" onClick={() => setCategory(name)}>{name}</button>
                </li>
              ))}
            </ul>
            {dirty && <SaveActions label="Save or cancel changes" onSave={save} onCancel={() => setDraft(null)} />}
          </aside>
          <section id="settings-category" className="profile-form" aria-labelledby="settings-category-title">
            <h3 id="settings-category-title" className="settings-category-title">{category}</h3>
            {category === 'General' && <fieldset>
              <legend>Name display mode</legend>
              <p className="muted">How player names are shown on cards and in lists.</p>
              <div className="choice-list">
                {NAME_DISPLAY_MODES.map((m) => (
                  <div key={m} className="choice-row">
                    {/* The example sits outside the label, so the radio's name stays "Full", "Initial" or "Formal". */}
                    <label className="choice">
                      <input type="radio" name="name-display" value={m} checked={mode === m} aria-describedby={`name-display-${m}`} onChange={() => change({ mode: m })} />
                      {MODE_LABELS[m]}
                    </label>
                    <span id={`name-display-${m}`} className="muted">e.g. {MODE_EXAMPLES[m]}</span>
                  </div>
                ))}
              </div>
            </fieldset>}
            {category === 'Position order' && <fieldset>
              <legend>Position order</legend>
              <p id="position-order-help" className="muted">Use this position order within every game-status group on Players and Vs. During live games, activity comes first: red zone, on the field, then inactive.</p>
              <p id="position-drag-help" className="muted">Drag anywhere on a row to move a position, or use the arrow buttons. Save to apply your order.</p>
              <PositionOrderInput positions={positions} onChange={(next) => change({ positions: next })} />
              <p className="muted">DL includes DE, DT and NT; LB includes ILB, OLB and MLB; DB includes CB and safeties. Fullbacks use RB; PK uses K.</p>
              <button type="button" className="btn" disabled={positions.every((p, i) => p === DEFAULT_POSITION_ORDER[i])} onClick={() => change({ positions: [...DEFAULT_POSITION_ORDER] })}>Reset position order</button>
            </fieldset>}
            {category === 'Site settings' && <>
              <fieldset>
                <legend>Mascot</legend>
                <label className="choice">
                  <input type="checkbox" checked={mascot} aria-describedby="mascot-help" onChange={(event) => change({ mascot: event.target.checked })} />
                  Show the mascot
                </label>
                <div className="field-wrap">
                  <label className="field-label">
                    Name
                    <input value={name} maxLength={MAX_MASCOT_NAME} placeholder={DEFAULT_MASCOT_NAME} onChange={(event) => change({ name: event.target.value })} />
                  </label>
                </div>
                <p id="mascot-help" className="muted">The football in glasses that appears beside the title and says what to do next when a page is empty. Off, every page uses plain text instead, and the Leagues menu explains its buttons in tooltips.</p>
              </fieldset>
              <fieldset>
                <legend>Rookie camp</legend>
                <p id="camp-help" className="muted">{storedMascot ? `A short practice with ${storedName}: four drills, each done on the real pages, that show you around.` : 'Turn the mascot on and save to take the practice.'}</p>
                <button type="button" className="btn press" aria-describedby="camp-help" disabled={!storedMascot} onClick={() => { startCamp(); setNotice(`Rookie camp started. ${storedName} will show you the first drill.`); }}>Start rookie camp</button>
              </fieldset>
              <fieldset>
                <legend>Private league sync</legend>
                <label className="choice">
                  <input type="checkbox" checked={bookmarkHelp} aria-describedby="bookmark-help" onChange={(event) => change({ bookmarkHelp: event.target.checked })} />
                  Show bookmark setup for private leagues
                </label>
                <p id="bookmark-help" className="muted">Show the bookmark option when syncing private league starters. Turn this on to restore it after choosing Don&rsquo;t show this option again.</p>
              </fieldset>
              <fieldset>
                <legend>Your data</legend>
                <p className="muted">Followed players, leagues, scoring and every other setting are kept in this browser only.</p>
                <button type="button" className="btn btn-danger" onClick={() => confirmRef.current?.showModal()}>Clear my data</button>
              </fieldset>
            </>}
            {dirty && <SaveActions label="Save or cancel changes, end of form" onSave={save} onCancel={() => setDraft(null)} />}
          </section>
        </div>
        <p className={notice ? 'page-note' : 'sr'} role="status" aria-live="polite">{notice}</p>
      </main>
      <dialog ref={confirmRef} data-worried aria-labelledby="clear-title" aria-describedby="clear-warning" {...backdropClose}>
        <DialogMascot />
        <div className="dlg">
          <h2 id="clear-title">Clear all your data?</h2>
          <p id="clear-warning">This permanently deletes your followed players, your leagues and their scoring, and your settings from this browser. It cannot be undone.</p>
          <div className="dlg-actions">
            {/* Keep is first, so it takes the focus the dialog opens with, and is the filled, inviting button. */}
            <button type="button" className="btn btn-primary press" {...hint('Closes this and changes nothing.')} onClick={() => confirmRef.current?.close()}>Keep my data</button>
            <button type="button" className="btn btn-danger" {...hint('Removes every league, player and setting from this browser, for good.')} onClick={clearData}>Clear my data</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
