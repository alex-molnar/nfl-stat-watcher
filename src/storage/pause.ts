// Session-only pause flag (WCAG 2.2.2). Lives in memory, never in localStorage, so it survives navigation but not a reload.
let paused = false;
const listeners = new Set<() => void>();

export const isPaused = () => paused;
export const subscribePause = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export function setPaused(next: boolean) {
  paused = next;
  listeners.forEach((l) => l());
}
