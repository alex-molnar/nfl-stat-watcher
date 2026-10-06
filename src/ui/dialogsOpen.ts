// How many dialogs have their mascot on, so the page's own mascots step aside while it is the one in the dialog (they are behind
// the dimmed backdrop anyway, and there is only ever one mascot to see).
let open = 0;
const listeners = new Set<() => void>();

export const dialogsOpen = () => open > 0;
export const subscribeDialogs = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** A dialog's mascot has appeared; the returned function is for when it goes. */
export function registerOpenDialog(): () => void {
  open++;
  listeners.forEach((l) => l());
  return () => {
    open--;
    listeners.forEach((l) => l());
  };
}
