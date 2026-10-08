import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createStore } from '../storage/store';
import { en } from './en';
import type { Messages } from './messages';

export const LANGUAGES = ['en', 'hu'] as const;
export type Language = (typeof LANGUAGES)[number];
/** Each language in its own words, so it can be found by someone who cannot read the current one. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hu: 'Magyar' };

export type LanguageChoice = 'auto' | Language;
/** The saved choice: "auto" follows the browser's language list. Saved from the Settings page. */
export const languageStore = createStore<LanguageChoice>({
  key: 'nflsw:v1:language',
  fallback: () => 'auto',
  isValid: (v): v is LanguageChoice => v === 'auto' || (LANGUAGES as readonly unknown[]).includes(v),
});

/** The first language in the browser's list that the site has, else English. */
export function resolveLanguage(choice: LanguageChoice, preferred: readonly string[] = (typeof navigator === 'undefined' ? undefined : navigator.languages) ?? []): Language {
  if (choice !== 'auto') return choice;
  for (const tag of preferred) {
    const language = LANGUAGES.find((candidate) => tag.toLowerCase().split('-')[0] === candidate);
    if (language) return language;
  }
  return 'en';
}

// A language other than English is a separate chunk, fetched the first time it is used.
const loaders: Record<Exclude<Language, 'en'>, () => Promise<{ default: Messages }>> = { hu: () => import('./hu') };

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false }, // React escapes
  initAsync: false, // English is bundled, so the first render already has its texts
});

/** Makes the saved choice the language of the page: loads it if needed, then switches every `t` and `<html lang>`. */
export async function applyLanguage(): Promise<void> {
  const language = resolveLanguage(languageStore.get());
  if (language !== 'en' && !i18next.hasResourceBundle(language, 'translation')) {
    i18next.addResourceBundle(language, 'translation', (await loaders[language]()).default);
  }
  await i18next.changeLanguage(language);
  document.documentElement.lang = language;
}

languageStore.subscribe(() => void applyLanguage());

export { i18next as i18n };
