import { headerOrder } from "./header-order.ts";
import { KEY, MAX_ENTRY_SEGMENTS, keyText, matchEntry, object, quotedEnd, readKey, set, setEntryPath, setPath } from "./entry-syntax.ts";

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type JsonRoot = JsonObject | JsonValue[];

const MAX_JSON_DEPTH = 500;
const MAX_HEADER_SEGMENTS = 8;
const DEPTH_ERROR = "Maximum JSON depth is 500.";

/** Format version to write. The decoder accepts all three versions. */
export type FormatVersion = "1.0" | "1.1" | "1.2";
export interface EncodeOptions {
  /** "1.2" (default) adds path entries. "1.1" uses named cells. "1.0" uses empty cells. */
  format?: FormatVersion;
}

type RuleFeature = "table" | "empty" | "named" | "quoted" | "json" | "id" | "keyed" | "nested" | "path";
const fittedRules: readonly [feature: RuleFeature, sentence: string][] = [
  ["table", "Tables use tab-separated headers and rows."],
  ["empty", "Empty cells mean absent."],
  ["named", "After the header columns, a row lists its other fields as name=value. A field a row does not list is absent."],
  ["quoted", "JSON quotes distinguish numeric, boolean or null text from scalars."],
  ["json", "Nested cells use JSON."],
  ["id", "A leading bare id header marks string IDs."],
  ["keyed", "name{N} has N entries; the @key column holds each entry's key and is not a field."],
  ["nested", "Header a.b is field b in object a."],
  ["path", "Key a/b is field b in object a."],
];

/** The one rules line a model needs to read Terset text. Put it once, before the data. */
export const RULES = fittedRules.map(([, sentence]) => sentence).join(" ");

/** Ends the header of a table whose rows carry name=value cells. */
const NAMED_MARKER = "name=value";

/** The rules needed by this canonical text. Rejects the same text as decode. */
export function rulesFor(text: string): string {
  const features = new Set<RuleFeature>();
  parseDocument(text, features);
  return fittedRules.flatMap(([feature, sentence]) =>
    features.has(feature) ? [sentence] : []).join(" ");
}

// Each digit run has one way to match, so a failed match costs linear time.
const NUMBER_LIKE = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/;
// Under /u, this surrogate range matches only unpaired code units. Paired
// astral text stays bare; lone surrogates need JSON escapes for UTF-8 safety.
const TROUBLE = /[\u0000-\u001f\u007f\u0085\u2028\u2029\ud800-\udfff]/u;

function bare(text: string): boolean {
  return text.length > 0 && text.trim() === text && !TROUBLE.test(text)
    && !/^["{[]/.test(text) && !NUMBER_LIKE.test(text)
    && !["true", "false", "null", "undefined", "NaN", "Infinity", "-Infinity"].includes(text);
}

function cell(value: JsonValue): string {
  if (typeof value === "string" && bare(value)) return value;
  // JSON normalizes -0. Reject it up front instead of silently losing its sign.
  return JSON.stringify(value);
}

function validate(value: unknown, depth = 0, ancestors = new Set<object>()): asserts value is JsonValue {
  if (depth > MAX_JSON_DEPTH) throw new TypeError(DEPTH_ERROR);
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Numbers must be finite and must not be negative zero.");
    return;
  }
  if (typeof value !== "object") throw new TypeError("Expected JSON data.");
  if (ancestors.has(value)) throw new TypeError("Cyclic JSON data.");
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError("Expected a plain JSON object.");
  }
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError("JSON has no symbol keys.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new TypeError("Sparse arrays are not JSON.");
      validate(value[i], depth + 1, ancestors);
    }
  } else {
    for (const entry of Object.values(value)) validate(entry, depth + 1, ancestors);
  }
  ancestors.delete(value);
}

function safeId(text: string): boolean {
  return text.length > 0 && text.trim() === text && !TROUBLE.test(text);
}

const utf8 = new TextEncoder();

function simpleSegment(key: string): boolean {
  return KEY.test(key) && !key.includes(".");
}

interface Column { path: string[]; values: (JsonValue | undefined)[] }

function flatten(column: Column): Column[] {
  const first = column.values[0];
  if (column.path.length >= MAX_HEADER_SEGMENTS || !column.path.every(simpleSegment) || !object(first)) return [column];
  const keys = Object.keys(first);
  if (!keys.length || !keys.every(simpleSegment) || !column.values.every(value => object(value)
    && JSON.stringify(Object.keys(value)) === JSON.stringify(keys))) return [column];
  return keys.flatMap(key => flatten({
    path: [...column.path, key],
    values: column.values.map(value => object(value) ? value[key] : undefined),
  }));
}

/** Index of the first header field that some row lacks, or the field count. */
function firstSparse(rows: JsonObject[], fields: string[]): number {
  const counts = new Map<string, number>();
  for (const row of rows) for (const key of Object.keys(row)) counts.set(key, (counts.get(key) ?? 0) + 1);
  const index = fields.findIndex(field => counts.get(field) !== rows.length);
  return index < 0 ? fields.length : index;
}

function table(rows: JsonObject[], keyed: boolean, named: boolean, entryKeys: string[], maxBytes: number, writeCell = cell): string | null {
  const fields = headerOrder(rows);
  if (!fields) return null;
  // Format 1.1 keeps the fields before the first sparse one as positional
  // columns and writes every later field a row has as a name=value cell.
  const split = named ? firstSparse(rows, fields) : fields.length;
  const hasNamed = split < fields.length;
  // Flattening can only add columns. Tabs alone rule out wide sparse tables.
  // Named cells write only present fields, so their size stays linear.
  if (!hasNamed && rows.length * (fields.length - 1) >= maxBytes) return null;
  const columns = fields.slice(0, split).flatMap(field => flatten({ path: [field], values: rows.map(row => Object.hasOwn(row, field) ? row[field] : undefined) }));
  const lone = columns.length === 1;
  const ids = !keyed && columns[0]?.path.length === 1 && fields[0] === "id"
    && rows.every(row => Object.keys(row)[0] === "id" && typeof row.id === "string"
      && safeId(row.id) && (!lone || !matchEntry(row.id)));
  const headings = columns.map((column, index) => {
    const field = column.path[0]!;
    if (column.path.length > 1) return column.path.join(".");
    if (field.includes(".") || (index === 0 && field === "id" && !ids && !keyed)) return JSON.stringify(field);
    return keyText(field);
  });
  if (hasNamed) headings.push(NAMED_MARKER);
  if (keyed) headings.unshift("@key");
  // A name is one field, never a path, so dotted names need quotes.
  const names = new Map(fields.slice(split).map(field => [field, simpleSegment(field) ? field : JSON.stringify(field)]));
  const lines = [headings.join("\t")];
  for (let index = 0; index < rows.length; index++) {
    const cells = columns.map((column, position) => {
      const value = column.values[index];
      if (value === undefined) return "";
      if (position === 0 && ids && typeof value === "string") return value;
      if (!keyed && lone && typeof value === "string" && matchEntry(value)) return JSON.stringify(value);
      return writeCell(value);
    });
    if (hasNamed) {
      // Each row's own key order fits the header, so its positional fields
      // come first and its other fields follow in header order.
      const row = rows[index]!;
      for (const key of Object.keys(row).slice(split)) cells.push(`${names.get(key)!}=${writeCell(row[key]!)}`);
    }
    if (keyed) cells.unshift(entryKeys[index]!);
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

function listTable(value: JsonValue, named: boolean, bytes?: number, writeCell = cell): string | null {
  if (!Array.isArray(value) || !value.every(object)) return null;
  bytes ??= utf8.encode(JSON.stringify(value)).length;
  const text = table(value, false, named, [], bytes, writeCell);
  return text !== null && utf8.encode(text).length < bytes ? text : null;
}

// Keep measured fragments so a parent can count a child's JSON or path
// lines without serializing or copying either candidate again.
interface Text { bytes: number; parts: string | Text[] }
interface EntryPlan { json: Text; entry: Text }

function measured(parts: string): Text {
  return { bytes: utf8.encode(parts).length, parts };
}

function join(parts: Text[], separator?: Text): Text {
  const bytes = parts.reduce((sum, part) => sum + part.bytes, 0);
  return separator && parts.length > 1
    ? { bytes: bytes + (parts.length - 1) * separator.bytes,
      parts: parts.flatMap((part, index) => index === 0 ? [part] : [separator, part]) }
    : { bytes, parts };
}

function render(text: Text): string {
  if (typeof text.parts === "string") return text.parts;
  const strings: string[] = [];
  function append(part: Text): void {
    if (typeof part.parts === "string") strings.push(part.parts);
    else for (const child of part.parts) append(child);
  }
  append(text);
  return strings.join("");
}

const slash = measured("/");
const lf = measured("\n");
const comma = measured(",");
const openObject = measured("{");
const closeObject = measured("}");
const valuePrefix = measured(": ");

function entryForm(name: Text, value: JsonValue, json: Text, named: boolean, writeCell: typeof cell): Text {
  if (Array.isArray(value)) {
    const body = listTable(value, named, json.bytes, writeCell);
    if (body !== null) return join([name, measured(`[${value.length}]:\n${body}`)]);
  }
  const fallback = join([name, valuePrefix, typeof value === "string" && bare(value) ? measured(value) : json]);
  if (!object(value)) return fallback;
  const keys = Object.keys(value);
  const rows = Object.values(value);
  if (keys.length < 2 || !keys.every(key => safeId(key) && !matchEntry(key)) || !rows.every(object)) return fallback;
  const body = table(rows, true, named, keys, fallback.bytes, writeCell);
  if (body === null) return fallback;
  const keyed = join([name, measured(`{${keys.length}}:\n${body}`)]);
  return keyed.bytes < fallback.bytes ? keyed : fallback;
}

function planEntry(name: Text, value: JsonValue, remaining: number, compact: WeakMap<object, Text>, writeCell: typeof cell): EntryPlan {
  const members = remaining > 0 && object(value) ? Object.entries(value) : [];
  let json: Text;
  let path: Text | undefined;
  if (members.length) {
    const fields: Text[] = [];
    const entries: Text[] = [];
    for (const [key, child] of members) {
      const quoted = JSON.stringify(key);
      const childName = join([name, slash, measured(KEY.test(key) ? key : quoted)]);
      const plan = planEntry(childName, child, remaining - 1, compact, writeCell);
      fields.push(join([measured(quoted + ":"), plan.json]));
      entries.push(plan.entry);
    }
    json = join([openObject, join(fields, comma), closeObject]);
    path = join(entries, lf);
  } else {
    json = value !== null && typeof value === "object"
      ? compact.get(value) ?? measured(JSON.stringify(value)) : measured(JSON.stringify(value));
  }
  if (value !== null && typeof value === "object") compact.set(value, json);
  const base = entryForm(name, value, json, true, writeCell);
  return { json, entry: path && path.bytes < base.bytes ? path : base };
}

function formatOption(options: unknown): FormatVersion {
  if (typeof options !== "object" || options === null || Array.isArray(options)) throw new TypeError("Expected an options object.");
  const { format = "1.2" } = options as { format?: unknown };
  if (format !== "1.0" && format !== "1.1" && format !== "1.2") throw new TypeError('format must be "1.0", "1.1" or "1.2".');
  return format;
}

/** Encode a JSON object or array as Terset text. */
export function encode(value: JsonRoot, options: EncodeOptions = {}): string {
  const format = formatOption(options);
  const named = format !== "1.0";
  validate(value);
  if (Array.isArray(value)) {
    const text = listTable(value, named);
    return text === null ? JSON.stringify(value) : `[${value.length}]\n${text}`;
  }
  if (!object(value)) throw new TypeError("Terset requires a root object or array.");
  if (!Object.keys(value).length) return "{}";
  if (format !== "1.2") return Object.entries(value).map(([key, entry]) =>
    render(entryForm(measured(keyText(key)), entry, measured(JSON.stringify(entry)), named, cell))).join("\n");
  const compact = new WeakMap<object, Text>();
  const writeCell = (value: JsonValue): string => {
    if (value === null || typeof value !== "object") return cell(value);
    let json = compact.get(value);
    if (!json) {
      json = measured(JSON.stringify(value));
      compact.set(value, json);
    }
    const text = render(json);
    json.parts = text;
    return text;
  };
  return Object.entries(value).map(([key, entry]) =>
    render(planEntry(measured(keyText(key)), entry, MAX_ENTRY_SEGMENTS - 1, compact, writeCell).entry)).join("\n");
}

function readCell(text: string): JsonValue {
  if (!text) throw new SyntaxError("Empty values are allowed only as absent table cells.");
  if (/^["{[]/.test(text) || /^(?:true|false|null)$/.test(text) || NUMBER_LIKE.test(text)) {
    const value: unknown = JSON.parse(text);
    validate(value);
    return value;
  }
  if (!bare(text)) throw new SyntaxError("Invalid bare text.");
  return text;
}

function noteCell(raw: string, features: Set<RuleFeature> | undefined): void {
  if (raw === "") features?.add("empty");
  else if (raw.startsWith('"')) features?.add("quoted");
  else if (raw.startsWith("{") || raw.startsWith("[")) features?.add("json");
}

/** Splits a name=value cell. The name is one field: bare, or a JSON string. */
function readNamedCell(text: string): [key: string, raw: string] {
  let end: number;
  if (text.startsWith('"')) {
    end = quotedEnd(text);
    if (end < 0) throw new SyntaxError("Invalid field name.");
  } else {
    end = text.indexOf("=");
    if (end < 0) throw new SyntaxError("Expected name=value cell.");
    if (!simpleSegment(text.slice(0, end))) throw new SyntaxError("Invalid field name.");
  }
  if (text[end] !== "=") throw new SyntaxError("Expected name=value cell.");
  return [readKey(text.slice(0, end)), text.slice(end + 1)];
}

type HeaderTrie = Map<string, HeaderTrie | null>;

function readTable(lines: string[], start: number, count: number, keyed: boolean, rowDepth: number, features?: Set<RuleFeature>): JsonRoot {
  const rawHeader = lines[start];
  if (rawHeader === undefined) throw new SyntaxError("Missing table header.");
  const fields = rawHeader.split("\t");
  if (keyed && fields.shift() !== "@key") throw new SyntaxError("Missing @key marker.");
  const named = fields.at(-1) === NAMED_MARKER;
  if (named) fields.pop();
  if (!fields.length && !named) throw new SyntaxError("Missing table fields.");
  const paths = fields.map(field => {
    const path = field.startsWith('"') ? [readKey(field)] : field.split(".", MAX_HEADER_SEGMENTS + 1);
    if (path.length > MAX_HEADER_SEGMENTS) throw new SyntaxError("Maximum header path is 8 segments.");
    if (rowDepth + path.length > MAX_JSON_DEPTH) throw new SyntaxError(DEPTH_ERROR);
    return path;
  });
  features?.add("table");
  if (named) features?.add("named");
  if (keyed) features?.add("keyed");
  if (paths.some(path => path.length > 1)) features?.add("nested");
  const trie: HeaderTrie = new Map();
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index]!;
    if (!fields[index]!.startsWith('"') && !path.every(simpleSegment)) throw new SyntaxError("Invalid header.");
    let node = trie;
    for (const [position, segment] of path.entries()) {
      const child = node.get(segment);
      if (position === path.length - 1) {
        if (child !== undefined) throw new SyntaxError("Duplicate or conflicting header.");
        node.set(segment, null);
      } else {
        if (child === null) throw new SyntaxError("Duplicate or conflicting header.");
        const next: HeaderTrie = child ?? new Map<string, HeaderTrie | null>();
        if (child === undefined) node.set(segment, next);
        node = next;
      }
    }
  }
  const ids = !keyed && fields[0] === "id";
  if (ids) features?.add("id");
  const result: JsonRoot = keyed ? {} : [];
  for (let index = 0; index < count; index++) {
    const line = lines[start + 1 + index];
    if (line === undefined) throw new SyntaxError("Row count mismatch.");
    // A named list row with no positional columns and no fields is empty.
    const cells = named && line === "" ? [] : line.split("\t");
    const expected = fields.length + (keyed ? 1 : 0);
    if (named ? cells.length < expected : cells.length !== expected) throw new SyntaxError("Wrong cell count.");
    const entryKey = keyed ? cells.shift() : undefined;
    const row: JsonObject = {};
    for (let column = 0; column < paths.length; column++) {
      const raw = cells[column]!;
      if (column === 0 && ids && !raw) throw new SyntaxError("Missing string id.");
      if (named && !raw) throw new SyntaxError("Empty values are allowed only as absent table cells.");
      if (!(column === 0 && ids)) noteCell(raw, features);
      if (raw !== "") setPath(row, paths[column]!, column === 0 && ids ? raw : readCell(raw));
    }
    for (let column = paths.length; column < cells.length; column++) {
      const [key, raw] = readNamedCell(cells[column]!);
      noteCell(raw, features);
      set(row, key, readCell(raw));
    }
    if (Array.isArray(result)) result.push(row);
    else {
      if (entryKey === undefined || !safeId(entryKey) || matchEntry(entryKey)) throw new SyntaxError("Invalid entry key.");
      set(result, entryKey, row);
    }
  }
  return result;
}

function readCount(text: string): number {
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 2) throw new SyntaxError("Invalid table count.");
  return count;
}

function readDocument(text: string, features?: Set<RuleFeature>): JsonRoot {
  const lines = text.split("\n");
  const rootCount = lines.length > 1 ? /^\[(\d+)\]$/.exec(lines[0]!) : null;
  let result: JsonRoot;
  let hasPaths = false;
  if (rootCount) {
    const count = readCount(rootCount[1]!);
    result = readTable(lines, 1, count, false, 1, features);
    if (lines.length !== count + 2) throw new SyntaxError("Row count mismatch.");
  } else if (text === "{}") result = {};
  else if (text.startsWith("[")) {
    const parsed: unknown = JSON.parse(text);
    validate(parsed);
    if (!Array.isArray(parsed)) throw new SyntaxError("Expected a JSON array.");
    result = parsed;
  } else {
    result = {};
    const parents = new WeakSet<JsonObject>();
    let index = 0;
    while (index < lines.length) {
      const match = matchEntry(lines[index++]!, true);
      if (!match) throw new SyntaxError("Expected root field.");
      const path = match.keys.map(readKey);
      if (path.length > 1) {
        hasPaths = true;
        features?.add("path");
      }
      const rest = match.rest;
      let value: JsonValue;
      if (match.listCount !== undefined || match.keyedCount !== undefined) {
        if (rest !== "") throw new SyntaxError("Expected table header.");
        const count = readCount((match.listCount ?? match.keyedCount)!);
        value = readTable(lines, index, count, match.keyedCount !== undefined, path.length + 1, features);
        index += count + 1;
      } else {
        if (!rest.startsWith(" ")) throw new SyntaxError("Expected scalar field.");
        if (rest.slice(1).startsWith('"')) features?.add("quoted");
        value = readCell(rest.slice(1));
      }
      setEntryPath(result, path, value, parents);
    }
  }
  // Whole-document comparison also detects interleaved paths and versions.
  if (hasPaths ? encode(result) !== text
    : encode(result, { format: "1.1" }) !== text && encode(result, { format: "1.0" }) !== text) {
    throw new SyntaxError("Noncanonical Terset text.");
  }
  return result;
}

/** Strict canonical decoder. Rejected text always raises SyntaxError. */
export function decode(text: string): JsonRoot {
  return parseDocument(text);
}

function parseDocument(text: string, features?: Set<RuleFeature>): JsonRoot {
  if (typeof text !== "string") throw new TypeError("Expected Terset text.");
  try {
    return readDocument(text, features);
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      throw new SyntaxError(error.message, { cause: error });
    }
    throw error;
  }
}
