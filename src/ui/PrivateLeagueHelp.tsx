import { useRef, useState } from 'react';
import { PrivateHelpButton } from './PrivateHelpButton';
import { SyncTourButton } from './SyncTourButton';
import { BookmarkDragGuide } from './BookmarkDragGuide';
import { track } from '../metrics/track';
import { bookmarkHelpStore } from '../storage/bookmarkHelp';
import { useStore } from '../storage/useStore';

interface Props {
  url: string | null;
  what: 'settings' | 'rosters';
  leagueLabel: string;
  /** Returns an error message, or null when the pasted text was accepted. */
  onImport: (text: string) => string | null;
  /** A javascript: link that copies the data from ESPN's own page, offered as the quick way. */
  bookmarklet?: string;
  /** The league's page on ESPN, where the bookmarklet is run. */
  espnPage?: string;
}

/** Private leagues need the user's own ESPN session, which the app never sees: the data is copied across by the user. */
export function PrivateLeagueHelp({ url, what, leagueLabel, onImport, bookmarklet, espnPage }: Props) {
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [settingsOpened, setSettingsOpened] = useState(false);
  const bookmarkAnchor = useRef<HTMLAnchorElement>(null);
  const [dragging, setDragging] = useState(false);
  const showBookmarkHelp = useStore(bookmarkHelpStore);

  /** Pasting is the whole action: the text is checked and imported at once, and a problem is shown right under the box. */
  function submit(value: string) {
    setText(value);
    setProblem(value.trim() ? onImport(value) ?? '' : '');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(bookmarklet!);
      setNote('Copied. Create a bookmark and paste this as its address.');
      track('help', { step: 'copy_bookmark' });
    } catch {
      setNote('Your browser would not copy it. Drag the button above to your bookmarks bar instead.');
    }
  }

  const pasteBox = (
    <>
      <label className="field-label">
        {what === 'settings' && <>Settings JSON for {leagueLabel}</>}
        <textarea
          aria-label={what === 'rosters' ? 'Roster data' : undefined}
          rows={4}
          value={text}
          onChange={(event) => { if (what === 'rosters') submit(event.target.value); else { setText(event.target.value); setProblem(''); } }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (!pasted.trim()) return;
            event.preventDefault(); // the pasted text replaces the box's content: it is one blob of JSON
            submit(pasted);
          }}
          placeholder="Paste the copied ESPN data here and it is imported straight away"
        />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      {what === 'settings' && <button type="button" className="btn" disabled={!text.trim()} onClick={() => submit(text)}>Import these settings</button>}
    </>
  );

  if (what === 'settings') return (
    <div className="private-help private-settings">
      <p role="status">This league is private you need to copy the settings manually</p>
      <div className="bubble-actions">
        {url && <a className="btn btn-primary private-settings-open" href={url} target="_blank" rel="noreferrer" onClick={() => setSettingsOpened(true)} onAuxClick={(event) => { if (event.button === 1) setSettingsOpened(true); }}>Open Settings</a>}
        <PrivateHelpButton mode="settings" />
      </div>
      {settingsOpened && <>
        <p className="muted">Paste the copied settings text below. It is imported straight away.</p>
        {pasteBox}
      </>}
    </div>
  );

  return (
    <div className="private-help private-rosters">
      {bookmarklet && showBookmarkHelp && <>
        <h3 className="private-method-title">Create bookmark</h3>
        <section className="bm-help private-method" aria-label="Create bookmark">
          <p>Drag the below button to your bookmarks bar, if you have one. Alternatively create a new bookmark, and paste the below copied text to the address. This is a harmless script, that copies the current roster information of your league</p>
          <div className="bm-actions">
            {/* React refuses javascript: URLs in an href prop, so the link is set on the element itself. */}
            <a
              className="btn btn-primary bm-link"
              draggable
              ref={(el) => { bookmarkAnchor.current = el; el?.setAttribute('href', bookmarklet); }}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}
              onClick={(event) => { event.preventDefault(); setNote('Do not click it here: drag it to your bookmarks bar, then click that bookmark on the ESPN tab.'); }}
            >
              Sync
            </a>
            <span className="muted bm-or">or</span>
            <button type="button" className="btn" onClick={() => void copyCode()}>Copy bookmark</button>
            <PrivateHelpButton mode="bookmark" />
            <SyncTourButton />
          </div>
          {!dragging && <BookmarkDragGuide anchor={bookmarkAnchor} />}
          <p>Now if you go to any page on ESPN, within your league, and click the bookmark you just saved you should be set! You can go ahead and paste the info in the input below</p>
          {note && <p className="muted" role="status">{note}</p>}
          <div className="bm-actions">
            {espnPage && <a className="btn private-method-link" href={espnPage} target="_blank" rel="noreferrer">Go to league</a>}
            <button type="button" className="btn" onClick={() => bookmarkHelpStore.set(false)}>Don&rsquo;t show this option again</button>
          </div>
        </section>
        <p className="muted">Or the manual way:</p>
      </>}
      <section className="private-method" aria-label="Copy roster data manually">
        <p>Sign in to your league in this browser, then copy the roster data from the league source</p>
        <div className="bm-actions">
          {url && <a className="btn private-method-link" href={url} target="_blank" rel="noreferrer">Go to league source</a>}
          <PrivateHelpButton mode="rosters" />
        </div>
      </section>
      {pasteBox}
    </div>
  );
}
