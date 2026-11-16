import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";

it("rejects a 40,000-segment header cheaply before allocating conflict prefixes", () => {
  const text = `[2]\n${Array<string>(40_000).fill("a").join(".")}\n1\n2`;
  const start = performance.now();
  const before = process.memoryUsage().heapUsed;
  assert.throws(() => decode(text), { name: "SyntaxError", message: "Maximum header path is 8 segments." });
  assert.ok(performance.now() - start < 1000);
  assert.ok(process.memoryUsage().heapUsed - before < 32 * 1024 * 1024);
});

it("round trips eight-segment header paths and rejects one past the cap before rows", () => {
  for (const prefix of ["[2]", "rows[2]:", "rows{2}:"]) {
    const keyed = prefix.includes("{");
    const header = Array<string>(8).fill("a").join(".");
    const text = `${prefix}\n${keyed ? "@key\t" : ""}${header}\n${keyed ? "one\t" : ""}1\n${keyed ? "two\t" : ""}2`;
    assert.equal(encode(decode(text)), text);
    assert.throws(() => decode(text.replace(header, `a.${header}`)), { name: "SyntaxError", message: "Maximum header path is 8 segments." });
    assert.throws(() => decode(`${prefix}\n${keyed ? "@key\t" : ""}a.${header}`), { name: "SyntaxError", message: "Maximum header path is 8 segments." });
  }
});

it("rejects many short rows under a deep header and decodes 50,000 rows at the cap", () => {
  const rows = Array<string>(50_000).fill("1").join("\n");
  assert.throws(() => decode(`[50000]\n${Array<string>(499).fill("a").join(".")}\n${rows}`), SyntaxError);
  const result = decode(`[50000]\n${Array<string>(8).fill("a").join(".")}\n${rows}`);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 50_000);
  const expected = { a: { a: { a: { a: { a: { a: { a: { a: 1 } } } } } } } };
  for (const row of result) assert.deepEqual(row, expected);
});

it("keeps non-string caller errors as TypeError", () => {
  const values: unknown[] = [123, null, undefined, {}, []];
  for (const value of values) {
    assert.throws(() => decode(value as string), TypeError);
  }
});
