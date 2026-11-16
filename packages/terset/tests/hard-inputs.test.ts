import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";
import { HARD_CASES } from "./hard-cases.ts";

export function exact(actual: unknown, expected: unknown): void {
  assert.deepEqual(actual, expected);
  if (typeof expected === "object" && expected !== null && typeof actual === "object" && actual !== null) {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), "own key order");
    for (const key of Object.keys(expected)) exact(Reflect.get(actual, key), Reflect.get(expected, key));
  }
}

for (const entry of HARD_CASES) it(`hard input: ${entry.name}`, () => {
  if (entry.limit) {
    assert.throws(() => encode(entry.value), entry.limit === "depth" ? /depth/ : /negative zero/);
    return;
  }
  const encoded = encode(entry.value);
  exact(decode(encoded), entry.value);
  exact(decode(Buffer.from(encoded, "utf8").toString("utf8")), entry.value);
  assert.equal(encode(entry.value), encoded);
});
