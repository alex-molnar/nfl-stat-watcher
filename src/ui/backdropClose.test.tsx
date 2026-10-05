import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { profilesFixture, scoreboardFixture, warren } from '../test/data';
import { mockFetch } from '../test/mockFetch';
import { renderAt, seed } from '../test/render';

const open = (name: RegExp) => screen.getByRole('dialog', { name, hidden: false });

describe('closing a dialog from the backdrop', () => {
  async function addDialog() {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add player' })[0]!);
    return open(/Add a player or defense/);
  }

  it('closes when the dimmed area is clicked', async () => {
    const dialog = await addDialog();
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays open for a click inside it', async () => {
    const dialog = await addDialog();
    const inside = dialog.querySelector('input')!;
    fireEvent.mouseDown(inside);
    fireEvent.click(inside);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays open when a press started inside (a text selection) is released over the backdrop', async () => {
    const dialog = await addDialog();
    fireEvent.mouseDown(dialog.querySelector('input')!);
    fireEvent.click(dialog); // the browser reports the release on the common ancestor, the dialog itself
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the other dialogs the same way', async () => {
    seed([warren], profilesFixture);
    mockFetch({ scoreboard: scoreboardFixture });
    renderAt('/settings');
    await userEvent.click(screen.getByRole('button', { name: 'Import leagues' }));
    const dialog = open(/Import ESPN leagues/);
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
