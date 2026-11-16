// The reader's package manager, remembered in this browser. pnpm by default.
import { useCallback, useSyncExternalStore } from 'react';
import { PACKAGE_MANAGERS } from '../data/site.ts';
import type { PackageManager } from '../data/site.ts';

const KEY = 'terset.pm';
const DEFAULT: PackageManager = 'pnpm';
const listeners = new Set<() => void>();
/** Holds the choice when storage is blocked, so it lasts until the page reloads. */
let memory: PackageManager | null = null;

function isPackageManager(value: string | null): value is PackageManager {
  return PACKAGE_MANAGERS.some((name) => name === value);
}

function read(): PackageManager {
  try {
    const value = window.localStorage.getItem(KEY);
    return isPackageManager(value) ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function usePackageManager(): readonly [PackageManager, (next: PackageManager) => void] {
  const current = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = useCallback((next: PackageManager) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Storage can be blocked. The choice then lasts until the page reloads.
      memory = next;
    }
    for (const listener of listeners) listener();
  }, []);
  return [memory ?? current, set] as const;
}
