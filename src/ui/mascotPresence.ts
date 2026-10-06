// How many mascots the page itself shows, so the header's own mascot steps aside while one is already visible below it.
let onPage = 0;
const listeners = new Set<() => void>();

export const mascotsOnPage = () => onPage;
export const subscribeMascots = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Called when a page mascot appears; the returned function is for when it goes. */
export function registerPageMascot(): () => void {
  onPage++;
  listeners.forEach((l) => l());
  return () => {
    onPage--;
    listeners.forEach((l) => l());
  };
}
