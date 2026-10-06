import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { exportProfile, parseProfileFile, serializeProfile } from '../leagues/profileTransfer';
import { profilesFixture, warren, opponent } from '../test/data';
import { renderAt, seed } from '../test/render';

const stored = (key: string) => JSON.parse(localStorage.getItem(`nflsw:v1:${key}`) ?? '[]');
const exportButton = () => screen.getByRole('button', { name: 'Export profile' });
const importButton = () => screen.getByRole('button', { name: 'Import StatWatch profile' });
const dialog = () => screen.getByRole('dialog');
const incoming = () => serializeProfile(exportProfile([{ ...profilesFixture[0]!, id: 'other', name: 'Brought along' }], [{ ...warren, profileId: 'other' }, { ...opponent(warren), profileId: 'other' }]));

describe('export profile', () => {
  it('shows every league with its players as JSON and offers copy and download', async () => {
    seed([warren, opponent(warren)], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(exportButton());
    const shown = parseProfileFile((within(dialog()).getByLabelText('Profile JSON') as HTMLTextAreaElement).value);
    expect(shown.leagues.map((l) => l.name)).toEqual(['Office league', 'Friends league']);
    expect(shown.leagues[0]!.players).toHaveLength(2);

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy to clipboard' }));
    expect(writeText).toHaveBeenCalledWith((within(dialog()).getByLabelText('Profile JSON') as HTMLTextAreaElement).value);
    expect(await within(dialog()).findByText('Copied to the clipboard.')).toBeInTheDocument();
  });

  it('downloads it as statwatch-profile.json, with no date in the name', async () => {
    seed([], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(exportButton());
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe('statwatch-profile.json'); });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Download' }));
    expect(click).toHaveBeenCalled();
    expect(await within(dialog()).findByText('Downloaded statwatch-profile.json.')).toBeInTheDocument();
  });

  it('says so, and selects the text, when the browser will not copy', async () => {
    seed([], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(exportButton());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy to clipboard' }));
    expect(await within(dialog()).findByText(/would not copy it/)).toBeInTheDocument();
  });
});

describe('import StatWatch profile', () => {
  const open = async () => { renderAt('/leagues'); await userEvent.click(importButton()); };
  const box = () => within(dialog()).getByLabelText('Profile JSON');
  const confirm = () => within(dialog()).getByRole('button', { name: 'Import' });

  it('checks pasted JSON at once, previews it, and merges it on Import', async () => {
    seed([warren], profilesFixture);
    await open();
    expect(confirm()).toBeDisabled();
    await userEvent.click(box());
    await userEvent.paste(incoming());
    const preview = await within(dialog()).findByRole('region', { name: 'What this import will do' });
    expect(within(preview).getByText('Update 0 leagues, add 1 league, add 2 players')).toBeInTheDocument();
    expect(within(preview).getByText(/Brought along \(2 new players\)/)).toBeInTheDocument();
    expect(stored('profiles')).toHaveLength(2); // nothing changed yet
    await userEvent.click(confirm());
    expect(stored('profiles').map((p: { name: string }) => p.name)).toEqual(['Office league', 'Friends league', 'Brought along']);
    expect(stored('followed')).toHaveLength(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Imported 1 league: 0 updated, 1 added, 2 players added.')).toBeInTheDocument();
  });

  it('shows what is wrong with the text and keeps Import off', async () => {
    seed([], profilesFixture);
    await open();
    await userEvent.click(box());
    await userEvent.paste('oops');
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('not valid JSON');
    expect(confirm()).toBeDisabled();
    fireEvent.change(box(), { target: { value: '{"app":"stat-watch","version":1,"leagues":[]}' } });
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('1 to 50 leagues');
  });

  it('reads a file dropped on the box', async () => {
    seed([], profilesFixture);
    await open();
    const file = new File([incoming()], 'statwatch-profile.json', { type: 'application/json' });
    fireEvent.drop(box(), { dataTransfer: { files: [file] } });
    expect(await within(dialog()).findByRole('region', { name: 'What this import will do' })).toBeInTheDocument();
    expect((box() as HTMLTextAreaElement).value).toContain('Brought along');
  });

  it('Browse computer opens the file picker, and a chosen file is read', async () => {
    seed([], profilesFixture);
    await open();
    const input = within(dialog()).getByLabelText('Profile file') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', '.json,application/json');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Browse computer' }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File([incoming()], 'p.json', { type: 'application/json' })] } });
    await waitFor(() => expect(within(dialog()).getByRole('region', { name: 'What this import will do' })).toBeInTheDocument());
  });

  it('updates a league that is already here and adds only the missing players', async () => {
    seed([warren], profilesFixture);
    await open();
    const same = serializeProfile(exportProfile([{ ...profilesFixture[0]!, name: 'Renamed in the file' }], [{ ...warren }, { ...opponent(warren) }]));
    await userEvent.click(box());
    await userEvent.paste(same);
    await userEvent.click(confirm());
    expect(stored('profiles').map((p: { name: string }) => p.name)).toEqual(['Renamed in the file', 'Friends league']);
    expect(stored('followed')).toHaveLength(2); // warren was there, the opponent side was missing
  });

  it('with "Override existing profiles" ticked deletes everything here first, and says so before and after', async () => {
    seed([warren, opponent(warren), { ...warren, espnId: '7', name: 'Other' }], profilesFixture);
    await open();
    await userEvent.click(box());
    await userEvent.paste(incoming());
    expect(within(dialog()).getByRole('checkbox', { name: 'Override existing profiles' })).not.toBeChecked(); // off by default
    await userEvent.click(within(dialog()).getByRole('checkbox', { name: 'Override existing profiles' }));
    expect(within(dialog()).getByText(/Everything here is deleted first/)).toBeInTheDocument();
    expect(within(dialog()).getByText('Delete 2 leagues and 3 players here, then add 1 league and 2 players')).toBeInTheDocument();
    expect(stored('profiles')).toHaveLength(2); // nothing changed yet
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Replace everything' }));
    expect(stored('profiles').map((p: { name: string }) => p.name)).toEqual(['Brought along']);
    expect(stored('followed')).toHaveLength(2);
    expect(await screen.findByText('Replaced everything: deleted 2 leagues and 3 players, imported 1 league and 2 players.')).toBeInTheDocument();
  });

  it('Cancel changes nothing', async () => {
    seed([], profilesFixture);
    await open();
    await userEvent.click(box());
    await userEvent.paste(incoming());
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(stored('profiles')).toHaveLength(2);
  });
});
