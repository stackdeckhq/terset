import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { decode, encode, rulesFor, type JsonRoot, type JsonValue } from "../src/index.ts";

const suite = new URL("../../../conformance/1.2/", import.meta.url);
const read = (file: string): unknown => JSON.parse(readFileSync(new URL(file, suite), "utf8"));
const cases = read("cases.json") as { name: string; input: JsonRoot; encoded: string }[];
const rejections = read("rejections.json") as string[];

for (const { name, input, encoded } of cases) {
  it("encodes and decodes format 1.2: " + name, () => {
    assert.equal(encode(input), encoded);
    assert.equal(encode(input, { format: "1.2" }), encoded);
    const decoded = decode(encoded);
    assert.equal(JSON.stringify(decoded), JSON.stringify(input));
    assert.equal(encode(decoded), encoded);
    const legacy = encode(input, { format: "1.1" });
    assert.ok(Buffer.byteLength(encoded) <= Buffer.byteLength(legacy));
    assert.equal(JSON.stringify(decode(legacy)), JSON.stringify(input));
  });
}

it("rejects every ill-formed or noncanonical format 1.2 document", () => {
  for (const text of rejections) {
    assert.throws(() => decode(text), SyntaxError, JSON.stringify(text));
    assert.throws(() => rulesFor(text), SyntaxError, JSON.stringify(text));
  }
});

it("reports path conflicts and length errors", () => {
  for (const [text, message] of [
    ["a/b: 1\na/b: 2", "Duplicate or conflicting entry path."],
    ["a: {}\na/b: 1", "Duplicate or conflicting entry path."],
    ["a/b: 1\na: {}", "Duplicate or conflicting entry path."],
    ["a/b/c/d/e/f/g/h/i: 1", "Maximum entry path is 8 segments."],
    ["a/b: 1\nz: 0\na/c: 2", "Noncanonical Terset text."],
  ] as const) {
    assert.throws(() => decode(text), { name: "SyntaxError", message });
    assert.throws(() => rulesFor(text), { name: "SyntaxError", message });
  }
});

it("keeps the depth limit when a table hangs from a path", () => {
  const prefix = "a/b/c/d/e/f/g/h[2]:\nv\n";
  // The first row is at depth 9 and its v cell at depth 10.
  const cell = (levels: number) => '{"next":'.repeat(levels) + "1" + "}".repeat(levels);
  assert.doesNotThrow(() => decode(prefix + cell(490) + "\n2"));
  assert.throws(() => decode(prefix + cell(491) + "\n2"), {
    name: "SyntaxError", message: "Maximum JSON depth is 500.",
  });
});

it("encodes wide values at the end of deep object paths", () => {
  // The large leaf must not be serialized afresh for every enclosing entry.
  const wide = Object.fromEntries(Array.from({ length: 20_000 }, (_, index) => [String(index), index]));
  let leaf: JsonValue = wide;
  for (let depth = 0; depth < 491; depth++) leaf = { next: leaf };
  const json = '{"next":'.repeat(491) + JSON.stringify(wide) + "}".repeat(491);
  const input = { a: { b: { c: { d: { e: { f: { g: { h: leaf } } } } } } } };
  const start = performance.now();
  assert.equal(encode(input), "a/b/c/d/e/f/g/h: " + json);
  assert.ok(performance.now() - start < 2_000);
});
