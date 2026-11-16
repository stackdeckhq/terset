import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";

it("decodes 5,000 dotted columns without comparing every pair of paths", () => {
  const fields = Object.fromEntries(Array.from({ length: 5_000 }, (_, index) => [`f${index}`, index]));
  const rows = [{ a: fields }, { a: fields }, { a: fields }];
  const text = encode(rows);
  assert.ok(text.startsWith("[3]\na.f0\ta.f1\t"));
  const start = performance.now();
  for (let repeat = 0; repeat < 5; repeat++) assert.deepEqual(decode(text), rows);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 750, `Five decodes took ${elapsed.toFixed(1)} ms; limit is 750 ms.`);
});

it("decodes 20,000 flat and dotted columns within the wide-header bound", () => {
  const fields = Object.fromEntries(Array.from({ length: 20_000 }, (_, index) => [`f${index}`, index]));
  for (const rows of [[fields, fields, fields], [{ a: fields }, { a: fields }, { a: fields }]]) {
    const text = encode(rows);
    const start = performance.now();
    assert.deepEqual(decode(text), rows);
    assert.ok(performance.now() - start < 750);
  }
});
