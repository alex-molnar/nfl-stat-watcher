export interface Store<T> {
  get(): T;
  set(next: T): boolean;
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

  function persist(next: T): boolean {
    try {
      localStorage.setItem(opts.key, JSON.stringify(next));
      return true;
    } catch {
      console.warn(`Stat Watch: could not save ${opts.key}, keeping it in memory only`);
      return false;
    }
  }

  // The fallback is written back so generated ids stay stable across reloads.
  function useFallback(): T {
    const next = opts.fallback();
    persist(next);
    return next;
  }

  function load(): T {
    try {
      const raw = localStorage.getItem(opts.key);
      if (raw === null) return useFallback();
      const parsed: unknown = JSON.parse(raw);
      if (opts.isValid(parsed)) return opts.repair ? opts.repair(parsed) : parsed;
    } catch {
      // unreadable JSON or blocked storage: fall through to defaults
    }
    console.warn(`Stat Watch: stored data in ${opts.key} is invalid, using defaults`);
    return useFallback();
  }

  let value = load();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = next;
      const persisted = persist(next);
      notify();
      return persisted;
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
