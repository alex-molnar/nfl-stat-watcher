import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportProfile, parseProfileFile, serializeProfile } from '../leagues/profileTransfer';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { issueText } from '../leagues/espn/statMap';
import { parseEspnLeagueInput } from '../leagues/espn/parse';
import type { EspnLeagueSettings } from '../leagues/types';
import { scorePlayer } from '../scoring/score';
import { mockFetch } from '../test/mockFetch';
import { profilesFixture, warren, opponent } from '../test/data';
import { inHungarian, renderAt, seed } from '../test/render';
import fixture from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';

const dialog = () => screen.getByRole('dialog');

describe('Leagues in Hungarian', () => {
  it('shows the page, its menu and a league form in Hungarian', async () => {
    seed([], profilesFixture);
    await inHungarian();
    renderAt('/leagues');
    expect(await screen.findByRole('heading', { name: 'Ligák' })).toBeInTheDocument();
    for (const name of ['Liga hozzáadása', 'Ligák importálása', 'StatWatch-profil importálása', 'Profil exportálása']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: /Office league/ }));
    expect(await screen.findByLabelText('Sablon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sablon alkalmazása' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Támadás' })).toBeInTheDocument();
    expect(screen.getByLabelText('Passzolt yardonként')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liga törlése' })).toBeInTheDocument();
  });

  it('walks the public league import in Hungarian, with the warnings and the result', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': fixture });
    await inHungarian();
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Ligák importálása' }));
    await userEvent.type(screen.getByLabelText('ESPN fantasy football ligalinkek vagy azonosítók, soronként egy'), '1900128084');
    await userEvent.clear(screen.getByLabelText('Szezon'));
    await userEvent.type(screen.getByLabelText('Szezon'), '2026');
    await userEvent.click(screen.getByRole('button', { name: 'Ligák betöltése' }));
    expect(await screen.findByText(/Liga: 1900128084 · Szezon: 2026 · Nyilvános beállítások/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kijelölt ligák importálása/ })).toBeDisabled();
    expect(within(dialog()).getByText(/Pontozási kompatibilitás: liga: 1900128084, szezon: 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/A közelítő profil importálása \(liga: 1900128084/));
    await userEvent.click(screen.getByRole('button', { name: /Kijelölt ligák importálása/ }));
    expect(await screen.findByText('1 liga importálva, a profilok elmentve.')).toHaveAttribute('role', 'status');
  });

  it('exports in Hungarian', async () => {
    seed([warren, opponent(warren)], profilesFixture);
    await inHungarian();
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Profil exportálása' }));
    expect(within(dialog()).getByRole('heading', { name: 'Profil exportálása' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Másolás a vágólapra' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Letöltés' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Bezárás' })).toBeInTheDocument();
  });

  it('asks in Hungarian what happens to the players when a league is deleted', async () => {
    seed([warren, opponent(warren)], profilesFixture);
    await inHungarian();
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: /Office league/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Liga törlése' }));
    expect(within(dialog()).getByRole('heading', { name: 'Törlöd: Office league?' })).toBeInTheDocument();
    expect(within(dialog()).getByText('Mi legyen a játékosaival?')).toBeInTheDocument();
    expect(within(dialog()).getByText('1 játékos áttétele ide:')).toBeInTheDocument();
    expect(within(dialog()).getByText('A(z) 1 ellenfél-játékos törlődik.')).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Meglévő játékosok törlése')).toBeInTheDocument();
  });

  it('shows the profile import preview and a bad file in Hungarian', async () => {
    seed([], profilesFixture);
    await inHungarian();
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'StatWatch-profil importálása' }));
    const box = within(dialog()).getByLabelText('Profil JSON');
    await userEvent.click(box);
    await userEvent.paste('{"nope": true}');
    expect(await within(dialog()).findByText('Ez nem StatWatch-profil.')).toHaveAttribute('role', 'alert');
    const file = serializeProfile(exportProfile([{ ...profilesFixture[0]!, id: 'other', name: 'Brought along' }], [{ ...warren, profileId: 'other' }]));
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste(file);
    expect(await within(dialog()).findByText('Frissítés: 0 liga, hozzáadás: 1 liga, hozzáadás: 1 játékos')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Importálás' }));
    expect(await screen.findByText('Importálva: 1 liga; 0 frissítve, 1 hozzáadva, 1 játékos hozzáadva.')).toBeInTheDocument();
  });
});

describe('messages from the code behind the screens, in Hungarian', () => {
  it('translates a validation message when it is thrown', async () => {
    await inHungarian();
    expect(() => parseProfileFile('[]')).toThrow('Ez nem StatWatch-profil.');
    expect(() => parseEspnLeagueInput('nonsense')).toThrow('Illessz be egy számazonosítót vagy egy ESPN fantasy football linket');
  });

  it('saves an import issue as English with a reason, and shows it in the language of the page', async () => {
    const settings = { leagueId: '1', season: '2026', name: 'x', scoringItems: [{ statId: 9999, points: 1, pointsOverrides: null, pointsOverridesByPosition: null, isActive: null, isDisabled: null, scoringPeriodId: null, statOffset: null, statPeriodId: null, pointsByDistance: null }], lineupSlotCounts: {}, rawSettings: { scoringSettings: { scoringItems: [] }, rosterSettings: { lineupSlotCounts: {} } }, transport: 'public-api' } as EspnLeagueSettings;
    await inHungarian();
    const issue = normalizeEspnLeague(settings).source.issues.find(({ reason }) => reason?.key === 'unknownStat')!;
    expect(issue.message).toBe('ESPN stat 9999: this stat ID is not in the reviewed ESPN stat map');
    expect(issueText(issue)).toBe('ESPN-statisztika 9999: ez a statisztikaazonosító nincs az átnézett ESPN-leképezésben');
    expect(issueText({ ...issue, reason: undefined })).toBe(issue.message); // saved before reasons existed
  });

  it('labels the score breakdown in Hungarian', async () => {
    await inHungarian();
    const { breakdown } = scorePlayer({ passing: { attempts: 30, completions: 20, yards: 300, touchdowns: 2, interceptions: 1 } } as never, profilesFixture[0]!.values);
    expect(breakdown.map((line) => line.label)).toContain('Passzolt yardok');
  });
});
