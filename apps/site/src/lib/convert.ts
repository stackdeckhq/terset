// The converter's work, kept pure so it can be tested without a browser.
import { decode, encode } from './format.ts';
import type { JsonRoot, JsonValue } from './format.ts';
import { bytes } from './text.ts';

export const MAX_CHARS = 60_000;

/** Every status the converter can show. The page reserves room for the widest one. */
export const STATUSES = ['Round trip exact', 'Round trip failed', 'Too long', 'Waiting for valid JSON', 'Needs an object or array', 'Cannot encode'] as const;
export type Status = (typeof STATUSES)[number];

/** The status line for a result. */
export function statusOf(result: ConvertResult): Status {
  if (result.ok) return result.roundTrip ? 'Round trip exact' : 'Round trip failed';
  return result.status;
}

export type ConvertResult =
  | {
      readonly ok: true;
      /** The encoded text, exactly as encode() returns it. What the copy button copies. */
      readonly text: string;
      readonly roundTrip: boolean;
      readonly jsonBytes: number;
      readonly tersetBytes: number;
      readonly value: JsonRoot;
    }
  | { readonly ok: false; readonly title: string; readonly detail: string; readonly status: Exclude<Status, 'Round trip exact' | 'Round trip failed'> };

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

function isJsonRoot(value: JsonValue): value is JsonRoot {
  return value !== null && typeof value === 'object';
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Parses JSON text into a typed JSON value, or returns why it could not. */
export function parseJson(text: string): { readonly ok: true; readonly value: JsonValue } | { readonly ok: false; readonly detail: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonValue(parsed) ? { ok: true, value: parsed } : { ok: false, detail: 'The text is not plain JSON data.' };
  } catch (error) {
    return { ok: false, detail: message(error) };
  }
}

export function convert(source: string): ConvertResult {
  if (source.length > MAX_CHARS) return { ok: false, title: 'Too long for this demo.', detail: 'It stops at 60,000 characters.', status: 'Too long' };
  const parsed = parseJson(source);
  if (!parsed.ok) return { ok: false, title: 'Not valid JSON yet.', detail: parsed.detail, status: 'Waiting for valid JSON' };
  if (!isJsonRoot(parsed.value)) {
    return { ok: false, title: 'Use an object or an array.', detail: 'The root must be an object or an array, for example [{"id": "a1"}].', status: 'Needs an object or array' };
  }
  const value = parsed.value;
  let text: string;
  try {
    text = encode(value);
  } catch (error) {
    return { ok: false, title: 'This value cannot be encoded.', detail: message(error), status: 'Cannot encode' };
  }
  let roundTrip = false;
  try {
    roundTrip = JSON.stringify(decode(text)) === JSON.stringify(value);
  } catch {
    roundTrip = false;
  }
  return { ok: true, text, roundTrip, jsonBytes: bytes(JSON.stringify(value)), tersetBytes: bytes(text), value };
}
