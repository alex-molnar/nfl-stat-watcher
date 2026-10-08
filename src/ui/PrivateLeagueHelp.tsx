import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setNote(t(($) => $.sync.help.copied));
      track('help', { step: 'copy_bookmark' });
    } catch {
      setNote(t(($) => $.sync.help.copyFailed));
    }
  }

  const pasteBox = (
    <>
      <label className="field-label">
        {what === 'settings' && t(($) => $.sync.help.settingsJsonFor, { league: leagueLabel })}
        <textarea
          aria-label={what === 'rosters' ? t(($) => $.sync.help.rosterData) : undefined}
          rows={4}
          value={text}
          onChange={(event) => { if (what === 'rosters') submit(event.target.value); else { setText(event.target.value); setProblem(''); } }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (!pasted.trim()) return;
            event.preventDefault(); // the pasted text replaces the box's content: it is one blob of JSON
            submit(pasted);
          }}
          placeholder={t(($) => $.sync.help.placeholder)}
        />
      </label>
      {problem && <p className="error" role="alert">{problem}</p>}
      {what === 'settings' && <button type="button" className="btn" disabled={!text.trim()} onClick={() => submit(text)}>{t(($) => $.sync.help.importSettings)}</button>}
    </>
  );

  if (what === 'settings') return (
    <div className="private-help private-settings">
      <p role="status">{t(($) => $.sync.help.privateSettings)}</p>
      <div className="bubble-actions">
        {url && <a className="btn btn-primary private-settings-open" href={url} target="_blank" rel="noreferrer" onClick={() => setSettingsOpened(true)} onAuxClick={(event) => { if (event.button === 1) setSettingsOpened(true); }}>{t(($) => $.sync.help.openSettings)}</a>}
        <PrivateHelpButton mode="settings" />
      </div>
      {settingsOpened && <>
        <p className="muted">{t(($) => $.sync.help.pasteSettings)}</p>
        {pasteBox}
      </>}
    </div>
  );

  return (
    <div className="private-help private-rosters">
      {bookmarklet && showBookmarkHelp && <>
        <h3 className="private-method-title">{t(($) => $.sync.help.createBookmark)}</h3>
        <section className="bm-help private-method" aria-label={t(($) => $.sync.help.createBookmark)}>
          <p>{t(($) => $.sync.help.bookmarkIntro)}</p>
          <div className="bm-actions">
            {/* React refuses javascript: URLs in an href prop, so the link is set on the element itself. */}
            <a
              className="btn btn-primary bm-link"
              draggable
              ref={(el) => { bookmarkAnchor.current = el; el?.setAttribute('href', bookmarklet); }}
              onDragStart={() => setDragging(true)}
              onDragEnd={() => setDragging(false)}
              onClick={(event) => { event.preventDefault(); setNote(t(($) => $.sync.help.dontClick)); }}
            >
              {t(($) => $.sync.help.bookmarkLabel)}
            </a>
            <span className="muted bm-or">{t(($) => $.sync.help.or)}</span>
            <button type="button" className="btn" onClick={() => void copyCode()}>{t(($) => $.sync.help.copyBookmark)}</button>
            <PrivateHelpButton mode="bookmark" />
            <SyncTourButton />
          </div>
          {!dragging && <BookmarkDragGuide anchor={bookmarkAnchor} />}
          <p>{t(($) => $.sync.help.afterBookmark)}</p>
          {note && <p className="muted" role="status">{note}</p>}
          <div className="bm-actions">
            {espnPage && <a className="btn private-method-link" href={espnPage} target="_blank" rel="noreferrer">{t(($) => $.sync.help.goToLeague)}</a>}
            <button type="button" className="btn" onClick={() => bookmarkHelpStore.set(false)}>{t(($) => $.sync.help.dontShowAgain)}</button>
          </div>
        </section>
        <p className="muted">{t(($) => $.sync.help.manualWay)}</p>
      </>}
      <section className="private-method" aria-label={t(($) => $.sync.help.manualLabel)}>
        <p>{t(($) => $.sync.help.manualIntro)}</p>
        <div className="bm-actions">
          {url && <a className="btn private-method-link" href={url} target="_blank" rel="noreferrer">{t(($) => $.sync.help.goToSource)}</a>}
          <PrivateHelpButton mode="rosters" />
        </div>
      </section>
      {pasteBox}
    </div>
  );
}
