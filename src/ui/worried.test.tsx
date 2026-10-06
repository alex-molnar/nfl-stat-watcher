import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mascotEnabledStore } from '../storage/mascot';
import { profilesFixture, warren } from '../test/data';
import { renderAt, seed } from '../test/render';
import { DialogMascot } from './DialogMascot';
import { Mascot } from './Mascot';

const perchMascot = () => document.querySelector('dialog[open] .perch-mascot');

describe('a worried mascot', () => {
  it('has brows that slant up in the middle and a smile that can turn down, each a part of its own', () => {
    const { container } = render(<Mascot worried />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveClass('worried');
    expect(svg.querySelector('.m-brow-l')).not.toBeNull();
    expect(svg.querySelector('.m-brow-r')).not.toBeNull();
    expect(svg.querySelector('.m-mouth')).not.toBeNull();
  });

  it('is not worried unless asked', () => {
    expect(render(<Mascot />).container.querySelector('svg')).not.toHaveClass('worried');
  });
});

describe('in a dialog that is marked as worrying', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); mascotEnabledStore.set(true); });

  const Sample = ({ worried }: { worried: boolean }) => (
    <dialog data-testid="dlg" data-worried={worried ? '' : undefined}><DialogMascot /></dialog>
  );
  const dlg = () => screen.getByTestId('dlg') as HTMLDialogElement;
  const open = async () => { await act(async () => { dlg().showModal(); }); act(() => { vi.advanceTimersByTime(250); }); };

  it('looks worried', async () => {
    render(<Sample worried />);
    await open();
    expect(dlg().querySelector('.perch-mascot')).toHaveClass('worried');
  });

  it('does not look worried in an ordinary dialog', async () => {
    render(<Sample worried={false} />);
    await open();
    expect(dlg().querySelector('.perch-mascot')).not.toHaveClass('worried');
  });

  it('starts and stops worrying as the dialog\'s mark comes and goes while it is open', async () => {
    render(<Sample worried={false} />);
    await open();
    await act(async () => { dlg().setAttribute('data-worried', ''); });
    expect(dlg().querySelector('.perch-mascot')).toHaveClass('worried');
    await act(async () => { dlg().removeAttribute('data-worried'); });
    expect(dlg().querySelector('.perch-mascot')).not.toHaveClass('worried');
  });
});

describe('the real dialogs', () => {
  it('Delete league: worried', async () => {
    seed([warren], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Office league' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete league' }));
    await waitFor(() => expect(perchMascot()).toHaveClass('worried'));
  });

  it('Clear my data: worried', async () => {
    renderAt('/settings');
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear my data' })[0]!);
    await waitFor(() => expect(perchMascot()).toHaveClass('worried'));
  });

  it('Import profile: calm, until "Override existing profiles" is ticked, and calm again when it is not', async () => {
    seed([], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Import StatWatch profile' }));
    await waitFor(() => expect(perchMascot()).not.toBeNull());
    expect(perchMascot()).not.toHaveClass('worried');
    const box = within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Override existing profiles' });
    await userEvent.click(box);
    await waitFor(() => expect(perchMascot()).toHaveClass('worried'));
    await userEvent.click(box);
    await waitFor(() => expect(perchMascot()).not.toHaveClass('worried'));
  });

  it('Export profile and Add player: calm', async () => {
    seed([], profilesFixture);
    renderAt('/leagues');
    await userEvent.click(screen.getByRole('button', { name: 'Export profile' }));
    await waitFor(() => expect(perchMascot()).not.toBeNull());
    expect(perchMascot()).not.toHaveClass('worried');
  });
});
