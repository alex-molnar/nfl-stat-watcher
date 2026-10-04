import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import summary from '../test/fixtures/summary-pit-cle.json';
import { profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const profiles = () => JSON.parse(localStorage.getItem('nflsw:v1:profiles') ?? '[]');
const fieldset = (name: string) => screen.getByRole('group', { name });

describe('settings page', () => {
  it('shows the default profile and saves an edited value as custom', async () => {
    renderAt('/settings');
    expect(screen.getByRole('button', { name: 'My league' })).toHaveAttribute('aria-current', 'true');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '6');
    expect(profiles()[0].values.passTd).toBe(6);
    expect(profiles()[0].preset).toBe('custom');
    expect(screen.getByLabelText('Preset')).toHaveValue('custom');
  });

  it('edits points-allowed tiers', async () => {
    renderAt('/settings');
    const tier = within(fieldset('Team defense')).getByLabelText('0 points allowed');
    await userEvent.clear(tier);
    await userEvent.type(tier, '12');
    expect(profiles()[0].values.pointsAllowed[0]).toBe(12);
  });

  it('restores the stored value when a cleared field is blurred', async () => {
    renderAt('/settings');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    expect(passTd).toHaveValue(null);
    expect(profiles()[0].values.passTd).toBe(4);
    await userEvent.tab();
    expect(passTd).toHaveValue(4);
    expect(profiles()[0].values.passTd).toBe(4);
  });

  it('restores a cleared field after a preset keeps the same value', async () => {
    renderAt('/settings');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    await userEvent.click(document.body);
    expect(passTd).toHaveValue(4);
  });

  it('moves focus into the delete confirmation and back on cancel', async () => {
    seed([warren], profilesFixture);
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByLabelText('Move 1 followed card to')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete profile' })).toHaveFocus();
  });

  it('does not steal focus on mount and still moves it correctly in StrictMode', async () => {
    seed([warren], profilesFixture);
    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={['/settings']}>
            <AppRoutes />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
    const del = screen.getByRole('button', { name: 'Delete profile' });
    expect(del).not.toHaveFocus();
    await userEvent.click(del);
    expect(screen.getByLabelText('Move 1 followed card to')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete profile' })).toHaveFocus();
  });

  it('focuses Cancel when no followed cards use the profile', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('trims a name on blur and falls back when empty', async () => {
    renderAt('/settings');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    expect(profiles()[0].name).toBe('My league');
    await userEvent.type(name, '  Spaced  ');
    await userEvent.tab();
    expect(profiles()[0].name).toBe('Spaced');
    expect(name).toHaveValue('Spaced');
    await userEvent.clear(name);
    await userEvent.tab();
    expect(profiles()[0].name).toBe('Untitled league');
    expect(name).toHaveValue('Untitled league');
  });

  it('suffixes a duplicate name on blur', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'friends LEAGUE');
    await userEvent.tab();
    expect(name).toHaveValue('friends LEAGUE 2');
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['friends LEAGUE 2', 'Friends league']);
  });

  it('describes the disabled delete button', () => {
    renderAt('/settings');
    expect(screen.getByRole('button', { name: 'Delete profile' })).toHaveAccessibleDescription('You need at least one profile.');
  });

  it('adds and renames a profile', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Add profile' }));
    const name = screen.getByLabelText('Name');
    expect(name).toHaveValue('New league');
    await userEvent.clear(name);
    await userEvent.type(name, 'Dynasty');
    expect(screen.getByRole('button', { name: 'Dynasty' })).toHaveAttribute('aria-current', 'true');
    expect(profiles().map((p: { name: string }) => p.name)).toEqual(['My league', 'Dynasty']);
  });

  it('applies a preset only after confirmation on the Apply preset button', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'standard');
    expect(confirm).not.toHaveBeenCalled();
    expect(profiles()[0].values.reception).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    expect(profiles()[0].values.reception).toBe(1);
    expect(screen.getByLabelText('Preset')).toHaveValue('standard');
    await userEvent.click(screen.getByRole('button', { name: 'Apply preset' }));
    expect(profiles()[0].values.reception).toBe(0);
    expect(profiles()[0].preset).toBe('standard');
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('disables Apply preset while the preset reads Custom', async () => {
    renderAt('/settings');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.type(passTd, '6');
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeDisabled();
  });

  it('says what was restored when a number field is left invalid, and clears it on the next edit', async () => {
    renderAt('/settings');
    const passTd = within(fieldset('Offense')).getByLabelText('Passing TD');
    await userEvent.clear(passTd);
    await userEvent.tab();
    const msg = screen.getByText('Enter a number. Restored 4.');
    expect(msg).toHaveAttribute('role', 'status');
    expect(passTd).toHaveAccessibleDescription('Enter a number. Restored 4.');
    await userEvent.type(passTd, '5');
    expect(screen.queryByText('Enter a number. Restored 4.')).not.toBeInTheDocument();
    expect(passTd).not.toHaveAttribute('aria-describedby');
  });

  it('says why a profile name was corrected and clears it on the next edit', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.tab();
    expect(name).toHaveAccessibleDescription('Name was empty. Using Untitled league.');
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
    renderAt('/settings');
    const name = screen.getByLabelText('Name');
    await userEvent.type(name, '  ');
    await userEvent.tab();
    expect(name).not.toHaveAccessibleDescription();
  });

  it('describes the delete question on the focused Cancel button', async () => {
    seed([], profilesFixture);
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAccessibleDescription('Delete Office league? No followed cards use it.');
  });

  it('lists profiles in a plain list under a heading, not a nav', () => {
    renderAt('/settings');
    expect(screen.queryByRole('navigation', { name: 'Profiles' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profiles' })).toBeInTheDocument();
  });

  it('does not allow deleting the last profile', () => {
    renderAt('/settings');
    expect(screen.getByRole('button', { name: 'Delete profile' })).toBeDisabled();
  });

  it('moves followed cards when deleting a profile', async () => {
    seed([warren], profilesFixture);
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByLabelText('Move 1 followed card to')).toHaveValue('p2');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Office league' }));
    expect(profiles().map((p: { id: string }) => p.id)).toEqual(['p2']);
    expect(JSON.parse(localStorage.getItem('nflsw:v1:followed')!)[0].profileId).toBe('p2');
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Friends league' })).toHaveFocus();
  });

  it('changes card points on the main screen', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture, 'summary?event=401872964': summary });
    const { unmount } = renderAt('/settings');
    const reception = within(fieldset('Offense')).getByLabelText('Reception');
    await userEvent.clear(reception);
    await userEvent.type(reception, '0');
    unmount();
    renderAt('/');
    expect(await screen.findByText('12.60')).toBeInTheDocument();
  });
});
