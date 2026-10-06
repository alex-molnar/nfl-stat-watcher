import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { mascotEnabledStore } from '../storage/mascot';
import { DialogMascot, useHint } from './DialogMascot';
import { dialogsOpen } from './dialogsOpen';
import { Header } from './Header';

function Sample() {
  const hint = useHint();
  return (
    <dialog data-testid="dlg">
      <DialogMascot />
      <div className="dlg">
        <button type="button" {...hint('This does the thing.')}>Do it</button>
        <button type="button">Plain</button>
      </div>
    </dialog>
  );
}
const dlg = () => screen.getByTestId('dlg') as HTMLDialogElement;
const mascotIn = () => dlg().querySelector('.perch-mascot');
const bubble = () => dlg().querySelector('.perch-bubble');
const settle = () => act(() => { vi.advanceTimersByTime(250); });
// The dialog's open attribute is watched with a MutationObserver, whose callback is a microtask: hence the async act.
const open = async () => { await act(async () => { dlg().showModal(); }); settle(); };
const close = async () => { await act(async () => { dlg().close(); }); };

describe('the mascot in a dialog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); mascotEnabledStore.set(true); });

  it('is not there while the dialog is closed', async () => {
    render(<Sample />);
    expect(mascotIn()).toBeNull();
  });

  it('lands at once in a dialog with no opening animation (data-instant), without waiting for it to settle', async () => {
    render(<Sample />);
    dlg().setAttribute('data-instant', '');
    await act(async () => { dlg().showModal(); });
    act(() => { vi.advanceTimersByTime(0); });
    expect(mascotIn()).not.toBeNull();
  });

  it('sits on the top edge, seated, once the dialog is open and has settled, and goes when it closes', async () => {
    render(<Sample />);
    await act(async () => { dlg().showModal(); });
    expect(mascotIn()).toBeNull(); // the dialog's own opening has to finish first
    settle();
    expect(mascotIn()).not.toBeNull();
    expect(mascotIn()).toHaveClass('seated');
    expect(mascotIn()).toHaveAttribute('aria-hidden', 'true');
    expect((mascotIn() as SVGElement).style.top).toBe('-54px'); // its seat is the dialog's top edge, whatever the dialog's size
    await close();
    expect(mascotIn()).toBeNull();
  });

  it('is the same size in every dialog: it hangs from the corner, not from the size of the dialog', async () => {
    render(<Sample />);
    await open();
    expect(mascotIn()).toHaveAttribute('width', '72');
  });

  it('takes the page\'s mascots into the dialog: they step aside while it is open and come back after', async () => {
    const { container } = render(<MemoryRouter><Header /><Sample /></MemoryRouter>);
    expect(container.querySelector('.brand .mascot')).not.toBeNull();
    await open();
    expect(dialogsOpen()).toBe(true);
    expect(container.querySelector('.brand .mascot')).toBeNull();
    await close();
    expect(dialogsOpen()).toBe(false);
    expect(container.querySelector('.brand .mascot')).not.toBeNull();
  });

  describe('hints', () => {
    it('says a control\'s hint while it is hovered, and stops when the pointer leaves the dialog', async () => {
      render(<Sample />);
      await open();
      expect(bubble()).toBeNull();
      fireEvent.mouseOver(screen.getByRole('button', { name: 'Do it' }));
      expect(bubble()).toHaveTextContent('This does the thing.');
      fireEvent.mouseLeave(dlg());
      expect(bubble()).toBeNull();
    });

    it('says it for keyboard users on focus, and stops on blur', async () => {
      render(<Sample />);
      await open();
      fireEvent.focusIn(screen.getByRole('button', { name: 'Do it' }));
      expect(bubble()).toHaveTextContent('This does the thing.');
      fireEvent.focusOut(screen.getByRole('button', { name: 'Do it' }));
      expect(bubble()).toBeNull();
    });

    it('says nothing for a control without a hint', async () => {
      render(<Sample />);
      await open();
      fireEvent.mouseOver(screen.getByRole('button', { name: 'Plain' }));
      expect(bubble()).toBeNull();
    });

    it('reaches assistive technology through a polite live region that is always there', async () => {
      render(<Sample />);
      await open();
      const region = dlg().querySelector('.perch-say')!;
      expect(region).toHaveAttribute('aria-live', 'polite');
      fireEvent.focusIn(screen.getByRole('button', { name: 'Do it' }));
      expect(region.querySelector('.sr')).toHaveTextContent('This does the thing.');
    });

    it('is forgotten when the dialog closes', async () => {
      render(<Sample />);
      await open();
      fireEvent.mouseOver(screen.getByRole('button', { name: 'Do it' }));
      await close();
      await open();
      expect(bubble()).toBeNull();
    });
  });

  describe('with the mascot switched off', () => {
    beforeEach(() => mascotEnabledStore.set(false));

    it('puts no mascot in the dialog, and does not take the page\'s', async () => {
      const { container } = render(<MemoryRouter><Header /><Sample /></MemoryRouter>);
      await open();
      expect(mascotIn()).toBeNull();
      expect(dlg().querySelector('.dialog-perch')).toBeNull();
      expect(dialogsOpen()).toBe(false);
      expect(container.querySelector('.mascot')).toBeNull();
    });

    it('makes the hint a tooltip on the control instead', () => {
      render(<Sample />);
      expect(screen.getByText('Do it')).toHaveAttribute('title', 'This does the thing.');
      expect(screen.getByText('Plain')).not.toHaveAttribute('title');
    });
  });

  it('with the mascot on a hint is a data attribute, not a tooltip, so it does not appear twice', () => {
    render(<Sample />);
    expect(screen.getByText('Do it')).toHaveAttribute('data-hint', 'This does the thing.');
    expect(screen.getByText('Do it')).not.toHaveAttribute('title');
  });
});
