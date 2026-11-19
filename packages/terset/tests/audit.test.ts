// Regressions and spec rules found by the pre-release audit.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decode, encode, type JsonRoot, type JsonValue } from "../src/index.ts";

function roundTrip(value: JsonRoot): string {
  const text = encode(value);
  assert.deepEqual(decode(text), value);
  assert.equal(JSON.stringify(decode(text)), JSON.stringify(value), "key order");
  return text;
}

function elapsedMs(run: () => void): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

// Text that looks like a root field but is not valid JSON inside the quotes.
const LOOKALIKES = ['"\\q": x', '"\\u12": x', '"a\tb": x', '"a\nb": x', '"a\rb": x', '"": x', '"\\": x', "foo: bar", "foo:", '"foo": bar', '"foo":'];

describe("audit regressions", () => {
  it("encodes one-column cells that look like a root field with bad escapes", () => {
    for (const text of LOOKALIKES) {
      const rootTable = roundTrip([{ long_field: text }, { long_field: "ok" }]);
      assert.ok(rootTable.startsWith("[2]\n"), `root table for ${JSON.stringify(text)}`);
      const nested = roundTrip({ rows: [{ long_field: text }, { long_field: "ok" }], next: "end" });
      assert.ok(nested.startsWith("rows[2]:\n"), `nested table for ${JSON.stringify(text)}`);
    }
  });

  it("encodes one-column id tables whose ids look like a root field", () => {
    for (const id of [...LOOKALIKES, "-0", "1e3", "true", "{x}", "[]", "c2"]) {
      roundTrip([{ id }, { id: "ok" }]);
      roundTrip({ rows: [{ id }, { id: "ok" }], next: "end" });
      roundTrip({ rows: [{ id: "ok" }, { id }], next: "end" });
    }
    // Plain ids still use the table form, so the cases above do exercise it.
    assert.equal(encode({ rows: [{ id: "c2" }, { id: "c3" }], next: "end" }), "rows[2]:\nid\nc2\nc3\nnext: end");
    assert.equal(encode({ rows: [{ id: "foo:" }, { id: "c3" }], next: "end" }), 'rows[2]:\n"id"\n"foo:"\nc3\nnext: end');
  });

  it("reads long digit runs in linear time", () => {
    const digits = "9".repeat(200_000);
    for (const text of [`${digits}x`, `-${digits}x`, `${digits}.${digits}x`, `1e${digits}x`]) {
      let decoded: JsonRoot = {};
      const ms = elapsedMs(() => { decoded = decode(`x: ${text}`); });
      assert.deepEqual(decoded, { x: text });
      assert.ok(ms < 1000, `took ${String(Math.round(ms))} ms`);
    }
  });

  it("does not build a wide sparse 1.0 table that JSON beats", () => {
    const wide = Array.from({ length: 20_000 }, (_, index) => ({ [`field_${String(index)}`]: index }));
    const text = JSON.stringify(wide);
    assert.equal(encode(wide, { format: "1.0" }), text);
    let decoded: JsonRoot = {};
    const ms = elapsedMs(() => { decoded = decode(text); });
    assert.deepEqual(decoded, wide);
    assert.ok(ms < 1500, `took ${String(Math.round(ms))} ms`);
  });
});

describe("spec rules", () => {
  it("rejects values that are not JSON", () => {
    const bad: unknown[] = [
      { a: undefined }, { a: () => 1 }, { a: 1n }, { a: Symbol("s") }, { [Symbol("k")]: 1 },
      { a: new Date(0) }, { a: new Map() }, { a: Number.NaN }, { a: -Infinity }, { a: [undefined] },
    ];
    for (const value of bad) assert.throws(() => encode(value as JsonRoot), TypeError);
  });

  it("rejects scalar roots", () => {
    for (const value of ["text", 7, true, null, undefined]) assert.throws(() => encode(value as unknown as JsonRoot), TypeError);
    for (const text of ["7", "true", "null", '"text"', "text"]) assert.throws(() => decode(text));
  });

  it("writes the empty root object as {} and the empty root array as []", () => {
    assert.equal(roundTrip({}), "{}");
    assert.equal(roundTrip([]), "[]");
  });

  it("rejects depth over 500 in both directions", () => {
    const nest = (depth: number): string => `${"[".repeat(depth)}${"]".repeat(depth)}`;
    assert.deepEqual(decode(`x: ${nest(500)}`), { x: JSON.parse(nest(500)) as JsonValue });
    assert.throws(() => decode(`x: ${nest(501)}`), /depth/);
    assert.throws(() => decode(nest(502)), /depth/);
    assert.throws(() => encode({ x: JSON.parse(nest(501)) as JsonValue }), /depth/);
  });

  it("keeps newline, carriage-return, tab and lone-surrogate keys in headers and root fields", () => {
    for (const key of ["a\nb", "a\rb", "a\tb", "\ud800", "", " ", "a:b", '"', "\\"]) {
      const text = roundTrip({ [key]: [{ id: "1", [key]: "x" }, { id: "2", [key]: "y" }], [`${key}2`]: 1 });
      assert.ok(!text.includes("\ud800") && !text.includes("\r"), `escaped ${JSON.stringify(key)}`);
      roundTrip([{ [key]: 1, other: "a" }, { [key]: 2, other: "b" }]);
    }
  });

  it("picks the table only when it is smaller in UTF-8 bytes", () => {
    const utf8 = new TextEncoder();
    const lists: JsonValue[][] = [
      [{ a: 1 }, { a: 2 }], [{ a: "é" }, { a: "中" }], [{ é: 1 }, { é: 2 }], [{ a: 1 }, { b: 2 }],
      [{ a: 1, b: 2 }, { c: 3, d: 4 }], [{ a: "😀" }, { b: "😀" }], [{ a: null }, { a: null }], [{ a: [] }, { a: {} }],
    ];
    for (const list of lists) {
      const text = roundTrip(list);
      const json = JSON.stringify(list);
      if (text !== json) assert.ok(utf8.encode(text.slice(text.indexOf("\n") + 1)).length < utf8.encode(json).length, json);
    }
    // Counting characters picks JSON here. Counting bytes picks the 1.0 table.
    const wideKeys = Array.from({ length: 9 }, (_, index) => ({ [`中中${String(index)}`]: 1, [`中中${String(index + 1)}`]: 1 }));
    const table = encode(wideKeys, { format: "1.0" });
    assert.deepEqual(decode(table), wideKeys);
    assert.ok(table.startsWith("[9]\n"), "table form");
    assert.ok(table.length > JSON.stringify(wideKeys).length, "longer in characters");
    assert.equal(utf8.encode(table).length, 211);
    assert.equal(utf8.encode(JSON.stringify(wideKeys)).length, 235);
  });
});
