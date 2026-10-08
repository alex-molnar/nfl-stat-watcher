import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_NAMES, languageStore, type LanguageChoice } from '../i18n';
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
import { autoSyncStore } from '../storage/autoSync';

const MODE_EXAMPLES: Record<NameDisplayMode, string> = { full: 'David Montgomery', initial: 'D. Montgomery', formal: 'Montgomery, David' };
type SettingsDraft = { language: LanguageChoice; mode: NameDisplayMode; mascot: boolean; name: string; positions: PositionGroup[]; bookmarkHelp: boolean; autoSync: boolean };
const CATEGORIES = ['general', 'positionOrder', 'siteSettings'] as const;
type Category = (typeof CATEGORIES)[number];
const LANGUAGE_CHOICES: LanguageChoice[] = ['auto', ...LANGUAGES];
type Notice = '' | 'saved' | 'cleared' | 'clearFailed' | 'campStarted';

/** App-wide preferences. Like a league, changes wait in a working copy until Save. */
export function SettingsPage() {
  const { t } = useTranslation();
  usePageTitle(t(($) => $.settings.title));
  const hint = useHint();
  const storedLanguage = useStore(languageStore);
  const stored = useStore(nameDisplayStore);
  const storedMascot = useStore(mascotEnabledStore);
  const storedName = useStore(mascotNameStore);
  const storedPositions = useStore(positionOrderStore);
  const storedBookmarkHelp = useStore(bookmarkHelpStore);
  const storedAutoSync = useStore(autoSyncStore);
  const [category, setCategory] = useState<Category>('general');
  const [draft, setDraft] = useState<SettingsDraft | null>(null); // null: no unsaved change
  const [notice, setNotice] = useState<Notice>(''); // a key, not the text, so a language change at Save words it in the new language
  const confirmRef = useRef<HTMLDialogElement>(null);
  const language = draft?.language ?? storedLanguage;
  const mode = draft?.mode ?? stored;
  const mascot = draft?.mascot ?? storedMascot;
  const name = draft?.name ?? storedName;
  const positions = draft?.positions ?? storedPositions;
  const bookmarkHelp = draft?.bookmarkHelp ?? storedBookmarkHelp;
  const autoSync = draft?.autoSync ?? storedAutoSync;
  const change = (patch: Partial<SettingsDraft>) => setDraft({ language, mode, mascot, name, positions, bookmarkHelp, autoSync, ...patch });
  const dirty = language !== storedLanguage || mode !== stored || mascot !== storedMascot || name.trim() !== storedName || positions.some((p, i) => p !== storedPositions[i]) || bookmarkHelp !== storedBookmarkHelp || autoSync !== storedAutoSync;

  // The browser's own prompt for closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function save() {
    languageStore.set(language);
    nameDisplayStore.set(mode);
    mascotEnabledStore.set(mascot);
    mascotNameStore.set(name.trim() || DEFAULT_MASCOT_NAME);
    positionOrderStore.set([...positions]);
    bookmarkHelpStore.set(bookmarkHelp);
    autoSyncStore.set(autoSync);
    setDraft(null);
    setNotice('saved');
  }

  function clearData() {
    confirmRef.current?.close();
    try {
      // How far the user got in Rookie camp is kept: wiping it would offer the training camp again straight after, and it can be started from here any time.
      const camp = localStorage.getItem(CAMP_KEY);
      localStorage.clear();
      if (camp !== null) localStorage.setItem(CAMP_KEY, camp);
    } catch {
      setNotice('clearFailed');
      return;
    }
    reloadAllStores(); // every store falls back to its defaults, so the open app matches the empty storage
    setDraft(null);
    setNotice('cleared');
  }

  return (
    <>
      <Header />
      <main className="wrap settings-page">
        <div className="settings-grid">
          <aside className="settings-side" aria-label={t(($) => $.settings.categoriesLabel)}>
            <h2 className="section-title" tabIndex={-1} data-page-title>{t(($) => $.settings.title)}</h2>
            <ul className="profile-list" aria-label={t(($) => $.settings.categoriesList)}>
              {CATEGORIES.map((id) => (
                <li key={id}>
                  <button type="button" aria-current={category === id ? 'true' : undefined} aria-controls="settings-category" onClick={() => setCategory(id)}>{t(($) => $.settings.categories[id])}</button>
                </li>
              ))}
            </ul>
            {dirty && <SaveActions label={t(($) => $.settings.saveBarLabel)} onSave={save} onCancel={() => setDraft(null)} />}
          </aside>
          <section id="settings-category" className="profile-form" aria-labelledby="settings-category-title">
            <h3 id="settings-category-title" className="settings-category-title">{t(($) => $.settings.categories[category])}</h3>
            {category === 'general' && <>
              <fieldset>
              <legend>{t(($) => $.settings.nameDisplay.legend)}</legend>
              <p className="muted">{t(($) => $.settings.nameDisplay.help)}</p>
              <div className="choice-list">
                {NAME_DISPLAY_MODES.map((m) => (
                  <div key={m} className="choice-row">
                    {/* The example sits outside the label, so the radio's name stays "Full", "Initial" or "Formal". */}
                    <label className="choice">
                      <input type="radio" name="name-display" value={m} checked={mode === m} aria-describedby={`name-display-${m}`} onChange={() => change({ mode: m })} />
                      {t(($) => $.settings.nameDisplay.modes[m])}
                    </label>
                    <span id={`name-display-${m}`} className="muted">{t(($) => $.settings.nameDisplay.example, { example: MODE_EXAMPLES[m] })}</span>
                  </div>
                ))}
              </div>
              </fieldset>
              <fieldset>
                <legend>{t(($) => $.settings.starters.legend)}</legend>
                <label className="choice">
                  <input type="checkbox" checked={autoSync} aria-describedby="auto-sync-help" onChange={(event) => change({ autoSync: event.target.checked })} />
                  {t(($) => $.settings.starters.autoSync)}
                </label>
                <p id="auto-sync-help" className="muted">{t(($) => $.settings.starters.autoSyncHelp)}</p>
              </fieldset>
            </>}
            {category === 'positionOrder' && <fieldset>
              <legend>{t(($) => $.settings.positions.legend)}</legend>
              <p id="position-order-help" className="muted">{t(($) => $.settings.positions.orderHelp)}</p>
              <p id="position-drag-help" className="muted">{t(($) => $.settings.positions.dragHelp)}</p>
              <PositionOrderInput positions={positions} onChange={(next) => change({ positions: next })} />
              <p className="muted">{t(($) => $.settings.positions.groupsNote)}</p>
              <button type="button" className="btn" disabled={positions.every((p, i) => p === DEFAULT_POSITION_ORDER[i])} onClick={() => change({ positions: [...DEFAULT_POSITION_ORDER] })}>{t(($) => $.settings.positions.reset)}</button>
            </fieldset>}
            {category === 'siteSettings' && <>
              <fieldset>
                <legend>{t(($) => $.settings.language.legend)}</legend>
                <div className="choice-list">
                  {LANGUAGE_CHOICES.map((choice) => (
                    <label key={choice} className="choice">
                      <input type="radio" name="language" value={choice} checked={language === choice} aria-describedby={choice === 'auto' ? 'language-auto-help' : undefined} onChange={() => change({ language: choice })} />
                      {choice === 'auto' ? t(($) => $.settings.language.auto) : LANGUAGE_NAMES[choice]}
                    </label>
                  ))}
                </div>
                <p id="language-auto-help" className="muted">{t(($) => $.settings.language.autoHelp)}</p>
              </fieldset>
              <fieldset>
                <legend>{t(($) => $.settings.mascot.legend)}</legend>
                <label className="choice">
                  <input type="checkbox" checked={mascot} aria-describedby="mascot-help" onChange={(event) => change({ mascot: event.target.checked })} />
                  {t(($) => $.settings.mascot.show)}
                </label>
                <div className="field-wrap">
                  <label className="field-label">
                    {t(($) => $.settings.mascot.name)}
                    <input value={name} maxLength={MAX_MASCOT_NAME} placeholder={DEFAULT_MASCOT_NAME} onChange={(event) => change({ name: event.target.value })} />
                  </label>
                </div>
                <p id="mascot-help" className="muted">{t(($) => $.settings.mascot.help)}</p>
              </fieldset>
              <fieldset>
                <legend>{t(($) => $.settings.camp.legend)}</legend>
                <p id="camp-help" className="muted">{storedMascot ? t(($) => $.settings.camp.help, { name: storedName }) : t(($) => $.settings.camp.helpOff)}</p>
                <button type="button" className="btn press" aria-describedby="camp-help" disabled={!storedMascot} onClick={() => { startCamp(); setNotice('campStarted'); }}>{t(($) => $.settings.camp.start)}</button>
              </fieldset>
              <fieldset>
                <legend>{t(($) => $.settings.privateSync.legend)}</legend>
                <label className="choice">
                  <input type="checkbox" checked={bookmarkHelp} aria-describedby="bookmark-help" onChange={(event) => change({ bookmarkHelp: event.target.checked })} />
                  {t(($) => $.settings.privateSync.show)}
                </label>
                <p id="bookmark-help" className="muted">{t(($) => $.settings.privateSync.help)}</p>
              </fieldset>
              <fieldset>
                <legend>{t(($) => $.settings.data.legend)}</legend>
                <p className="muted">{t(($) => $.settings.data.help)}</p>
                <button type="button" className="btn btn-danger" onClick={() => confirmRef.current?.showModal()}>{t(($) => $.settings.data.clear)}</button>
              </fieldset>
            </>}
            {dirty && <SaveActions label={t(($) => $.settings.saveBarEndLabel)} onSave={save} onCancel={() => setDraft(null)} />}
          </section>
        </div>
        <p className={notice ? 'page-note' : 'sr'} role="status" aria-live="polite">
          {notice === 'saved' && t(($) => $.settings.notices.saved)}
          {notice === 'cleared' && t(($) => $.settings.notices.cleared)}
          {notice === 'clearFailed' && t(($) => $.settings.notices.clearFailed)}
          {notice === 'campStarted' && t(($) => $.settings.camp.started, { name: storedName })}
        </p>
      </main>
      <dialog ref={confirmRef} data-worried aria-labelledby="clear-title" aria-describedby="clear-warning" {...backdropClose}>
        <DialogMascot />
        <div className="dlg">
          <h2 id="clear-title">{t(($) => $.settings.clearDialog.title)}</h2>
          <p id="clear-warning">{t(($) => $.settings.clearDialog.warning)}</p>
          <div className="dlg-actions">
            {/* Keep is first, so it takes the focus the dialog opens with, and is the filled, inviting button. */}
            <button type="button" className="btn btn-primary press" {...hint(t(($) => $.settings.clearDialog.keepHint))} onClick={() => confirmRef.current?.close()}>{t(($) => $.settings.clearDialog.keep)}</button>
            <button type="button" className="btn btn-danger" {...hint(t(($) => $.settings.clearDialog.clearHint))} onClick={clearData}>{t(($) => $.settings.clearDialog.clear)}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
