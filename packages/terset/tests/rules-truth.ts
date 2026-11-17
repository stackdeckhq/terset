import { encode, RULES, type JsonObject, type JsonRoot, type JsonValue } from "../src/index.ts";

function object(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const segment = (key: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key);
const rootField = /^(?:"(?:[^"\\]|\\[^\n\r\u2028\u2029])*"|[A-Za-z_$][A-Za-z0-9_$.-]*)(?:\[\d+\]|\{\d+\})?:[\s\S]*$/;

// Inspect source columns recursively. Uniform objects become dotted columns.
function columns(path: string[], values: (JsonValue | undefined)[]): { path: string[]; values: (JsonValue | undefined)[] }[] {
  const first = values[0];
  if (path.length < 8 && path.every(segment) && object(first)) {
    const keys = Object.keys(first);
    if (keys.length && keys.every(segment) && values.every(value => object(value)
      && JSON.stringify(Object.keys(value)) === JSON.stringify(keys))) {
      return keys.flatMap(key => columns([...path, key], values.map(value => object(value) ? value[key] : undefined)));
    }
  }
  return [{ path, values }];
}

// Derive the feature truth from source values and the encoder's choice of table,
// without parsing any header or consulting the decoder's feature collector.
export function encoderRules(input: JsonRoot): string {
  const features = new Set<string>();
  const quoted = (value: JsonValue | undefined): boolean => typeof value === "string"
    && encode({ value }).startsWith('value: "');
  const candidates = Array.isArray(input) ? [input] : Object.values(input);
  for (const value of candidates) {
    const encoded = encode({ candidate: value });
    const list = Array.isArray(value) && encoded.startsWith("candidate[");
    const map = object(value) && encoded.startsWith("candidate{");
    if (!list && !map) {
      if (!Array.isArray(input) && quoted(value)) features.add("quoted");
      continue;
    }
    features.add("table");
    if (map) features.add("keyed");
    const rows = (Array.isArray(value) ? value : object(value) ? Object.values(value) : []).filter(object);
    const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cells = fields.flatMap(field => columns([field], rows.map(row => Object.hasOwn(row, field) ? row[field] : undefined)));
    // Every row starting with id makes it the first field in any valid order.
    const ids = list && cells.some(column => column.path.length === 1 && column.path[0] === "id")
      && rows.every(row => Object.keys(row)[0] === "id" && typeof row.id === "string"
        && row.id.length > 0 && row.id.trim() === row.id && !/[\u0000-\u001f\u007f\u0085\u2028\u2029\ud800-\udfff]/u.test(row.id)
        && (cells.length > 1 || !rootField.test(row.id)));
    if (ids) features.add("id");
    for (const column of cells) {
      if (column.path.length > 1) features.add("nested");
      if (ids && column.path.length === 1 && column.path[0] === "id") continue;
      for (const cell of column.values) {
        if (cell === undefined) features.add("empty");
        if (quoted(cell) || (list && cells.length === 1 && typeof cell === "string" && rootField.test(cell))) features.add("quoted");
        if (object(cell) || Array.isArray(cell)) features.add("json");
      }
    }
  }
  const sentences = RULES.split(". ");
  return ["table", "empty", "quoted", "json", "id", "keyed", "nested"]
    .flatMap((feature, index) => features.has(feature) ? [sentences[index]! + (index < 6 ? "." : "")] : []).join(" ");
}
