import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode, type JsonValue } from "../src/index.ts";

function roundTrip(value: JsonValue[] | { [key: string]: JsonValue }): string {
  const text = encode(value);
  const decoded = decode(Buffer.from(text, "utf8").toString("utf8"));
  assert.deepEqual(decoded, value);
  assert.equal(JSON.stringify(decoded), JSON.stringify(value), "key order");
  assert.equal(encode(value), text);
  return text;
}

it("tabulates numeric ids without converting their types or requiring a name line", () => {
  const rows = [{ id: 12, name: "Alice" }, { id: 34, name: "Bob" }];
  assert.equal(roundTrip(rows), '[2]\n"id"\tname\n12\tAlice\n34\tBob');
});

it("tabulates rows with any first key, boolean/null cells and mixed-type columns", () => {
  const rows = [true, "true", 12, "12", null, "null", false, "", "a\tb", "a\nb"].map((value) => ({ value, note: "x" }));
  const text = roundTrip({ rows });
  assert.ok(text.startsWith("rows[10]:\nvalue\tnote\ntrue\tx\n\"true\"\tx\n12\tx\n\"12\"\tx\nnull\tx"));
  assert.ok(text.includes('""\tx'));
  assert.ok(text.includes('"a\\tb"\tx'));
  assert.ok(text.includes('"a\\nb"\tx'));
});

it("keeps the existing bare string-id convention and distinguishes typed first id columns", () => {
  assert.equal(roundTrip([{ id: "12" }, { id: "34" }]), "[2]\nid\n12\n34");
  assert.equal(roundTrip([{ id: "12" }, { id: 34 }]), '[2]\n"id"\n"12"\n34');
  assert.equal(roundTrip([{ id: true }, { id: null }]), '[2]\n"id"\ntrue\nnull');
  assert.equal(roundTrip([{ name: "Alice", id: "12" }, { name: "Bob", id: 34 }]), '[2]\nname\tid\nAlice\t"12"\nBob\t34');
});

it("allows skipped first fields, empty rows and empty text in one-column tables", () => {
  assert.equal(roundTrip([{ long_field: "" }, {}]), '[2]\nlong_field\n""\n');
  assert.equal(roundTrip([{}, { long_field: null }]), '[2]\nlong_field\n\nnull');
  roundTrip({ rows: [{ first_long_field: "a", second_long_field: null }, { second_long_field: "b" }], next: "end" });
});

it("quotes one-column root-line lookalikes instead of consuming the next root field", () => {
  const values = ["next: end", "next:", '"next": end', "12", "true", "null", "", "id", "rows:"].map((value) => ({ long_field: value }));
  const text = roundTrip({ rows: values, next: "end" });
  assert.ok(text.includes('"next: end"'));
  roundTrip(values);
  roundTrip({ rows: [{ id: "next:" }, { id: "other:" }], next: "end" });
});

it("uses one whole-list JSON fallback for incompatible order, scalars, nested lists and small lists", () => {
  const lists: JsonValue[][] = [[], [{}], [{ a: 1 }], [{}, {}], [1, { a: 1 }], [[{ a: 1 }, { a: 2 }]], [{ a: 1, b: 2 }, { b: 3, a: 4 }]];
  for (const list of lists) assert.equal(roundTrip(list), JSON.stringify(list));
  // A long header costs more than JSON when every value in that column is absent
  // in the other rows. The length comparison decides, without another syntax.
  const sparse = [{ a: 1 }, { "a very long field with spaces": 2 }];
  const text = roundTrip(sparse);
  assert.ok(Buffer.byteLength(text) <= Buffer.byteLength(JSON.stringify(sparse)));
  const tooWide = Array.from({ length: 20 }, (_, index) => ({ [`field_${index}`]: index }));
  assert.equal(roundTrip(tooWide), JSON.stringify(tooWide), "sparse table overhead exceeds JSON");
  assert.equal(roundTrip({ rows: tooWide }), `rows: ${JSON.stringify(tooWide)}`);
});

it("keeps nested lists as compact JSON cells", () => {
  const list = [{ order: "A", lines: [{ sku: "X", qty: 1 }] }, { order: "B", lines: [{ sku: "Y", qty: 2 }] }];
  const text = roundTrip(list);
  assert.ok(text.includes('[{"sku":"X","qty":1}]'));
});

it("strictly rejects ambiguous, duplicate, noncanonical or too-small table text", () => {
  for (const text of ["value\ntrue", "a\ta\n1\t2\n3\t4", '"id"\n01\n2', "x\n-0\n1", "a\tb\n1\t2\textra\n3\t4", "rows:\nvalue\nnext: end\nx: 1"]) assert.throws(() => decode(text), text);
});
