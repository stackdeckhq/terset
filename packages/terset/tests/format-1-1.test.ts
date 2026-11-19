import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { decode, encode, RULES, rulesFor, type JsonRoot } from "../src/index.ts";
import { encoderRules } from "./rules-truth.ts";

const suite = new URL("../../../conformance/1.1/", import.meta.url);
const read = (file: string): unknown => JSON.parse(readFileSync(new URL(file, suite), "utf8"));
const cases = read("cases.json") as { name: string; input: JsonRoot; encoded: string }[];
const rejections = read("rejections.json") as string[];

it("encodes and decodes every 1.1 case with exact bytes and own key order", () => {
  for (const { name, input, encoded } of cases) {
    assert.equal(encode(input), encoded, name);
    assert.equal(encode(input, { format: "1.1" }), encoded, name);
    assert.equal(JSON.stringify(decode(encoded)), JSON.stringify(input), name);
    assert.equal(rulesFor(encoded), encoderRules(input), name);
  }
});

it("rejects every 1.1 rejection with SyntaxError", () => {
  for (const text of rejections) {
    assert.throws(() => decode(text), SyntaxError, JSON.stringify(text));
    assert.throws(() => rulesFor(text), SyntaxError, JSON.stringify(text));
  }
});

it("still writes and reads format 1.0 sparse tables", () => {
  const value = [{ a: 1, b: 2, c: 3 }, { a: 4, c: 6 }];
  const legacy = "[2]\na\tb\tc\n1\t2\t3\n4\t\t6";
  assert.equal(encode(value, { format: "1.0" }), legacy);
  assert.equal(JSON.stringify(decode(legacy)), JSON.stringify(value));
  assert.equal(rulesFor(legacy), encoderRules(value, "1.0"));
});

it("rejects a document that mixes 1.0 and 1.1 tables", () => {
  const value = { x: [{ a: 1, b: 2 }, { a: 3 }], y: [{ a: 1, b: 2 }, { a: 3 }] };
  const named = encode(value);
  const legacy = encode(value, { format: "1.0" });
  assert.deepEqual(decode(named), value);
  assert.deepEqual(decode(legacy), value);
  const [x] = named.split("\ny");
  const mixed = `${x}\ny${legacy.split("\ny")[1]}`;
  assert.throws(() => decode(mixed), { name: "SyntaxError", message: "Noncanonical Terset text." });
});

it("fits the named rule only where a named table needs it", () => {
  const named = "After the header columns, a row lists its other fields as name=value. A field a row does not list is absent.";
  const list = "[2]\na\tname=value\n1\tb=2\tc=3\n4\tc=6";
  assert.equal(rulesFor(list), ["Tables use tab-separated headers and rows.", named].join(" "));
  const keyed = "m{3}:\n@key\ta\tname=value\nalpha\t1\tb=2\nbeta\t3\ngamma\t4\tb=5";
  assert.equal(rulesFor(keyed), [
    "Tables use tab-separated headers and rows.",
    named,
    "name{N} has N entries; the @key column holds each entry's key and is not a field.",
  ].join(" "));
  assert.equal(rulesFor("[2]\na\tb\n1\t2\n3\t4"), "Tables use tab-separated headers and rows.");
  assert.ok(RULES.includes(named));
  assert.ok(!RULES.includes("index 0"));
});

it("validates the format option", () => {
  for (const options of [{ format: "2.0" }, { format: 1.1 }, null, "1.1"]) {
    assert.throws(() => encode([], options as never), TypeError, JSON.stringify(options));
  }
  assert.equal(encode([], {}), "[]");
});

it("encodes wide sparse lists in linear time", () => {
  const rows = Array.from({ length: 20_000 }, (_, index) => ({ [`field_${index}`]: index, shared: index }));
  const started = performance.now();
  const text = encode(rows);
  assert.ok(performance.now() - started < 2_000, "wide sparse encode took too long");
  assert.ok(text.startsWith("[20000]\nname=value\nfield_0=0\tshared=0\n"));
  assert.deepEqual(decode(text), rows);
});
