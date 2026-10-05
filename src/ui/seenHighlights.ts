/** Clips the user has opened during this page visit; a highlight not in here is "new". Deliberately not stored, so a reload shows them again. */
const seen = new Set<string>();
const listeners = new Set<() => void>();

export const markSeen = (id: string) => { if (!seen.has(id)) { seen.add(id); listeners.forEach((l) => l()); } };
export const isSeen = (id: string) => seen.has(id);
export const subscribeSeen = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
