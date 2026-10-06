// Where the one mascot is, so the page's own mascots (the header's, an empty state's) step aside while it is somewhere else: in a dialog,
// or in Rookie camp's card. They are behind the dimmed backdrop, or have nothing to add, and there is only ever one mascot to see.
let dialogs = 0;
let camp = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** A dialog has the mascot. Rookie camp keeps its card out of the way of a dialog by asking this. */
export const dialogsOpen = () => dialogs > 0;
/** The mascot is in a dialog or in the camp's card: the page's own mascots step aside. */
export const mascotAway = () => dialogs > 0 || camp > 0;
export const subscribeDialogs = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

function hold(kind: 'dialog' | 'camp'): () => void {
  const change = (by: 1 | -1) => { if (kind === 'dialog') dialogs += by; else camp += by; notify(); };
  change(1);
  return () => change(-1);
}

/** A dialog's mascot has appeared; the returned function is for when it goes. */
export const registerOpenDialog = () => hold('dialog');
/** Rookie camp's mascot has appeared; the returned function is for when it goes. */
export const registerCampMascot = () => hold('camp');
