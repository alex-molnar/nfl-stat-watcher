import { screen, within } from '@testing-library/react';
import { en } from './en';
import hu from './hu';
import { LANGUAGES, applyLanguage, languageStore, resolveLanguage } from './index';
import { inHungarian, renderAt } from '../test/render';

type Tree = { [key: string]: string | Tree };
const leaves = (tree: Tree, path = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [[`${path}${key}`, value] as [string, string]] : leaves(value, `${path}${key}.`)));
// What a translation must carry over from the English: the {{values}} filled in and the <tags> that become links, bold text and so on.
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*[\w.]+\s*(?:,[^}]*)?\}\}|<\/?[\w]+\s*\/?>/g)].map((m) => m[0].replace(/\s/g, '')).sort();

describe('translations', () => {
  const hungarian = new Map(leaves(hu as Tree));
  it.each(leaves(en as Tree))('%s keeps the English values and tags', (key, english) => {
    expect(placeholders(hungarian.get(key)!)).toEqual(placeholders(english));
  });

  it('has no empty text', () => {
    for (const [key, text] of hungarian) expect(text.trim(), key).not.toBe('');
  });
});

describe('choosing the language', () => {
  it('follows the first browser language the site has, else English', () => {
    expect(resolveLanguage('auto', ['de-DE', 'hu-HU', 'en'])).toBe('hu');
    expect(resolveLanguage('auto', ['de', 'fr'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
  });

  it('a saved choice beats the browser', () => {
    expect(resolveLanguage('en', ['hu'])).toBe('en');
    expect(resolveLanguage('hu', ['en'])).toBe('hu');
  });

  it('knows every language it lists', () => {
    expect(LANGUAGES).toEqual(['en', 'hu']);
  });

  it('switches the open page, and the page language, without a reload', async () => {
    renderAt('/');
    const nav = () => within(screen.getByRole('navigation'));
    expect(nav().getByRole('link', { name: 'Players' })).toBeInTheDocument();
    await inHungarian();
    expect(await screen.findByRole('navigation', { name: 'Főmenü' })).toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'Játékosok' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hu');
    languageStore.set('en');
    await applyLanguage();
    expect(await screen.findByRole('link', { name: 'Players' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
