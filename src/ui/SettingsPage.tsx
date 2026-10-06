import { useEffect, useRef, useState } from 'react';
import { NAME_DISPLAY_MODES, nameDisplayStore, type NameDisplayMode } from '../storage/nameDisplay';
import { mascotEnabledStore } from '../storage/mascot';
import { reloadAllStores } from '../storage/store';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { DialogMascot, useHint } from './DialogMascot';
import { Header } from './Header';
import { SaveActions } from './LeaguesPage';
import { usePageTitle } from './usePageTitle';

const MODE_LABELS: Record<NameDisplayMode, string> = { full: 'Full', initial: 'Initial', formal: 'Formal' };
const MODE_EXAMPLES: Record<NameDisplayMode, string> = { full: 'David Montgomery', initial: 'D. Montgomery', formal: 'Montgomery, David' };

/** App-wide preferences. Like a league, changes wait in a working copy until Save. */
export function SettingsPage() {
  usePageTitle('Settings');
  const hint = useHint();
  const stored = useStore(nameDisplayStore);
  const storedMascot = useStore(mascotEnabledStore);
  const [draft, setDraft] = useState<{ mode: NameDisplayMode; mascot: boolean } | null>(null); // null: no unsaved change
  const [notice, setNotice] = useState('');
  const confirmRef = useRef<HTMLDialogElement>(null);
  const mode = draft?.mode ?? stored;
  const mascot = draft?.mascot ?? storedMascot;
  const dirty = mode !== stored || mascot !== storedMascot;

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
    setDraft(null);
    setNotice('Saved settings.');
  }

  function clearData() {
    confirmRef.current?.close();
    try {
      localStorage.clear();
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
        <h2 className="section-title" tabIndex={-1} data-page-title>Settings</h2>
        <section className="profile-form" aria-label="Settings">
          <fieldset>
            <legend>Name display mode</legend>
            <p className="muted">How player names are shown on cards and in lists.</p>
            <div className="choice-list">
              {NAME_DISPLAY_MODES.map((m) => (
                <div key={m} className="choice-row">
                  {/* The example sits outside the label, so the radio's name stays "Full", "Initial" or "Formal". */}
                  <label className="choice">
                    <input type="radio" name="name-display" value={m} checked={mode === m} aria-describedby={`name-display-${m}`} onChange={() => setDraft({ mode: m, mascot })} />
                    {MODE_LABELS[m]}
                  </label>
                  <span id={`name-display-${m}`} className="muted">e.g. {MODE_EXAMPLES[m]}</span>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Mascot</legend>
            <label className="choice">
              <input type="checkbox" checked={mascot} aria-describedby="mascot-help" onChange={(event) => setDraft({ mode, mascot: event.target.checked })} />
              Show the mascot
            </label>
            <p id="mascot-help" className="muted">The football in glasses that appears beside the title and says what to do next when a page is empty. Off, every page uses plain text instead, and the Leagues menu explains its buttons in tooltips.</p>
          </fieldset>
          <fieldset>
            <legend>Your data</legend>
            <p className="muted">Followed players, leagues, scoring and every other setting are kept in this browser only.</p>
            <button type="button" className="btn btn-danger" onClick={() => confirmRef.current?.showModal()}>Clear my data</button>
          </fieldset>
          {dirty && <SaveActions label="Save or cancel changes" onSave={save} onCancel={() => setDraft(null)} />}
        </section>
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
