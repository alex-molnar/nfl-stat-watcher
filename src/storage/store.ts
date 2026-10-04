export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  reload(): void;
}

const registry = new Set<Store<unknown>>();

/** Reload every store from localStorage. Used by tests after seeding storage. */
export function reloadAllStores() {
  registry.forEach((s) => s.reload());
}

export function createStore<T>(opts: {
  key: string;
  fallback: () => T;
  isValid: (value: unknown) => value is T;
  repair?: (value: T) => T;
}): Store<T> {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  function load(): T {
    try {
      const raw = localStorage.getItem(opts.key);
      if (raw === null) return opts.fallback();
      const parsed: unknown = JSON.parse(raw);
      if (opts.isValid(parsed)) return opts.repair ? opts.repair(parsed) : parsed;
    } catch {
      // unreadable JSON or blocked storage: fall through to defaults
    }
    console.warn(`Stat Watch: stored data in ${opts.key} is invalid, using defaults`);
    return opts.fallback();
  }

  let value = load();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = next;
      try {
        localStorage.setItem(opts.key, JSON.stringify(next));
      } catch {
        // storage full or blocked: keep the in-memory value
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reload() {
      value = load();
      notify();
    },
  };
  registry.add(store as Store<unknown>);
  return store;
}
