import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode, type FormatVersion, type JsonValue } from "../src/index.ts";

function roundTrip(value: JsonValue[] | { [key: string]: JsonValue }, format: FormatVersion = "1.1"): string {
  const text = encode(value, { format });
  const decoded = decode(Buffer.from(text, "utf8").toString("utf8"));
  assert.deepEqual(decoded, value);
  assert.equal(JSON.stringify(decoded), JSON.stringify(value), "key order");
  assert.equal(encode(value, { format }), text);
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

it("allows skipped first fields, empty rows and empty text in one-column 1.0 tables", () => {
  assert.equal(roundTrip([{ long_field: "" }, {}], "1.0"), '[2]\nlong_field\n""\n');
  assert.equal(roundTrip([{}, { long_field: null }], "1.0"), '[2]\nlong_field\n\nnull');
  roundTrip({ rows: [{ first_long_field: "a", second_long_field: null }, { second_long_field: "b" }], next: "end" }, "1.0");
  // Named cells repeat the name, so JSON is smaller for these two in 1.1.
  assert.equal(roundTrip([{ long_field: "" }, {}]), '[{"long_field":""},{}]');
  assert.equal(roundTrip([{}, { long_field: null }]), '[{},{"long_field":null}]');
  assert.equal(roundTrip({ rows: [{ first_long_field: "a", second_long_field: null }, { second_long_field: "b" }], next: "end" }),
    "rows[2]:\nname=value\nfirst_long_field=a\tsecond_long_field=null\nsecond_long_field=b\nnext: end");
});

it("quotes one-column root-line lookalikes instead of consuming the next root field", () => {
  const values = ["next: end", "next:", '"next": end', "12", "true", "null", "", "id", "rows:"].map((value) => ({ long_field: value }));
  const text = roundTrip({ rows: values, next: "end" });
  assert.ok(text.includes('"next: end"'));
  roundTrip(values);
  roundTrip({ rows: [{ id: "next:" }, { id: "other:" }], next: "end" });
});

it("orders the header so every row's own key order fits, first-seen when several fit", () => {
  // An early row skips a middle field that a later row has.
  const skipped = [{ key: "a", text: "A", maxLength: 30 }, { key: "b", text: "B", description: "D", maxLength: 61 }];
  assert.equal(roundTrip(skipped, "1.0"), "[2]\nkey\ttext\tdescription\tmaxLength\na\tA\t\t30\nb\tB\tD\t61");
  assert.equal(roundTrip(skipped), "[2]\nkey\ttext\tname=value\na\tA\tmaxLength=30\nb\tB\tdescription=D\tmaxLength=61");
  // A field every earlier row skipped can lead the header.
  assert.equal(roundTrip([{ a: 1, b: 2 }, { c: 3, a: 4 }], "1.0"), "[2]\nc\ta\tb\n\t1\t2\n3\t4\t");
  assert.equal(roundTrip([{ a: 1, b: 2 }, { c: 3, a: 4 }]), "[2]\nname=value\na=1\tb=2\nc=3\ta=4");
  // Both a and b may come first; a was seen first.
  assert.equal(roundTrip([{ a: 1, c: 2 }, { b: 3, c: 4 }], "1.0"), "[2]\na\tb\tc\n1\t\t2\n\t3\t4");
  assert.equal(roundTrip([{ a: 1, c: 2 }, { b: 3, c: 4 }]), "[2]\nname=value\na=1\tc=2\nb=3\tc=4");
  assert.equal(roundTrip({ rows: skipped }, "1.0"), "rows[2]:\nkey\ttext\tdescription\tmaxLength\na\tA\t\t30\nb\tB\tD\t61");
  const people = { people: { ada: { a: 1, c: 2 }, lin: { b: 3, c: 4 } } };
  assert.equal(roundTrip(people, "1.0"), "people{2}:\n@key\ta\tb\tc\nada\t1\t\t2\nlin\t\t3\t4");
  assert.equal(roundTrip(people), 'people: {"ada":{"a":1,"c":2},"lin":{"b":3,"c":4}}');
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
  assert.equal(roundTrip(tooWide, "1.0"), JSON.stringify(tooWide), "sparse table overhead exceeds JSON");
  assert.equal(roundTrip({ rows: tooWide }, "1.0"), `rows: ${JSON.stringify(tooWide)}`);
  // Named cells write only present fields, so 1.1 still beats JSON here.
  assert.equal(roundTrip(tooWide), `[20]\nname=value\n${tooWide.map((_, index) => `field_${index}=${index}`).join("\n")}`);
});

it("keeps nested lists as compact JSON cells", () => {
  const list = [{ order: "A", lines: [{ sku: "X", qty: 1 }] }, { order: "B", lines: [{ sku: "Y", qty: 2 }] }];
  const text = roundTrip(list);
  assert.ok(text.includes('[{"sku":"X","qty":1}]'));
});

it("strictly rejects ambiguous, duplicate, noncanonical or too-small table text", () => {
  for (const text of ["value\ntrue", "a\ta\n1\t2\n3\t4", '"id"\n01\n2', "x\n-0\n1", "a\tb\n1\t2\textra\n3\t4", "rows:\nvalue\nnext: end\nx: 1"]) assert.throws(() => decode(text), text);
});
