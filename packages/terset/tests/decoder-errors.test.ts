import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";

interface RejectionCase { name: string; text: string; error: string }

const cases = JSON.parse(readFileSync(new URL("./rejection-errors.json", import.meta.url), "utf8")) as RejectionCase[];
for (const entry of cases) {
  it(`reports ${entry.name} before canonical validation`, () => {
    assert.throws(() => decode(entry.text), { name: "SyntaxError", message: entry.error });
  });
}

it("keeps a one-entry map as JSON even when a keyed table would be smaller", () => {
  const row = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`long_field_${index}`, index]));
  const value = { rows: { a: row } };
  const json = `rows: ${JSON.stringify(value.rows)}`;
  const candidate = `rows{1}:\n@key\t${Object.keys(row).join("\t")}\na\t${Object.values(row).join("\t")}`;
  assert.ok(Buffer.byteLength(candidate) < Buffer.byteLength(json));
  assert.equal(encode(value), json);
  assert.deepEqual(decode(json), value);
});
