import { useId, useRef, useState } from 'react';
import { PrivateSettingsGuide } from './PrivateSettingsGuide';

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
  const [guideOpen, setGuideOpen] = useState(false);
  const guideId = useId();
  const guideAnchor = useRef<HTMLButtonElement>(null);
  const kept = what === 'settings' ? 'Only scoring and lineup settings are kept' : 'Only starting lineups and matchup pairings are kept';

  /** Pasting is the whole action: the text is checked and imported at once, and a problem is shown right under the box. */
  function submit(value: string) {
    setText(value);
    setProblem(value.trim() ? onImport(value) ?? '' : '');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(bookmarklet!);
      setNote('Copied. Create a bookmark and paste this as its address.');
    } catch {
      setNote('Your browser would not copy it. Drag the button above to your bookmarks bar instead.');
    }
  }

  const pasteBox = (
    <>
      <label className="field-label">
        {what === 'settings' ? 'Settings' : 'Rosters'} JSON for {leagueLabel}
        <textarea
          rows={4}
          value={text}
          onChange={(event) => { setText(event.target.value); setProblem(''); }}
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
      <button type="button" className="btn" disabled={!text.trim()} onClick={() => submit(text)}>Import these {what}</button>
    </>
  );

  if (what === 'settings') return (
    <div className="private-help private-settings">
      <p role="status">This league is private you need to copy the settings manually</p>
      <div className="bubble-actions">
        {url && <a className="btn btn-primary private-settings-open" href={url} target="_blank" rel="noreferrer" onClick={() => setSettingsOpened(true)} onAuxClick={(event) => { if (event.button === 1) setSettingsOpened(true); }}>Open Settings</a>}
        <button ref={guideAnchor} type="button" className="btn" aria-describedby={guideOpen ? guideId : undefined} onMouseEnter={() => setGuideOpen(true)} onMouseLeave={() => setGuideOpen(false)} onFocus={() => setGuideOpen(true)} onBlur={() => setGuideOpen(false)} onClick={() => setGuideOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape' && guideOpen) { event.preventDefault(); event.stopPropagation(); setGuideOpen(false); } }}>How?</button>
      </div>
      {settingsOpened && <>
        <p className="muted">Paste the copied settings text below. It is imported straight away.</p>
        {pasteBox}
      </>}
      {guideOpen && <PrivateSettingsGuide id={guideId} anchor={guideAnchor} />}
    </div>
  );

  return (
    <details className="private-help" open>
      <summary>Import {leagueLabel} from your own ESPN session</summary>
      {bookmarklet && (
        <div className="bm-help">
          <p><b>Quick way, once per browser:</b> drag this button to your bookmarks bar.</p>
          <p>
            {/* React refuses javascript: URLs in an href prop, so the link is set on the element itself. */}
            <a
              className="btn bm-link"
              draggable
              ref={(el) => { el?.setAttribute('href', bookmarklet); }}
              onClick={(event) => { event.preventDefault(); setNote('Do not click it here: drag it to your bookmarks bar, then click that bookmark on the ESPN tab.'); }}
            >
              Copy lineups from ESPN
            </a>
            {' '}
            <button type="button" className="btn" onClick={() => void copyCode()}>Copy the bookmark code instead</button>
          </p>
          <p>Then {espnPage ? <><a href={espnPage} target="_blank" rel="noreferrer">open the league on ESPN</a> (signed in)</> : 'open the league on ESPN (signed in)'}, click the bookmark, come back here and paste below. The bookmark runs on ESPN&rsquo;s page and only copies lineups to your clipboard.</p>
          {note && <p className="muted" role="status">{note}</p>}
          <p className="muted">Or the manual way:</p>
        </div>
      )}
      <ol>
        <li>Stay signed in to ESPN in this browser{url ? <>, then <a href={url} target="_blank" rel="noreferrer">open this league&rsquo;s {what} data</a> in a new tab</> : ''}.</li>
        <li>Select everything on that page (Cmd or Ctrl plus A), copy it and paste it below. {kept}; nothing leaves your browser.</li>
      </ol>
      {pasteBox}
    </details>
  );
}
