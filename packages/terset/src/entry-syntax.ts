import type { JsonObject, JsonValue } from "./terset.ts";

export const MAX_ENTRY_SEGMENTS = 8;
export const KEY = /^[A-Za-z_$][A-Za-z0-9_$.-]*$/;
const ENTRY_KEY = /^[A-Za-z_$][A-Za-z0-9_$.-]*/;
const ENTRY_TAIL = /^(?:\[(\d+)\]|\{(\d+)\})?:([\s\S]*)$/;

interface Entry { keys: string[]; listCount: string | undefined; keyedCount: string | undefined; rest: string }

// Scan a quoted key without the regex engine's stack limit on long strings.
// Returns the index just past the closing quote, or -1.
export function quotedEnd(text: string, start = 0): number {
  let end = start + 1;
  while (end < text.length && text[end] !== '"') {
    if (text[end] === "\\") {
      end++;
      const escaped = text[end];
      if (escaped === undefined || "\n\r\u2028\u2029".includes(escaped)) return -1;
    }
    end++;
  }
  return end === text.length ? -1 : end + 1;
}

// Table cell lookalikes keep the original single-key test.
export function matchEntry(text: string, paths = false): Entry | null {
  const keys: string[] = [];
  let start = 0;
  for (;;) {
    const end = text[start] === '"' ? quotedEnd(text, start)
      : start + (ENTRY_KEY.exec(text.slice(start))?.[0].length ?? 0);
    if (end <= start) return null;
    keys.push(text.slice(start, end));
    if (!paths || text[end] !== "/") {
      const tail = ENTRY_TAIL.exec(text.slice(end));
      return tail ? { keys, listCount: tail[1], keyedCount: tail[2], rest: tail[3] ?? "" } : null;
    }
    if (keys.length === MAX_ENTRY_SEGMENTS) throw new SyntaxError("Maximum entry path is 8 segments.");
    start = end + 1;
  }
}

export function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function keyText(key: string): string {
  return KEY.test(key) ? key : JSON.stringify(key);
}

export function readKey(text: string): string {
  if (KEY.test(text)) return text;
  const value: unknown = JSON.parse(text);
  if (typeof value !== "string") throw new SyntaxError("Invalid field name.");
  return value;
}

export function set(target: JsonObject, key: string, value: JsonValue): void {
  if (Object.hasOwn(target, key)) throw new SyntaxError(`Duplicate key ${key}.`);
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
}

export function setPath(target: JsonObject, path: string[], value: JsonValue): void {
  if (!path.length) throw new SyntaxError("Empty column path.");
  for (const [index, key] of path.entries()) {
    if (index === path.length - 1) { set(target, key, value); return; }
    if (!Object.hasOwn(target, key)) set(target, key, {});
    const nested = target[key];
    if (!object(nested)) throw new SyntaxError("Conflicting column paths.");
    target = nested;
  }
}

export function setEntryPath(target: JsonObject, path: string[], value: JsonValue, parents: WeakSet<JsonObject>): void {
  for (const key of path.slice(0, -1)) {
    if (!Object.hasOwn(target, key)) {
      const child = {};
      set(target, key, child);
      parents.add(child);
    }
    const child = target[key];
    if (!object(child) || !parents.has(child)) throw new SyntaxError("Duplicate or conflicting entry path.");
    target = child;
  }
  const key = path.at(-1);
  if (key === undefined) throw new SyntaxError("Expected root field.");
  if (Object.hasOwn(target, key)) {
    const child = target[key];
    if (path.length > 1 || (object(child) && parents.has(child))) {
      throw new SyntaxError("Duplicate or conflicting entry path.");
    }
  }
  set(target, key, value);
}
