// A small demo of the short-handles technique, written for this site.
// It is not part of the terset package. Copy it and adapt it to your data.

export interface Handled<T> {
  /** The rows with each long id swapped for 1, 2, 3 and so on. */
  readonly rows: readonly T[];
  /** Maps a handle back to the original id. */
  readonly back: ReadonlyMap<string, string>;
}

/** Swaps each row's long `id` for a short handle before the prompt. */
export function toHandles<T extends { readonly id: string }>(rows: readonly T[]): Handled<T> {
  const back = new Map<string, string>();
  const handled = rows.map((row, index) => {
    const handle = String(index + 1);
    back.set(handle, row.id);
    return { ...row, id: handle };
  });
  return { rows: handled, back };
}

/** Maps handles in the model's answer back to the real ids. Unknown handles are reported, never guessed. */
export function fromHandles(handles: readonly string[], back: ReadonlyMap<string, string>): { readonly ids: string[]; readonly unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const handle of handles) {
    const id = back.get(handle);
    if (id === undefined) unknown.push(handle);
    else ids.push(id);
  }
  return { ids, unknown };
}

/** The same two functions in plain JavaScript, shown on the page. A test runs it against the typed version. */
export const HANDLES_DEMO_SOURCE = `function toHandles(rows) {
  const back = new Map();
  const handled = rows.map((row, i) => {
    const handle = String(i + 1);
    back.set(handle, row.id);
    return { ...row, id: handle };
  });
  return { rows: handled, back };
}

function fromHandles(handles, back) {
  const ids = [], unknown = [];
  for (const h of handles) {
    const id = back.get(h);
    id === undefined ? unknown.push(h) : ids.push(id);
  }
  return { ids, unknown };
}`;

/** Long ids the demo starts with. */
export const DEMO_ROWS = [
  { id: 'doc_7f3a91c2-4be0-4d55-9a1e-0c6b2f8d1e47', name: 'Invoice March.pdf' },
  { id: 'doc_1c0e55aa-93f2-4a7d-b8e4-55d0c9a3f612', name: 'Team photo.jpg' },
  { id: 'doc_e9b2d4f0-1a6c-4f83-a2d7-9be0f15c3a08', name: 'Invoice April.pdf' },
] as const;

/** A model answer that uses the handles, plus one it made up. */
export const DEMO_ANSWER: readonly string[] = ['1', '3', '7'];
