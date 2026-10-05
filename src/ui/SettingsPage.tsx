import { useEffect, useRef, useState } from 'react';
import { DAZN_REGION, syncDaznLinks } from '../dazn/links';
import { daznEnabledStore, daznLinksStore } from '../storage/dazn';
import { NAME_DISPLAY_MODES, nameDisplayStore, type NameDisplayMode } from '../storage/nameDisplay';
import { reloadAllStores } from '../storage/store';
import { useStore } from '../storage/useStore';
import { backdropClose } from './backdropClose';
import { Header } from './Header';
import { SaveActions } from './LeaguesPage';
import { usePageTitle } from './usePageTitle';

const MODE_LABELS: Record<NameDisplayMode, string> = { full: 'Full', initial: 'Initial', formal: 'Formal' };
const MODE_EXAMPLES: Record<NameDisplayMode, string> = { full: 'David Montgomery', initial: 'D. Montgomery', formal: 'Montgomery, David' };

/** App-wide preferences. Like a league, changes wait in a working copy until Save. */
export function SettingsPage() {
  usePageTitle('Settings');
  const stored = useStore(nameDisplayStore);
  const storedDazn = useStore(daznEnabledStore);
  const daznLinks = useStore(daznLinksStore);
  const [draft, setDraft] = useState<{ mode: NameDisplayMode; dazn: boolean } | null>(null); // null: no unsaved change
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const mode = draft?.mode ?? stored;
  const dazn = draft?.dazn ?? storedDazn;
  const dirty = mode !== stored || dazn !== storedDazn;

  // The browser's own prompt for closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function save() {
    nameDisplayStore.set(mode);
    daznEnabledStore.set(dazn);
    setDraft(null);
    setNotice('Saved settings.');
  }

  async function syncNow() {
    setSyncing(true);
    setNotice('');
    try {
      const { stored: result, games } = await syncDaznLinks();
      setNotice(`Linked ${Object.keys(result.links).length} of ${games} games with DAZN.`);
    } catch (cause) {
      setNotice(`Could not sync with DAZN: ${cause instanceof Error ? cause.message : 'unknown error'}.`);
    } finally {
      setSyncing(false);
    }
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
                    <input type="radio" name="name-display" value={m} checked={mode === m} aria-describedby={`name-display-${m}`} onChange={() => setDraft({ mode: m, dazn })} />
                    {MODE_LABELS[m]}
                  </label>
                  <span id={`name-display-${m}`} className="muted">e.g. {MODE_EXAMPLES[m]}</span>
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>DAZN game links <span className="chip note">Experimental, untested</span></legend>
            <label className="choice">
              <input type="checkbox" checked={dazn} aria-describedby="dazn-help" onChange={(event) => setDraft({ mode, dazn: event.target.checked })} />
              Expose DAZN games
            </label>
            <p id="dazn-help" className="muted">Looks up this week's games on DAZN's NFL Game Pass schedule (region {DAZN_REGION}), through this site's own server, and matches them to the NFL games. Off by default: nothing is requested from DAZN while it is off. When on, it syncs once every time the site loads. The matches are not used anywhere yet.</p>
            {dazn && <p className="compat-warning" role="note"><strong>Warning:</strong> games are synced anyway, but opening a game on DAZN will rely on you being logged in to DAZN.</p>}
            <button type="button" className="btn press" disabled={syncing} onClick={syncNow}>Sync game links with DAZN</button>
            <p className="muted">{daznLinks.syncedAt ? `Last synced ${new Date(daznLinks.syncedAt).toLocaleString()}: ${Object.keys(daznLinks.links).length} games linked.` : 'Not synced yet.'}</p>
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
      <dialog ref={confirmRef} aria-labelledby="clear-title" aria-describedby="clear-warning" {...backdropClose}>
        <div className="dlg">
          <h2 id="clear-title">Clear all your data?</h2>
          <p id="clear-warning">This permanently deletes your followed players, your leagues and their scoring, and your settings from this browser. It cannot be undone.</p>
          <div className="dlg-actions">
            {/* Keep is first, so it takes the focus the dialog opens with, and is the filled, inviting button. */}
            <button type="button" className="btn btn-primary press" onClick={() => confirmRef.current?.close()}>Keep my data</button>
            <button type="button" className="btn btn-danger" onClick={clearData}>Clear my data</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
