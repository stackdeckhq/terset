import { encode, type JsonRoot, type JsonValue } from "../src/index.ts";
import { HARD_CASES, HARD_STRINGS } from "./hard-cases.ts";
import type { SharedRecipe } from "./shared-recipes.ts";

type SharedInput = { name: string; input: JsonRoot } | { name: string; recipe: SharedRecipe };

const inputs: SharedInput[] = [
  ...[8, 9, 30].map(depth => {
    const nest = (leaf: number): JsonValue => {
      let value: JsonValue = leaf;
      for (let index = 0; index < depth; index++) value = { a: value };
      return value;
    };
    return { name: `nested columns at depth ${depth}`, input: [nest(1), nest(2)] };
  }),
  ...HARD_CASES.filter((entry) => !entry.limit).map<SharedInput>(({ name, value, recipe }) => recipe ? { name, recipe } : { name, input: value }),
  { name: "empty object", input: {} },
  { name: "empty array", input: [] },
  { name: "empty rows fallback", input: [{}, {}] },
  { name: "single row fallback", input: [{ a: 1 }] },
  { name: "incompatible key order fallback", input: [{ a: 1, b: 2 }, { b: 3, a: 4 }] },
  { name: "header fits a skipped middle field", input: [{ key: "a", text: "A", maxLength: 30 }, { key: "b", text: "B", description: "D", maxLength: 61 }] },
  { name: "header led by a later field", input: [{ a: 1, b: 2 }, { c: 3, a: 4 }] },
  { name: "header ties go to the first-seen field", input: [{ a: 1, c: 2 }, { b: 3, c: 4 }] },
  { name: "wide sparse fallback", input: Array.from({ length: 30 }, (_, i) => ({ [`field_${i}`]: i })) },
  { name: "integer key order", input: JSON.parse('{"10":10,"2":2,"z":{"4":4,"1":1,"a":3},"01":0}') as JsonRoot },
  { name: "nested table cells", input: [{ order: "A", lines: [{ sku: "X" }], info: { a: 1 } }, { order: "B", lines: [], info: {} }] },
  { name: "missing final cell", input: [{ long_field: "" }, {}] },
  { name: "missing first field", input: [{}, { long_field: null }] },
  { name: "nonleading id", input: [{ name: "Ada", id: "12" }, { name: "Ben", id: 34 }] },
  { name: "UTF-8 size selection", input: Array.from({ length: 9 }, (_, i) => ({ [`中中${i}`]: 1, [`中中${i + 1}`]: 1 })) },
  { name: "number formatting boundaries", input: { values: [1.0, 1e-6, 1e-7, 1e20, 1e21, 1e23, 5e-324, Number.MAX_VALUE, 1000000000000000128, 0.10000000000000002, 2.2250738585072014e-308] } },
  { name: "array-index boundary keys", input: { "4294967295": "ordinary", label: "middle", "4294967294": "index" } },
  { name: "integer-like table keys", input: [
    { "4294967295": 5, label: "first", "4294967294": 4, "10": 10, "2": 2, "02": "02" },
    { "4294967295": 6, label: "second", "4294967294": 3, "10": 20, "2": 1, "02": "03" },
  ] },
  { name: "signed root numbers", input: { negative: -7, fraction: -0.5, small: -1e-7, tiny: -5e-324, large: -1e21, positive: 1.5e-7 } },
  { name: "signed table numbers", input: [{ negative: -7, small: -1e-7, positive: 1.5e-7 }, { negative: -0.5, small: -5e-324, positive: 1e-6 }] },
  { name: "equal-size table fallback", input: [{ a: 1 }, { b: 1 }, { c: 1 }, { d: 1 }, { e: 1 }, {}] },
  { name: "counted list next to fields", input: { before: true, rows: [{ name: "Ada" }, { name: "Lin" }], after: false } },
  { name: "compact count lookalike", input: [409] },
  { name: "keyed table", input: { people: { ada: { name: "Ada", age: 32 }, lin: { name: "Lin", age: 29 } } } },
  { name: "keyed empty rows and typed ids", input: { people: { "007": { id: "true", name: "Ada", age: 32 }, true: { id: 4, age: 29 }, "two words": {} } } },
  { name: "keyed size tie fallback", input: { map: { k0: { a: 1 }, k1: { b: 1 }, k2: { c: 1 }, k3: { d: 1 }, k4: { e: 1 }, k5: { f: 1 } } } },
  { name: "keyed strictly smaller boundary", input: { map: { k0: { a: 1, b: 1 }, k1: { b: 1 }, k2: { c: 1 }, k3: { d: 1 }, k4: { e: 1 }, k5: { f: 1 } } } },
  { name: "root map stays fields", input: { ada: { name: "Ada", age: 32 }, lin: { name: "Lin", age: 29 } } },
  { name: "recursive nested columns", input: [{ address: { city: "Paris", stats: { n: 1 } } }, { address: { city: "Rome", stats: { n: 2 } } }] },
  { name: "keyed nested columns and literal dotted fields", input: { rows: { first: { "@key": "one", "a.b": 1, a: { b: 2 } }, second: { "@key": "two", "a.b": 3, a: { b: 4 } } } } },
  ...["", " edge", "edge ", "two\twords", "name:", "name[2]:", "name{2}:", '"odd key":'].map(key => ({ name: `unsafe entry key ${JSON.stringify(key)}`, input: { people: { [key]: { name: "Ada", age: 32 }, other: { name: "Lin", age: 29 } } } })),
  ...[
    [{ address: { city: "Paris" } }, {}],
    [{ address: { city: "Paris", country: "FR" } }, { address: { country: "IT", city: "Rome" } }],
    [{ address: {} }, { address: {} }],
    [{ address: { "a.b": 1 } }, { address: { "a.b": 2 } }],
    [{ "a.b": { city: "Paris" } }, { "a.b": { city: "Rome" } }],
  ].map((input, index) => ({ name: `nested column fallback ${index}`, input })),
  ...["name[2]:", "name{2}:", '"odd key"[2]:'].map(text => ({ name: `counted line lookalike ${text}`, input: { rows: [{ id: text }, { id: "safe" }], after: true } })),
  ...HARD_STRINGS.flatMap((text, index) => [
    { name: `string ${index} in ordinary column`, input: [{ long_field: text }, { long_field: "ok" }] },
    { name: `string ${index} in id column`, input: { rows: [{ id: text }, { id: "ok" }], next: "end" } },
  ]),
  ...['"\\q": x', '"\\u12": x', '"": x', '"\\": x', "foo: bar", "foo:", '"foo": bar'].flatMap((text, index) => [
    { name: `root line lookalike ${index}`, input: [{ long_field: text }, { long_field: "ok" }] },
    { name: `id line lookalike ${index}`, input: { rows: [{ id: text }, { id: "ok" }], next: "end" } },
  ]),
];

export function sharedCases(): string {
  // conformance/cases.json is the frozen format 1.0 suite.
  return `${JSON.stringify(inputs.map((entry) => "recipe" in entry ? entry : { ...entry, encoded: encode(entry.input, { format: "1.0" }) }), null, 2)}\n`;
}
