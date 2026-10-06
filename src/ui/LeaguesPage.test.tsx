import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import summary from '../test/fixtures/summary-pit-cle.json';
import { mahomes, opponent, pitDefense, profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

import { PRESETS, copyValues } from '../scoring/presets';

// A first run has no league, so most of these tests start from one called My league; those that seed their own replace it.
const myLeague = { id: 'my-league', name: 'My league', preset: 'ppr' as const, values: copyValues(PRESETS.ppr), color: '#1f4fd8' };
beforeEach(() => seed([], [myLeague]));

const profiles = () => JSON.parse(localStorage.getItem('nflsw:v1:profiles') ?? '[]');
const fieldset = (name: string) => screen.getByRole('group', { name });
/** Nothing is selected when the page opens, so every test picks a league first. */
const pick = (name = 'My league') => userEvent.click(screen.getByRole('button', { name }));
const saveButtons = () => screen.queryAllByRole('button', { name: 'Save' });
const save = () => userEvent.click(saveButtons()[0]!);
const open = async (name = 'My league') => { renderAt('/leagues'); await pick(name); };

describe('leagues page', () => {
  it('opens with no league selected and asks the user to pick one', () => {
    renderAt('/leagues');
    expect(screen.getByText(/Select a league on the left to edit its scoring/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete league' })).not.toBeInTheDocument();
    expect(saveButtons()).toEqual([]);
    for (const b of screen.getAllByRole('button', { name: 'My league' })) expect(b).not.toHaveAttribute('aria-current');
  });

  it('keeps the title with the left menu, and the header with the tabs always visible', () => {
    renderAt('/leagues');
    const menu = screen.getByRole('complementary', { name: 'Profile actions' });
    expect(within(menu).getByRole('heading', { level: 2, name: 'Leagues' })).toBeInTheDocument(); // sticks with the list, not above it
    expect(within(screen.getByRole('banner')).getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it.each(['/', '/vs', '/leagues'])('puts the same pinned header, with the tabs, on %s', (path) => {
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt(path);
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('top-bar'); // pinned to the top by the .top-bar rule, wherever the page scrolls
    expect(within(banner).getByRole('heading', { level: 1, name: 'Stat Watch' })).toBeInTheDocument();
    expect(within(within(banner).getByRole('navigation', { name: 'Main' })).getAllByRole('link').map((l) => l.textContent)).toEqual(['Players', 'Vs Mode', 'Leagues', 'Settings']);
  });

  describe('collapsible boxes', () => {
    const toggle = (name: string) => within(fieldset(name)).getByRole('button', { name });

    it('turns every box title into its own toggle, with no second selector above it', async () => {
      await open();
      expect(document.querySelector('.profile-form details.rule-group')).toBeNull();
      for (const name of ['Offense', 'Offense bonuses', 'Offense volume', 'Kicker', 'IDP', 'Team defense', 'Team defense yards allowed']) {
        expect(toggle(name)).toHaveAttribute('aria-expanded');
        expect(screen.getAllByText(name)).toHaveLength(1); // the title is shown once, not once as a selector and again as a heading
      }
    });

    it('starts the main boxes open and the optional ones closed, then folds and unfolds each by its title', async () => {
      await open();
      expect(toggle('Offense')).toHaveAttribute('aria-expanded', 'true');
      expect(toggle('Offense bonuses')).toHaveAttribute('aria-expanded', 'false');
      expect(within(fieldset('Offense')).getByLabelText('Passing TD')).toBeVisible();
      await userEvent.click(toggle('Offense'));
      expect(toggle('Offense')).toHaveAttribute('aria-expanded', 'false');
      expect(within(fieldset('Offense')).getByLabelText('Passing TD', { selector: 'input' })).not.toBeVisible();
      await userEvent.click(toggle('Offense bonuses'));
      expect(within(fieldset('Offense bonuses')).getByLabelText('40+ yard passing TD')).toBeVisible();
      await userEvent.click(toggle('Offense'));
      expect(within(fieldset('Offense')).getByLabelText('Passing TD')).toBeVisible();
    });

    it('can fold the stepped rules and the points-allowed ranges of an imported league too', async () => {
      const { PRESETS } = await import('../scoring/presets');
      const values = { ...PRESETS.ppr, steps: [{ stat: 'passYards' as const, every: 25, points: 1 }], pointsAllowedBands: [{ min: 0, max: 6, points: 7 }, { min: 7, max: null, points: 0 }] };
      seed([], [{ ...profilesFixture[0]!, values }]);
      await open('Office league');
      for (const name of ['Stepped rules', 'Team defense points allowed']) {
        await userEvent.click(toggle(name));
        expect(toggle(name)).toHaveAttribute('aria-expanded', 'false');
      }
      expect(within(fieldset('Stepped rules')).getByLabelText('Every 25 passing yards', { selector: 'input' })).not.toBeVisible();
    });

    it('keeps edits made in a box that is then folded, and still saves them', async () => {
      await open();
      const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
      await userEvent.clear(passTd);
      await userEvent.type(passTd, '7');
      await userEvent.click(toggle('Offense'));
      expect(saveButtons()).toHaveLength(2); // the change is still pending
      await save();
      expect(profiles()[0].values.passTd).toBe(7);
    });
  });

  it('shows the form and a Delete league button in the left menu once a league is selected', async () => {
    seed([], profilesFixture);
    await open('Office league');
    expect(screen.getByRole('button', { name: 'Office league' })).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText(/Select a league on the left/)).not.toBeInTheDocument();
    const menu = screen.getByRole('complementary', { name: 'Profile actions' });
    expect(within(menu).getByRole('button', { name: 'Delete league' })).toHaveClass('btn-danger');
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Office league', 'Friends league', 'Add a league', 'Import leagues', 'Import StatWatch profile', 'Export profile', 'Delete league']);
    expect(screen.getAllByRole('button', { name: 'Delete league' })).toHaveLength(1); // moved from the bottom of the form, not repeated
  });

  it('keeps edits in a working copy and shows Save and Cancel in the menu and at the end of the form', async () => {
    await open();
    expect(saveButtons()).toEqual([]);
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '6');
    expect(profiles()[0].values.passTd).toBe(4); // not saved yet
    expect(screen.getByLabelText('Preset')).toHaveValue('custom');
    expect(saveButtons()).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(2);
    const menu = screen.getByRole('complementary', { name: 'Profile actions' });
    expect(within(menu).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Edit My league' })).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await save();
    expect(profiles()[0].values.passTd).toBe(6);
    expect(profiles()[0].preset).toBe('custom');
    expect(saveButtons()).toEqual([]); // nothing left to save
    expect(screen.getByText('Saved My league.')).toBeInTheDocument();
  });

  it('puts the saved values back when Cancel is pressed, from either place', async () => {
    await open();
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '9');
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]!); // the one at the bottom of the form
    expect(passTd).toHaveValue(4);
    expect(screen.getByLabelText('Preset')).toHaveValue('ppr');
    expect(saveButtons()).toEqual([]);
    expect(profiles()[0].values.passTd).toBe(4);
    await userEvent.clear(within(fieldset('Offense')).getByLabelText('Reception'));
    await userEvent.type(within(fieldset('Offense')).getByLabelText('Reception'), '3');
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!); // the one in the menu
    expect(within(fieldset('Offense')).getByLabelText('Reception')).toHaveValue(1);
  });

  it('counts a changed switch, name, colour and preset as changes too', async () => {
    seed([], profilesFixture);
    await open('Office league');
    await userEvent.click(within(fieldset('Offense')).getByRole('checkbox', { name: 'Count Passing TD' }));
    expect(saveButtons()).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!);
    expect(saveButtons()).toEqual([]);
    await userEvent.type(screen.getByLabelText('Name'), 'x');
    expect(saveButtons()).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!);
    expect(screen.getByLabelText('Name')).toHaveValue('Office league'); // the name box follows the reset
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#123456' } });
    expect(saveButtons()).toHaveLength(2);
  });

  it('asks before switching league with unsaved changes, and keeps them if the user declines', async () => {
    seed([], profilesFixture);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await open('Office league');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '7');
    await pick('Friends league');
    expect(confirm).toHaveBeenCalledWith('Discard the unsaved changes to Office league?');
    expect(screen.getByRole('button', { name: 'Office league' })).toHaveAttribute('aria-current', 'true');
    expect(within(fieldset('Offense')).getByLabelText('Passing TD')).toHaveValue(7);
    await pick('Friends league');
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveAttribute('aria-current', 'true');
    expect(profiles()[0].values.passTd).toBe(4); // discarded, never saved
    await pick('Office league');
    expect(within(fieldset('Offense')).getByLabelText('Passing TD')).toHaveValue(4);
    expect(confirm).toHaveBeenCalledTimes(2); // no question when nothing is unsaved
  });

  it('edits points-allowed tiers', async () => {
    await open();
    const tier = within(fieldset('Team defense')).getByLabelText('0 points allowed');
    await userEvent.clear(tier);
    await userEvent.type(tier, '12');
    await save();
    expect(profiles()[0].values.pointsAllowed[0]).toBe(12);
  });

  it('restores the stored value when a cleared field is blurred', async () => {
    await open();
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    expect(passTd).toHaveValue(null);
    expect(profiles()[0].values.passTd).toBe(4);
    await userEvent.tab();
    expect(passTd).toHaveValue(4);
    expect(profiles()[0].values.passTd).toBe(4);
  });

  it('restores a cleared field after a preset keeps the same value', async () => {
    renderAt('/leagues');
    await pick();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    await userEvent.click(document.body);
    expect(passTd).toHaveValue(4);
  });

  it('does not steal focus on mount in StrictMode', async () => {
    seed([warren], profilesFixture);
    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/leagues']}>
            <AppRoutes />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
    expect(document.body).toHaveFocus();
    await pick('Office league');
    expect(screen.getByRole('button', { name: 'Delete league' })).not.toHaveFocus();
  });

  it('trims a name on blur and falls back when empty, saving it only on Save', async () => {
    await open();
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    expect(profiles()[0].name).toBe('My league');
    await userEvent.type(name, '  Spaced  ');
    await userEvent.tab();
    expect(name).toHaveValue('Spaced');
    expect(profiles()[0].name).toBe('My league'); // still the saved name
    await save();
    expect(profiles()[0].name).toBe('Spaced');
    await userEvent.clear(name);
    await userEvent.tab();
    expect(name).toHaveValue('Untitled league');
    await save();
    expect(profiles()[0].name).toBe('Untitled league');
  });

  it('suffixes a duplicate name on blur', async () => {
    seed([], profilesFixture);
    await open('Office league');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'friends LEAGUE');
    await userEvent.tab();
    expect(name).toHaveValue('friends LEAGUE 2');
    await save();
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['friends LEAGUE 2', 'Friends league']);
  });

  it('never saves a name that clashes with another league, even if the field was not left first', async () => {
    seed([], profilesFixture);
    await open('Office league');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Friends league'); // no blur
    await save();
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['Friends league 2', 'Friends league']);
  });

  it('adds a profile, selects it, and shows a rename only after Save', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('New league');
    expect(screen.getByRole('button', { name: 'New league' })).toHaveAttribute('aria-current', 'true');
    await userEvent.clear(name);
    await userEvent.type(name, 'Dynasty');
    expect(screen.getByRole('button', { name: 'New league' })).toBeInTheDocument(); // the list still shows the saved name
    await save();
    expect(screen.getByRole('button', { name: 'Dynasty' })).toHaveAttribute('aria-current', 'true');
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['My league', 'Dynasty']);
  });

  it('applies a preset to the working copy only after confirmation, and keeps it only on Save', async () => {
    seed([], profilesFixture);
    await open('Office league');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const reception = () => within(fieldset('Offense')).getByLabelText('Reception');
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    expect(confirm).not.toHaveBeenCalled();
    expect(reception()).toHaveValue(1);
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    expect(reception()).toHaveValue(1);
    expect(screen.getByLabelText('Preset')).toHaveValue('ppr');
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    expect(reception()).toHaveValue(0);
    expect(profiles()[0].values.reception).toBe(1); // not saved yet
    await save();
    expect(profiles()[0].values.reception).toBe(0);
    expect(profiles()[0].preset).toBe('standard');
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('disables Apply preset while the preset reads Custom', async () => {
    await open();
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '6');
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeDisabled();
  });

  it('disables Apply preset when the pick equals the current preset', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeEnabled();
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'ppr');
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeDisabled();
  });

  it('clears a number field message when a preset changes the value', async () => {
    await open();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const recv = within(fieldset('Offense')).getByLabelText('Reception');
    await userEvent.clear(recv);
    await userEvent.tab();
    expect(screen.getByText('Enter a number. Restored 1.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    expect(screen.queryByText('Enter a number. Restored 1.')).not.toBeInTheDocument();
  });

  it('says what was restored when a number field is left invalid, and clears it on the next edit', async () => {
    await open();
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.tab();
    const msg = screen.getByText('Enter a number. Restored 4.');
    expect(msg).toHaveAttribute('role', 'status');
    expect(passTd).toHaveAccessibleDescription('Enter a number. Restored 4.');
    expect(screen.getByRole('spinbutton', { name: 'Passing TD' })).toBe(passTd);
    await userEvent.type(passTd, '5');
    expect(screen.queryByText('Enter a number. Restored 4.')).not.toBeInTheDocument();
    expect(passTd).not.toHaveAttribute('aria-describedby');
  });

  it('says why a profile name was corrected and clears it on the next edit', async () => {
    seed([], profilesFixture);
    await open('Office league');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription('Name was empty. Using Untitled league.');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    await userEvent.type(name, 'x');
    expect(name).not.toHaveAccessibleDescription();
    await userEvent.clear(name);
    await userEvent.type(name, 'friends league');
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription('That name is taken. Using friends league 2.');
    await userEvent.type(name, '!');
    expect(screen.queryByText(/That name is taken/)).not.toBeInTheDocument();
  });

  it('does not report a correction when a name only needed trimming', async () => {
    await open();
    const name = screen.getByLabelText('Name');
    await userEvent.type(name, '  ');
    await userEvent.tab();
    expect(name).not.toHaveAccessibleDescription();
  });

  it('lists profiles in a plain list under a heading, not a nav', () => {
    renderAt('/leagues');
    expect(screen.queryByRole('navigation', { name: 'Profiles' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profiles' })).toBeInTheDocument();
  });

  it('changes card points on the main screen once the change is saved', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    const { unmount } = renderAt('/leagues');
    await pick('Office league');
    const reception = within(fieldset('Offense')).getByLabelText('Reception');
    await userEvent.clear(reception);
    await userEvent.type(reception, '0');
    await save();
    unmount();
    renderAt('/');
    expect(await screen.findByText('12.60')).toBeInTheDocument();
  });

  it('switches a rule off, keeps its weight and scores nothing for it, once saved', async () => {
    await open();
    const toggle = within(fieldset('Offense')).getByRole('checkbox', { name: 'Count Passing TD' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(within(fieldset('Offense')).getByLabelText('Passing TD')).toBeDisabled();
    expect(profiles()[0].values.off).toBeUndefined(); // not saved yet
    await save();
    expect(profiles()[0].values.off).toEqual(['passTd']);
    expect(profiles()[0].values.passTd).toBe(4);
    await userEvent.click(within(fieldset('Offense')).getByRole('checkbox', { name: 'Count Passing TD' }));
    await save();
    expect(profiles()[0].values.off).toBeUndefined();
  });

  it('offers the bonus rules and says which ones the live feed cannot score', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Offense bonuses' }));
    expect(within(fieldset('Offense bonuses')).getByLabelText('40+ yard passing TD')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Offense volume' }));
    const recoveryTd = within(fieldset('Offense volume')).getByLabelText('Fumble recovered for TD');
    expect(within(fieldset('Offense volume')).queryByText(/never scores/)).not.toBeInTheDocument();
    await userEvent.clear(recoveryTd);
    await userEvent.type(recoveryTd, '6');
    expect(within(fieldset('Offense volume')).getByText(/never scores/)).toBeInTheDocument();
    const forced = within(fieldset('IDP')).getByLabelText('Forced fumble');
    await userEvent.clear(forced);
    await userEvent.type(forced, '2');
    expect(within(fieldset('IDP')).getByText(/may be inaccurate/)).toBeInTheDocument();
  });

  it('edits the league colour, previews it at once, and shows it on the list dot and the card tag after Save', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    renderAt('/leagues');
    await pick('Office league');
    const picker = screen.getByLabelText('Color') as HTMLInputElement;
    expect(picker.value).toMatch(/^#[0-9a-f]{6}$/);
    fireEvent.input(picker, { target: { value: '#ff0000' } });
    fireEvent.change(picker, { target: { value: '#ff0000' } });
    expect(document.querySelector('.color-row .chip')).toHaveStyle({ background: '#ff0000' });
    expect(profiles()[0].color).not.toBe('#ff0000'); // not saved yet
    await save();
    expect(profiles()[0].color).toBe('#ff0000');
    expect(document.querySelector('[data-profile="p1"] .profile-dot')).toHaveStyle({ background: '#ff0000' });
  });

  it('warns the browser before the tab is closed with unsaved changes, and not otherwise', async () => {
    await open();
    const closing = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
    expect(closing()).toBe(false);
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '8');
    expect(closing()).toBe(true);
    await save();
    expect(closing()).toBe(false);
  });

  it('starts the working copy over when the saved league changes underneath it, for example after a refresh', async () => {
    await open();
    const passTd = () => within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd());
    await userEvent.type(passTd(), '8');
    const { act } = await import('@testing-library/react');
    const { profilesStore } = await import('../storage/profiles');
    act(() => profilesStore.set(profilesStore.get().map((p) => ({ ...p, values: { ...p.values, passTd: 5 } }))));
    expect(passTd()).toHaveValue(5); // never a stale draft over fresher saved values
    expect(saveButtons()).toEqual([]);
  });
});

describe('delete league dialog', () => {
  const dialog = () => screen.getByRole('dialog');
  const launch = async (followed: Parameters<typeof seed>[0]) => {
    seed(followed, profilesFixture);
    await open('Office league');
    await userEvent.click(screen.getByRole('button', { name: 'Delete league' }));
  };
  const remaining = () => JSON.parse(localStorage.getItem('nflsw:v1:followed')!) as { espnId: string; profileId: string; side?: string }[];

  it('opens a proper dialog instead of an inline box, with Delete league and Cancel', async () => {
    await launch([warren]);
    expect(within(dialog()).getByRole('heading', { name: 'Delete Office league?' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Delete league' })).toHaveClass('btn-danger');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(profiles()).toHaveLength(2); // nothing deleted
  });

  it('asks nothing when no players follow the league', async () => {
    await launch([]);
    expect(within(dialog()).getByText('No players follow this league.')).toBeInTheDocument();
    expect(within(dialog()).queryByRole('radio')).not.toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(profiles().map((p: { id: string }) => p.id)).toEqual(['p2']);
  });

  it('moves my players to the chosen league by default, and deletes the opponent players', async () => {
    await launch([warren, opponent(pitDefense), opponent({ ...mahomes, profileId: 'p1' })]);
    expect(within(dialog()).getByRole('radio', { name: 'Move 1 player to' })).toBeChecked();
    expect(within(dialog()).getByText('The 2 opponent players are deleted.')).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('League to move your players to')).toHaveValue('p2');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(remaining()).toEqual([{ ...warren, profileId: 'p2' }]);
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveFocus();
  });

  it('can move the opponent players along with mine', async () => {
    await launch([warren, opponent(pitDefense)]);
    await userEvent.click(within(dialog()).getByRole('radio', { name: 'Move 1 player and 1 opponent player to' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(remaining().map((e) => [e.espnId, e.profileId, e.side])).toEqual([[warren.espnId, 'p2', undefined], [pitDefense.espnId, 'p2', 'opponent']]);
  });

  it('can delete the players with the league', async () => {
    await launch([warren, opponent(pitDefense), { ...mahomes, profileId: 'p2' }]);
    await userEvent.click(within(dialog()).getByRole('radio', { name: 'Delete existing players' }));
    expect(within(dialog()).getByLabelText('League to move your players to')).toBeDisabled();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(remaining().map((e) => e.espnId)).toEqual([mahomes.espnId]); // the other league's player stays
    expect(profiles().map((p: { id: string }) => p.id)).toEqual(['p2']);
  });

  it('offers only the opponent choice when just opponent players follow it', async () => {
    await launch([opponent(pitDefense)]);
    expect(within(dialog()).queryByRole('radio', { name: /^Move 1 player to/ })).not.toBeInTheDocument();
    expect(within(dialog()).getByRole('radio', { name: 'Move 1 opponent player to' })).toBeChecked();
  });

  it('moves to the league picked in the selector', async () => {
    seed([warren], [...profilesFixture, { ...profilesFixture[1]!, id: 'p3', name: 'Third league' }]);
    await open('Office league');
    await userEvent.click(screen.getByRole('button', { name: 'Delete league' }));
    await userEvent.selectOptions(within(dialog()).getByLabelText('League to move your players to'), 'Third league');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(remaining()[0]!.profileId).toBe('p3');
  });

  it('on the last league greys out the move choices, preselects deleting the players, and leaves no league', async () => {
    seed([warren, opponent(pitDefense)], [profilesFixture[0]!]);
    await open('Office league');
    await userEvent.click(screen.getByRole('button', { name: 'Delete league' }));
    expect(within(dialog()).getByText(/last league, so there is nowhere to move players to/)).toBeInTheDocument();
    expect(within(dialog()).getByRole('radio', { name: 'Move 1 player to' })).toBeDisabled();
    expect(within(dialog()).getByRole('radio', { name: 'Move 1 player and 1 opponent player to' })).toBeDisabled();
    expect(within(dialog()).getByRole('radio', { name: 'Delete existing players' })).toBeChecked();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete league' }));
    expect(profiles()).toEqual([]);
    expect(remaining()).toEqual([]);
    expect(screen.getByText('You have no leagues yet. Add or import one from the menu to start following players.')).toBeInTheDocument();
  });
});

describe('with no league', () => {
  it('says to add or import one, and has nothing to export yet', () => {
    seed([], []);
    renderAt('/leagues');
    expect(screen.getByText('You have no leagues yet. Add or import one from the menu to start following players.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export profile' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('has the mascot say so in a speech bubble, pointing at the menu on the left', () => {
    seed([], []);
    renderAt('/leagues');
    const says = document.querySelector('.mascot-says') as HTMLElement;
    expect(says.querySelector('.mascot')).toHaveClass('pointing-left');
    expect(says.querySelector('.bubble')).toHaveTextContent('You have no leagues yet. Add or import one from the menu');
  });

  it('shows the plain prompt, not the mascot, once a league exists but none is selected', () => {
    renderAt('/leagues');
    expect(document.querySelector('.mascot-says')).toBeNull();
    expect(screen.getByText(/Select a league on the left to edit its scoring/)).toBeInTheDocument();
  });

  it('lets the first league be added', async () => {
    seed([], []);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Add a league' }));
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['New league']);
  });
});
