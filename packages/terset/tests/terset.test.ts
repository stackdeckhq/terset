import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RULES, decode, encode, type JsonObject, type JsonValue } from "../src/index.ts";

function roundTrip(value: JsonObject): string {
  const text = encode(value);
  assert.deepEqual(decode(text), value);
  assert.equal(JSON.stringify(decode(text)), JSON.stringify(value), "key order");
  assert.equal(encode(value), text, "deterministic output");
  return text;
}

describe("terset", () => {
  it("writes string ids bare, a single tab header, distinct text and scalar cells", () => {
    const value = { items: [
      { id: "1", n: 2024, s: "2024", yes: true, text: "true", nil: null, empty: "", missing: "present" },
      { id: "2", n: 0, s: "007", yes: false, text: "false", nil: "null", empty: "" },
    ] };
    const text = roundTrip(value);
    assert.equal(text, 'items[2]:\nid\tn\ts\tyes\ttext\tnil\tempty\tmissing\n1\t2024\t"2024"\ttrue\t"true"\tnull\t""\tpresent\n2\t0\t"007"\tfalse\t"false"\t"null"\t""\t');
    assert.equal(RULES, "Tables use tab-separated headers and rows. Empty cells mean absent. JSON quotes distinguish numeric, boolean or null text from scalars. Nested cells use JSON. A leading bare id header marks string IDs. name{N} has N entries; the @key column holds each entry's key and is not a field. Header a.b is field b in object a.");
  });

  it("keeps empty, absent and null fields separate", () => {
    roundTrip({ rows: [{ id: "1", a: "", b: null }, { id: "2", b: "", c: null }, { id: "3", a: null }] });
  });

  it("quotes numeric-looking text and troublesome characters", () => {
    roundTrip({ values: ["007", "+5", "1e3", "-0", "", "true", "false", "null", "a\tb", "a\nb", "\r\n", "\u0000", "\u0085", "\u2028", "\u2029", "\u007f", " lead", "trail ", '"quoted"', "😀 ñ 中文", "\ud800"].map((text, index) => ({ id: String(index), text })) });
  });

  it("preserves root, table, fallback and nested key order", () => {
    const value = JSON.parse('{"10":10,"2":2,"z":[{"id":"1","b":2},{"id":"2","b":3,"c":4}],"a":{"z":1,"a":2}}') as JsonObject;
    roundTrip(value);
    // A later row may add a field before ones an earlier row already has.
    assert.equal(roundTrip({ list: [{ id: "1", b: 1 }, { id: "2", a: 2, b: 3 }] }), "list[2]:\nid\ta\tb\n1\t\t1\n2\t2\t3");
    for (const list of [
      [{ id: "1", a: 1, b: 2 }, { id: "2", b: 3, a: 4 }],
      [{ a: 1, id: "1" }, { id: "2", a: 2 }],
      [{ id: "1" }, 7], [], [{ id: "" }], [{ id: "a\tb" }],
    ] satisfies JsonValue[][]) {
      const text = roundTrip({ list });
      assert.equal(text, `list: ${JSON.stringify(list)}`);
    }
  });

  it("keeps id-looking syntax unambiguous, including one-column tables", () => {
    for (const id of ["foo: bar", "foo:", '"foo": bar', "-0", "1e3", "true", "{x}", "[]", "c2"]) {
      roundTrip({ rows: [{ id }], next: "end" });
      roundTrip({ rows: [{ id, text: "ok" }], next: "end" });
    }
  });

  it("keeps __proto__ and constructor as ordinary data at every level", () => {
    const value = JSON.parse('{"__proto__":{"polluted":true},"rows":[{"id":"1","__proto__":{"x":1},"constructor":"plain"},{"id":"2","__proto__":null}],"nested":{"__proto__":7}}') as JsonObject;
    const decoded = decode(roundTrip(value));
    assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
    assert.ok(Object.hasOwn(decoded, "__proto__"));
    assert.equal(Object.hasOwn({}, "polluted"), false);
  });

  it("supports deeply nested compact JSON", () => {
    let nested: JsonValue = "end";
    for (let i = 0; i < 200; i++) nested = i % 2 ? [nested] : { nested };
    roundTrip({ nested, rows: [{ id: "1", nested }] });
  });

  it("rejects negative zero rather than losing its sign", () => {
    assert.throws(() => encode({ value: -0 }), /negative zero/);
    assert.throws(() => decode("value: -0"));
    roundTrip({ value: "-0", zero: 0 });
  });

  it("rejects malformed and noncanonical input without evaluating text", () => {
    for (const text of ["", "x: 1\n", "x: 01", "x: +5", "x: undefined", "x: 1\nx: 2", 'x: {"a":1,"a":2}', 'x: { "a":1}', "rows:\nid\tx\n1\ta\textra", "rows:\nid\tid\n1\t2", "rows:\nid\tx", "rows:\nid\tx\n\ta"]) {
      assert.throws(() => decode(text), text);
    }
    assert.deepEqual(decode("x: (()=>7)()"), { x: "(()=>7)()" });
    const cyclic: JsonObject = {};
    cyclic.self = cyclic;
    assert.throws(() => encode(cyclic), /Cyclic/);
    assert.throws(() => encode({ number: Infinity }), /finite/);
    assert.throws(() => encode({ list: Array(2) as JsonValue[] }), /Sparse/);
  });
});
