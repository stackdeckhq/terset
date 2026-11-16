import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";
import { readFileSync } from "node:fs";
import { seededCases } from "./seeded.ts";

export const REJECTED = [
  "people[3]:\nname\nAda\nLin", "people[1]:\nname\nAda\nLin",
  "[2]\nname\nAda\nLin\nOther", "[3]\nname\nAda\nLin",
  "people{3}:\n@key\tname\na\tAda\nb\tLin",
  "people{2}:\n@key\tname\na\tAda\nb\tLin\nc\tOther",
  "people[2]:\nname\nAda\textra\nLin",
  "people{2}:\n@key\tname\na\tAda\textra\nb\tLin",
  "people[2]:\nname\tname\nAda\tAda\nLin\tLin",
  "people{2}:\n@key\tname\na\tAda\na\tLin",
  "people[2]:\nname\nAda\nLin\npeople: true",
  'value: {"a":1,"a":2}', '[2]\na.b\ta\n1\t{}\n2\t{}',
  "[2]\na.b\ta.b\n1\t2\n3\t4", "[2]\na..b\n1\n2",
  'people{2}:\n"@key"\tname\na\tAda\nb\tLin',
  "people[02]:\nname\nAda\nLin", 'people[2]:\nname\n"Ada"\nLin',
  '[{"name":"Ada"},{"name":"Lin"}]', "value:  1", "value: 1\n",
  "people:\nname\nAda\nLin", "name\nAda\nLin",
  "[0]\nname", "[9007199254740992]\nname\nAda\nLin",
  "people{2}:\n@key\tname\n\tAda\nb\tLin",
  "people{2}:\n@key\tname\na[2]:\tAda\nb\tLin",
  "[2]\na.b\na\n", "[2]\na.b\ta.c\n1\t\n\t2",
];

it("counts table rows through the public package API", () => {
  const value = { people: [{ name: "Ada" }, { name: "Lin" }] };
  const text = "people[2]:\nname\nAda\nLin";
  assert.equal(encode(value), text);
  assert.deepEqual(decode(text), value);
  assert.throws(() => decode("people[3]:\nname\nAda\nLin"));
});

it("round trips 2,500 seeded keyed and nested roots with exact key order", () => {
  for (const [index, input] of seededCases().entries()) {
    const text = encode(input);
    assert.equal(JSON.stringify(decode(text)), JSON.stringify(input), `seeded case ${index}`);
    assert.equal(encode(decode(text)), text, `seeded case ${index}`);
  }
});

it("uses keyed tables with typed fields and a separate entry key", () => {
  const data = { people: { ada: { id: "007", name: "Ada" }, lin: { id: "true", name: "Lin" } } };
  const text = 'people{2}:\n@key\tid\tname\nada\t"007"\tAda\nlin\t"true"\tLin';
  assert.equal(encode(data), text);
  assert.deepEqual(decode(text), data);
});

it("flattens nested columns and quotes literal dotted fields", () => {
  const data = [{ "a.b": 1, a: { b: { c: "Paris" } } }, { "a.b": 2, a: { b: { c: "Rome" } } }];
  const text = '[2]\n"a.b"\ta.b.c\n1\tParis\n2\tRome';
  assert.equal(encode(data), text);
  assert.equal(JSON.stringify(decode(text)), JSON.stringify(data));
});

it("keeps nested objects with missing, empty, dotted or differently ordered keys as JSON", () => {
  for (const rows of [
    [{ address: { city: "Paris" } }, {}],
    [{ address: {} }, { address: {} }],
    [{ address: { "a.b": 1 } }, { address: { "a.b": 2 } }],
    [{ address: { city: "Paris", country: "FR" } }, { address: { country: "IT", city: "Rome" } }],
  ]) {
    const text = encode(rows);
    assert.ok(!text.includes("address.city"));
    assert.equal(JSON.stringify(decode(text)), JSON.stringify(rows));
  }
});

it("uses compact JSON at the exact keyed-table byte boundary", () => {
  const map = { k0: { a: 1 }, k1: { b: 1 }, k2: { c: 1 }, k3: { d: 1 }, k4: { e: 1 }, k5: { f: 1 } };
  const fields = ["a", "b", "c", "d", "e", "f"];
  const body = ["@key\t" + fields.join("\t"), ...Object.entries(map).map(([key, row]) =>
    [key, ...fields.map(field => Object.hasOwn(row, field) ? "1" : "")].join("\t"))].join("\n");
  const fallback = `map: ${JSON.stringify(map)}`;
  const candidate = `map{6}:\n${body}`;
  assert.equal(Buffer.byteLength(candidate), Buffer.byteLength(fallback));
  assert.equal(encode({ map }), fallback);
  assert.ok(encode({ map: { ...map, k0: { a: 1, b: 1 } } }).startsWith("map{6}:\n"));
});

it("rejects every shared damaged or noncanonical text", () => {
  const texts = JSON.parse(readFileSync(new URL("./rejections.json", import.meta.url), "utf8")) as string[];
  assert.deepEqual(texts, REJECTED);
  for (const text of texts) assert.throws(() => decode(text), text);
});
