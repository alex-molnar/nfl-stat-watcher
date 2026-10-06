import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { profilesFixture, scoreboardFixture } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';
import { normalizeEspnLeague } from '../leagues/espn/scoring';
import { parseEspnLeagueSettings } from '../leagues/espn/parse';
import settings from '../test/fixtures/espn-fantasy/public-settings-1900128084-2026.json';
import { reloadAllStores } from '../storage/store';

const off = () => { localStorage.setItem('nflsw:v1:mascot', 'false'); reloadAllStores(); };
const noMascotAnywhere = () => { expect(document.querySelector('.mascot')).toBeNull(); expect(document.querySelector('.bubble')).toBeNull(); };
const draft = normalizeEspnLeague(parseEspnLeagueSettings(settings));
const imported = { id: 'p1', name: 'Tapai', preset: 'custom' as const, values: draft.values, source: draft.source };

beforeEach(() => mockFetch({ scoreboard: scoreboardFixture }));

describe('with the mascot switched off, every page uses plain text', () => {
  it('Players with no league: the sentence and the link, no mascot, no header mascot', () => {
    seed([], []);
    off();
    renderAt('/');
    noMascotAnywhere();
    const empty = document.querySelector('.empty') as HTMLElement;
    expect(empty).toHaveTextContent('Add a scoring league first to start following players.');
    expect(within(empty).getByRole('link', { name: 'Go to Leagues' })).toHaveAttribute('href', '/leagues');
    expect(screen.getByText('Add a scoring league first to start following players.')).toBeInTheDocument(); // plain text, found as text
  });

  it('Players with leagues and nobody followed: the same sentence and both buttons, as plain text', async () => {
    seed([], [imported]);
    off();
    renderAt('/');
    noMascotAnywhere();
    const empty = document.querySelector('.empty') as HTMLElement;
    expect(empty).toHaveTextContent("You're not following anyone yet. Add players or team defenses from any of your leagues. Alternatively sync your starters from your imported leagues.");
    await userEvent.click(within(empty).getByRole('button', { name: 'Sync starters' }));
    expect(await screen.findByRole('dialog', { name: 'Sync your starters' })).toBeInTheDocument();
  });

  it('Vs without a league', () => {
    seed([], []);
    off();
    renderAt('/vs');
    noMascotAnywhere();
    expect(screen.getByText('Add a scoring league first to compare a matchup.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Leagues' })).toBeInTheDocument();
  });

  it('Leagues with no league and with none selected', () => {
    seed([], []);
    off();
    const first = renderAt('/leagues');
    noMascotAnywhere();
    expect(screen.getByText('You have no leagues yet. Add or import one from the menu to start following players.')).toBeInTheDocument();
    first.unmount();
    seed([], profilesFixture);
    off();
    renderAt('/leagues');
    noMascotAnywhere();
    expect(screen.getByText('Select a league from the menu to edit its scoring, or add or import one.')).toBeInTheDocument();
  });

  it('a page that has the mascot in its header on a page with content also has none', () => {
    seed([], profilesFixture);
    off();
    renderAt('/settings');
    expect(document.querySelector('.brand .mascot')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stat Watch');
  });

  it('the Leagues menu explains its buttons in tooltips instead, and hovering changes nothing else', async () => {
    seed([], profilesFixture);
    off();
    renderAt('/leagues');
    expect(screen.getByRole('button', { name: 'Add a league' })).toHaveAttribute('title', 'Here you can add a new league from presets (PPR, half-PPR, non-PPR), or completely customize the league rules.');
    expect(screen.getByRole('button', { name: 'Import leagues' })).toHaveAttribute('title', expect.stringContaining('only ESPN leagues are supported for now'));
    expect(screen.getByRole('button', { name: 'Import StatWatch profile' })).toHaveAttribute('title', expect.stringContaining('another browser or device'));
    await userEvent.hover(screen.getByRole('button', { name: 'Add a league' }));
    expect(screen.getByText('Select a league from the menu to edit its scoring, or add or import one.')).toBeInTheDocument();
  });

  it('with the mascot on the menu buttons have no tooltips, the mascot explains them', () => {
    seed([], profilesFixture);
    renderAt('/leagues');
    expect(screen.getByRole('button', { name: 'Add a league' })).not.toHaveAttribute('title');
  });

  it('turning it back on brings everything back', () => {
    seed([], []);
    off();
    localStorage.setItem('nflsw:v1:mascot', 'true');
    reloadAllStores();
    renderAt('/');
    expect(document.querySelector('.mascot-says .mascot')).not.toBeNull();
  });
});
