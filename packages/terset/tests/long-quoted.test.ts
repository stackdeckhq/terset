import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode, rulesFor } from "../src/index.ts";

it("round trips long quoted cells, ids, entry keys and root keys", () => {
  const text = '"' + "a".repeat(8_500_000);
  const values = [
    [{ note: text }, { note: "b" }],
    [{ id: text }, { id: "b" }],
    { rows: { [text]: { name: "Ada" }, other: { name: "Ben" } } },
    { [text]: 1 },
  ];
  for (const value of values) {
    const encoded = encode(value);
    assert.deepEqual(decode(encoded), value);
    assert.equal(typeof rulesFor(encoded), "string");
  }
});
