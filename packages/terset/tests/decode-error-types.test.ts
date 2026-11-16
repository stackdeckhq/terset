import assert from "node:assert/strict";
import { it } from "node:test";
import { decode, encode } from "../src/index.ts";

const rejected = [
  '[2]\ny\tc\n{}\t-0\n"{"\t"-0"',
  "x: -0",
  "x: 1e999",
  "[1e999]",
  `x: ${"[".repeat(501)}${"]".repeat(501)}`,
  "[".repeat(502) + "]".repeat(502),
  `[2]\n${Array.from({ length: 501 }, () => "a").join(".")}\n1\n2`,
  "[2]\nlong_field\none",
];

for (const [index, text] of rejected.entries()) {
  it(`rejects damaged text ${index + 1} with SyntaxError`, () => {
    assert.throws(() => decode(text), SyntaxError);
  });
}

it("keeps encode validation errors as TypeError", () => {
  assert.throws(() => encode({ value: -0 }), TypeError);
  assert.throws(() => encode({ value: Infinity }), TypeError);
  assert.throws(() => encode({ value: NaN }), TypeError);
});
