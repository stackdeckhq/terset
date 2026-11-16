import { encode, RULES, type JsonObject, type JsonRoot, type JsonValue } from "../src/index.ts";

function object(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Derive the feature truth from source values and the encoder's choice of table,
// without parsing any header or consulting the decoder's feature collector.
export function encoderRules(input: JsonRoot): string {
  let keyed = false;
  let nested = false;
  const candidates = Array.isArray(input) ? [input] : Object.values(input);
  for (const value of candidates) {
    const encoded = encode({ candidate: value });
    const list = Array.isArray(value) && encoded.startsWith("candidate[");
    const map = object(value) && encoded.startsWith("candidate{");
    if (!list && !map) continue;
    keyed ||= map;
    const rows = Array.isArray(value) ? value : object(value) ? Object.values(value) : [];
    const objects = rows.filter(object);
    const fields = new Set(objects.flatMap(row => Object.keys(row)));
    for (const field of fields) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(field)) continue;
      const first = objects[0]?.[field];
      if (!object(first)) continue;
      const keys = Object.keys(first);
      if (keys.length && keys.every(key => /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key))
        && objects.every(row => object(row[field]) && JSON.stringify(Object.keys(row[field])) === JSON.stringify(keys))) nested = true;
    }
  }
  const sentences = RULES.split(". ");
  return [
    `${sentences.slice(0, 5).join(". ")}.`,
    ...(keyed ? [`${sentences[5]}.`] : []),
    ...(nested ? [sentences[6]!] : []),
  ].join(" ");
}
