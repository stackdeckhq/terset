// The reader's language on /docs, remembered in this browser. JavaScript by default,
// and the server always renders JavaScript, so hydration never mismatches.
import { useCallback, useSyncExternalStore } from 'react';
import { DOC_LANGS } from '../data/docs.ts';
import type { DocLang } from '../data/docs.ts';

const KEY = 'terset.lang';
const DEFAULT: DocLang = 'js';
const listeners = new Set<() => void>();
/** Holds the choice when storage is blocked, so it lasts until the page reloads. */
let memory: DocLang | null = null;

function isDocLang(value: string | null): value is DocLang {
  return DOC_LANGS.some((name) => name === value);
}

function read(): DocLang {
  if (memory !== null) return memory;
  try {
    const value = window.localStorage.getItem(KEY);
    return isDocLang(value) ? value : DEFAULT;
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

export function useDocLang(): readonly [DocLang, (next: DocLang) => void] {
  const current = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = useCallback((next: DocLang) => {
    try {
      window.localStorage.setItem(KEY, next);
      memory = null;
    } catch {
      // Storage can be blocked. The choice then lasts until the page reloads.
      memory = next;
    }
    for (const listener of listeners) listener();
  }, []);
  return [current, set] as const;
}
