// The converter's work, kept pure so it can be tested without a browser.
import { decode, encode, rulesFor } from './format.ts';
import type { JsonRoot, JsonValue } from './format.ts';
import { bytes } from './text.ts';

export const MAX_CHARS = 60_000;

/** Every status the converter can show. The page reserves room for the widest one. */
export const STATUSES = ['Round trip exact', 'Round trip failed', 'Too long', 'Waiting for valid JSON', 'Needs an object or array', 'Number would round', 'Cannot encode'] as const;
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

/**
 * How a number changes when JavaScript reads it. "value": it holds a different number.
 * "digits": it holds this number exactly but prints it with other digits.
 */
export type NumberChange = 'value' | 'digits';

/** A number literal in the pasted text that JavaScript reads as a different value, or would print with other digits. */
export interface ChangedNumber {
  /** The number exactly as typed. */
  readonly literal: string;
  /** Its line in the pasted text, counted from 1. */
  readonly line: number;
  /** What JSON.parse makes of it. */
  readonly value: number;
  readonly change: NumberChange;
}

// A JSON number literal, matched where the scan stands. The text already parsed, so it is well formed.
const NUMBER_LITERAL = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
// A decimal as JSON writes it or as String(number) prints it. Infinity and NaN do not match.
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u;
// A literal written as an integer: no fraction, no exponent. Other JSON readers keep these as exact integers.
const INTEGER = /^-?\d+$/u;


/**
 * A decimal reduced to sign, significant digits and power of ten, so 1.50, 15e-1 and 1.5
 * all give "15e-1". Every zero gives "0". Null when the text is not a finite decimal.
 */
function canonicalDecimal(decimal: string): string | null {
  const match = DECIMAL.exec(decimal);
  if (match === null) return null;
  const [, sign = '', whole = '', fraction = '', exponent = '0'] = match;
  const digits = `${whole}${fraction}`.replace(/^0+/u, '');
  if (digits === '') return '0';
  // Trim trailing zeros by walking back once. A /0+$/ regex rescans every inner run of zeros, which is quadratic.
  let end = digits.length;
  while (digits.charAt(end - 1) === '0') end -= 1;
  const significant = digits.slice(0, end);
  const power = Number(exponent) - fraction.length + digits.length - significant.length;
  return `${sign}${significant}e${String(power)}`;
}

/**
 * Whether a finite double holds exactly the decimal `typed`, given in canonicalDecimal's form.
 * The double is m * 2^p. With m odd and p = -k it equals m * 5^k / 10^k, which ends in 5,
 * so it has exactly k digits after the point: 0.1 holds 0.1000000000000000055511151231257827021181583404541015625.
 * Checking that count first skips the long expansion for nearly every number.
 */
function holdsExactly(value: number, typed: string): boolean {
  if (value === 0) return typed === '0';
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xf_ffff_ffff_ffffn;
  let mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  let power = (biased === 0 ? 1 : biased) - 1075;
  while (power < 0 && (mantissa & 1n) === 0n) {
    mantissa >>= 1n;
    power += 1;
  }
  const sign = value < 0 ? '-' : '';
  if (power >= 0) return typed === canonicalDecimal(`${sign}${(mantissa << BigInt(power)).toString()}`);
  const exponent = `e${String(power)}`;
  return typed.endsWith(exponent) && typed === `${sign}${(mantissa * 5n ** BigInt(-power)).toString()}${exponent}`;
}

/**
 * How a literal changes when JavaScript reads it, or null when it keeps both its value and its digits.
 * A decimal that prints back the same is kept: 0.1 is not held exactly, but it reads and prints as 0.1.
 * An integer literal must also be held exactly, since other JSON readers keep it as an exact integer.
 */
function changeOf(literal: string, value: number): NumberChange | null {
  if (!Number.isFinite(value)) return 'value';
  const typed = canonicalDecimal(literal);
  const printsSame = typed === canonicalDecimal(String(value));
  // A safe integer that prints back the same is always held exactly, so most numbers stop here.
  if (printsSame && (!INTEGER.test(literal) || Number.isSafeInteger(value))) return null;
  if (typed === null || !holdsExactly(value, typed)) return 'value';
  return printsSame ? null : 'digits';
}

/** The number JavaScript holds for a literal, as the message shows it: the exact integer for an integer literal, and -0 with its sign. */
function heldText(literal: string, value: number): string {
  if (INTEGER.test(literal)) return BigInt(value).toString();
  return Object.is(value, -0) ? '-0' : String(value);
}

/** The index just past the string that opens at `start`. JSON strings hold no raw newlines. */
function afterString(json: string, start: number): number {
  let index = start + 1;
  while (index < json.length) {
    const char = json.charAt(index);
    if (char === '\\') index += 2;
    else if (char === '"') return index + 1;
    else index += 1;
  }
  return index;
}

/**
 * Every number literal in valid JSON text whose value changes when JavaScript reads it.
 * A literal changes when the number it becomes prints back as a different decimal value:
 * 9007199254740993 prints as 9007199254740992, 0.10000000000000000001 as 0.1 and 1e400 as
 * Infinity. An integer literal also changes when the exact integer JavaScript holds differs,
 * even if it prints back the same: 1000000000000000100 is held as 1000000000000000128.
 * A literal held exactly that prints with other digits is listed too, as a "digits" change:
 * 1000000000000000128 prints as 1000000000000000100.
 * Forms that only print differently, such as 1.50 or 1e2, keep their value.
 * Digits inside strings and keys are skipped.
 */
export function changedNumbers(json: string): readonly ChangedNumber[] {
  const changed: ChangedNumber[] = [];
  let line = 1;
  let index = 0;
  while (index < json.length) {
    const char = json.charAt(index);
    if (char === '"') {
      index = afterString(json, index);
    } else if (char === '-' || (char >= '0' && char <= '9')) {
      NUMBER_LITERAL.lastIndex = index;
      const literal = NUMBER_LITERAL.exec(json)?.[0] ?? char;
      const value = Number(literal);
      const change = changeOf(literal, value);
      if (change !== null) changed.push({ literal, line, value, change });
      index += literal.length;
    } else {
      if (char === '\n') line += 1;
      index += 1;
    }
  }
  return changed;
}

// A number longer than this is cut short in the message, so the output pane stays readable.
const SHOWN_CHARS = 40;

function shorten(text: string): string {
  return text.length > SHOWN_CHARS ? `${text.slice(0, SHOWN_CHARS)}…` : text;
}

function changeText(first: ChangedNumber): string {
  if (!Number.isFinite(first.value)) return 'is too large for JavaScript.';
  if (first.change === 'digits') return `would print as ${String(first.value)}. JavaScript holds it exactly but prints other digits.`;
  return `would become ${shorten(heldText(first.literal, first.value))}. JavaScript cannot hold it exactly.`;
}

function roundedDetail(first: ChangedNumber, more: number): string {
  const cut = first.literal.length > SHOWN_CHARS;
  const shown = shorten(first.literal);
  const what = changeText(first);
  const fix = cut ? 'Quote it to keep every digit.' : `Quote it to keep every digit: "${first.literal}".`;
  const rest = more === 0 ? '' : more === 1 ? ' 1 more number changes too.' : ` ${String(more)} more numbers change too.`;
  return `Line ${String(first.line)}: ${shown} ${what} ${fix}${rest}`;
}

export type ParseResult =
  | { readonly ok: true; readonly value: JsonValue }
  | { readonly ok: false; readonly reason: 'syntax'; readonly detail: string }
  | { readonly ok: false; readonly reason: 'rounded'; readonly first: ChangedNumber; readonly more: number };

/** Parses JSON text into a typed JSON value, or returns why it could not, including numbers JavaScript would change. */
export function parseJson(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: 'syntax', detail: message(error) };
  }
  const changed = changedNumbers(text);
  const first = changed[0];
  if (first !== undefined) return { ok: false, reason: 'rounded', first, more: changed.length - 1 };
  try {
    if (isJsonValue(parsed)) return { ok: true, value: parsed };
  } catch (error) {
    // Nesting thousands deep runs out of stack. JSON.parse copes, so this check is where it shows.
    return { ok: false, reason: 'syntax', detail: message(error) };
  }
  return { ok: false, reason: 'syntax', detail: 'The text is not plain JSON data.' };
}

/** What "Copy for a prompt" copies: the rules line fitted to `text`, a newline, then `text`. Just `text` when no rules fit. */
export function promptText(text: string): string {
  const rules = rulesFor(text);
  return rules === '' ? text : `${rules}\n${text}`;
}

export function convert(source: string): ConvertResult {
  if (source.length > MAX_CHARS) return { ok: false, title: 'Too long for this demo.', detail: 'It stops at 60,000 characters.', status: 'Too long' };
  const parsed = parseJson(source);
  if (!parsed.ok) {
    if (parsed.reason === 'rounded') return { ok: false, title: 'A number would change.', detail: roundedDetail(parsed.first, parsed.more), status: 'Number would round' };
    return { ok: false, title: 'Not valid JSON yet.', detail: parsed.detail, status: 'Waiting for valid JSON' };
  }
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
