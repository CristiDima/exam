// Small localStorage-backed stores that React can subscribe to.
import { useSyncExternalStore } from 'react';

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Could not save ${key}`, e);
  }
}

export const storageAvailable = (() => {
  try {
    localStorage.setItem('epso-quiz:probe', '1');
    localStorage.removeItem('epso-quiz:probe');
    return true;
  } catch {
    return false;
  }
})();

export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store persisted under `key`. `parse` turns whatever is stored (or null) into a
 * valid value. Changes made in other tabs are picked up through the storage event.
 */
export function createStore<T>(key: string, parse: (raw: unknown) => T): Store<T> {
  let value = parse(readJson(key));
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key !== key) return;
      value = parse(readJson(key));
      emit();
    });
  }

  return {
    get: () => value,
    set(next) {
      value = next;
      writeJson(key, next);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
