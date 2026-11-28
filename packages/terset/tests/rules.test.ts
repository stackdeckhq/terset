import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { decode, encode, RULES, rulesFor } from "../src/index.ts";
import { encoderRules, SENTENCES } from "./rules-truth.ts";

it("fits the shared construct combinations and ignores quoted and cell lookalikes", () => {
  const cases = JSON.parse(readFileSync(new URL("./rules-cases.json", import.meta.url), "utf8")) as { name: string; text: string; features: string[]; rules: string }[];
  const fitted = (features: string[]): string => Object.entries(SENTENCES)
    .flatMap(([feature, sentence]) => features.includes(feature) ? [sentence] : []).join(" ");
  for (const entry of cases) {
    if (!entry.features.includes("path")) {
      const input = decode(entry.text);
      const format = encode(input, { format: "1.1" }) === entry.text ? "1.1" : "1.0";
      assert.equal(encoderRules(input, format), entry.rules, `${entry.name}: source oracle`);
    }
    assert.equal(rulesFor(entry.text), entry.rules, entry.name);
    assert.equal(fitted(entry.features), entry.rules, `${entry.name}: features`);
  }
  // No document contains every feature, so the cases cover RULES together.
  assert.deepEqual(new Set(cases.flatMap(entry => entry.features)), new Set(Object.keys(SENTENCES)));
  assert.equal(RULES, Object.values(SENTENCES).join(" "));
});

it("rejects the same strings with the same error as decode", () => {
  const cases = JSON.parse(readFileSync(new URL("../../../conformance/rejection-errors.json", import.meta.url), "utf8")) as { text: string }[];
  for (const { text } of [...cases, { text: "{2}\n@key\tname\na\tAda\nb\tLin" }]) {
    let rejection: unknown;
    try { decode(text); } catch (error) { rejection = error; }
    assert.ok(rejection instanceof Error);
    assert.throws(() => rulesFor(text), { name: rejection.name, message: rejection.message });
  }
});
