import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import lineups from '../test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json';
import standings from '../test/fixtures/standings.json';
import { profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import { reloadAllStores } from '../storage/store';
import { DRILLS, stepText, type Ctx } from './campDrills';

const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const imported = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: draft.source };
const stored = () => JSON.parse(localStorage.getItem('nflsw:v1:camp') ?? 'null');
const setCamp = (step: number, sub = 0) => {
  localStorage.setItem('nflsw:v1:camp', JSON.stringify({ phase: 'running', step, sub }));
  reloadAllStores();
};
// The camp's card is in the open dialog when the step lives in one, else on the page; it is found by its region either way.
const card = () => screen.getByRole('region', { name: 'Rookie camp' });
const slow = { timeout: 4000 };
const cardSays = (text: RegExp | string) => waitFor(() => expect(card()).toHaveTextContent(text), slow);
const next = (label = 'Next') => userEvent.click(within(card()).getByRole('button', { name: label }));
const settingsRoute = { 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': settings };

describe('drill 3: Vs Mode', () => {
  it('opens with a dialog about the page, then rings the league picker, the score bar and both Add player buttons', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, standings });
    setCamp(2);
    renderAt('/');
    await userEvent.click(screen.getByRole('link', { name: 'Vs Mode' }));
    const tour = await screen.findByRole('dialog', { name: /drill 3 of 6/ });
    expect(tour).toHaveTextContent('This is Vs Mode');
    await userEvent.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(stored()).toEqual({ phase: 'running', step: 2, sub: 2 });
    await cardSays('Pick the league the matchup is scored in');
    expect(document.querySelector('.camp-ring')).not.toBeNull();
    await next();
    await cardSays('score bar adds up');
    await next();
    await cardSays('same Add player you already know');
    await next();
    await cardSays('opponent’s side');
    await next('Complete drill');
    expect(stored()).toMatchObject({ phase: 'running', step: 3, sub: 0 }); // on to the import drill
  });

  it('treats Escape on the tour as Next, and is passed over without a league', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, standings });
    setCamp(2, 1);
    renderAt('/vs');
    const tour = await screen.findByRole('dialog', { name: /drill 3 of 6/ });
    tour.dispatchEvent(new Event('close'));
    await waitFor(() => expect(stored()).toEqual({ phase: 'running', step: 2, sub: 2 }));
  });

  it('is passed over when there is no league to compare', async () => {
    setCamp(2);
    renderAt('/');
    await waitFor(() => expect(stored()).toMatchObject({ step: 3 }));
  });
});

describe('drill 4: importing a league', () => {
  const openAndClickLinks = async () => {
    setCamp(3);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await cardSays('Here you tell me which league');
    await userEvent.click(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'));
    await cardSays('press Load leagues');
    await userEvent.type(screen.getByLabelText('ESPN fantasy football league links or IDs, one per line'), '1900128084');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' }));
  };

  it('goes from the link box to Load leagues, the settings found, the warnings, the tick and the import', async () => {
    mockFetch(settingsRoute);
    await openAndClickLinks();
    // A public league has no private box: that step is passed over once the result is in.
    await cardSays('lineup slots and scoring rules');
    expect(stored()).toMatchObject({ step: 3, sub: 4 });
    await next();
    await cardSays('cannot be scored exactly');
    await next();
    await cardSays('accept the warnings');
    await userEvent.click(screen.getByLabelText(/Import the approximate profile for league 1900128084/));
    await cardSays('Import selected leagues');
    await userEvent.click(screen.getByRole('button', { name: /Import selected leagues/ }));
    await waitFor(() => expect(stored()).toMatchObject({ step: 4, sub: 0 }), slow); // the sync drill, now there is an ESPN league
  });

  it('asks for the pasted settings first when the league is private, and goes on once they are in', async () => {
    mockFetch({ 'seasons/2026/segments/0/leagues/1900128084?view=mSettings': { __status: 401 } });
    await openAndClickLinks();
    await cardSays('This league is private');
    const area = await screen.findByLabelText('Settings JSON for league 1900128084, season 2026');
    await userEvent.click(area);
    await userEvent.paste(JSON.stringify(settings));
    await cardSays('lineup slots and scoring rules');
  });

  it('only lets the link box, the season and Load leagues be pressed, not the rest of the dialog', async () => {
    mockFetch(settingsRoute);
    setCamp(3);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    await cardSays('Here you tell me which league');
    await userEvent.click(screen.getByRole('button', { name: 'Load leagues' })); // not a target of this step
    expect(stored()).toMatchObject({ step: 3, sub: 1 });
    expect(screen.queryByText(/Paste at least one/)).toBeNull();
  });

  it('skips the warning steps for a league with none', () => {
    const none: Ctx = { facts: { leagues: 1, followed: 0, path: '/leagues', imported: false, practice: false }, q: () => null, memo: {} };
    const steps = DRILLS[3]!.steps;
    expect(steps.filter((s) => s.skipIf?.(none)).map((s) => stepText(s, none.facts).slice(0, 9))).toEqual(['Some of t', 'To go on ']);
  });
});

describe('drill 5: syncing starters', () => {
  const routes = { scoreboard: scoreboardFixture, standings, 'leagues/1900128084?view=mRoster': lineups };

  it('is passed over when there is no ESPN league, such as the practice league alone', async () => {
    seed([], [{ ...imported, source: undefined }]);
    setCamp(4);
    renderAt('/');
    await waitFor(() => expect(stored()).toMatchObject({ step: 5 }));
  });

  it('goes from the button to the team, the checkbox, the three lists and the Sync starters button', async () => {
    mockFetch(routes);
    seed([], [imported]);
    setCamp(4);
    renderAt('/');
    await cardSays('Press Sync starters');
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sync starters' }));
    await cardSays('choose your own team');
    await userEvent.selectOptions(await screen.findByLabelText('Your team in this league'), '1');
    await cardSays('stop following players');
    await next();
    await cardSays('players to be added');
    await next();
    await cardSays('Press Sync starters to follow them');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sync starters' }));
    await waitFor(() => expect(stored()).toMatchObject({ step: 5, sub: 0 }), slow);
  });
});
