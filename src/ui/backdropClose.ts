import type { MouseEvent } from 'react';

let pressedOnBackdrop = false;

/**
 * Props for a native <dialog> so a click on the dimmed area around it closes it. The dialog fills its own box, so a
 * click whose target is the dialog element itself landed on the backdrop. The press must start there too: selecting
 * text inside the dialog and releasing the mouse outside it is not a click on the backdrop.
 */
export const backdropClose = {
  onMouseDown: (event: MouseEvent<HTMLDialogElement>) => { pressedOnBackdrop = event.target === event.currentTarget; },
  onClick: (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressedOnBackdrop) event.currentTarget.close();
    pressedOnBackdrop = false;
  },
};
