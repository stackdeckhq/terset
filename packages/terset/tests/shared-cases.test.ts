import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { sharedCases } from "./shared-cases.ts";
import { decode, encode, rulesFor } from "../src/index.ts";
import { encoderRules } from "./rules-truth.ts";
import { HARD_CASES } from "./hard-cases.ts";
import { expandCase, type SharedCase } from "./shared-recipes.ts";

it("keeps the shared Python and TypeScript cases current", () => {
  assert.equal(readFileSync(new URL("../../../conformance/cases.json", import.meta.url), "utf8"), sharedCases(),
    "Regenerate with node packages/terset/tests/generate-cases.ts");
});

it("keeps the shared fixture below 150 kB", () => {
  assert.ok(readFileSync(new URL("../../../conformance/cases.json", import.meta.url)).byteLength < 150_000);
});

it("round trips every shared case with exact bytes and own key order", () => {
  const cases = JSON.parse(readFileSync(new URL("../../../conformance/cases.json", import.meta.url), "utf8")) as SharedCase[];
  for (const entry of cases) {
    const { input, encoded } = expandCase(entry);
    assert.equal(encode(input), encoded, entry.name);
    assert.equal(JSON.stringify(decode(encoded)), JSON.stringify(input), entry.name);
    assert.equal(encode(decode(encoded)), encoded, entry.name);
    assert.equal(rulesFor(encoded), encoderRules(input), entry.name);
  }
});

it("reconstructs all three stress cases from shared recipes", () => {
  const cases = JSON.parse(readFileSync(new URL("../../../conformance/cases.json", import.meta.url), "utf8")) as SharedCase[];
  const recipes = cases.filter((entry) => "recipe" in entry);
  assert.equal(recipes.length, 3);
  for (const entry of recipes) {
    const expanded = expandCase(entry);
    assert.deepEqual(expanded.input, HARD_CASES.find(({ name }) => name === entry.name)?.value);
    assert.equal(encode(expanded.input), expanded.encoded);
    assert.deepEqual(decode(expanded.encoded), expanded.input);
  }
});

it("covers numeric-key boundaries, signed numbers and the equal-size fallback", () => {
  const cases = JSON.parse(readFileSync(new URL("../../../conformance/cases.json", import.meta.url), "utf8")) as SharedCase[];
  const names = ["array-index boundary keys", "integer-like table keys", "signed root numbers", "signed table numbers", "equal-size table fallback"];
  for (const name of names) {
    const entry = cases.find((entry) => entry.name === name);
    assert.ok(entry, `Missing shared case: ${name}`);
    const { input, encoded } = expandCase(entry);
    assert.equal(encode(input), encoded);
    assert.deepEqual(decode(encoded), input);
  }
  const tie = cases.find((entry) => entry.name === "equal-size table fallback");
  assert.ok(tie);
  const { input, encoded } = expandCase(tie);
  const candidate = "a\tb\tc\td\te\n1\t\t\t\t\n\t1\t\t\t\n\t\t1\t\t\n\t\t\t1\t\n\t\t\t\t1\n\t\t\t\t";
  assert.equal(Buffer.byteLength(candidate), Buffer.byteLength(JSON.stringify(input)));
  assert.equal(encoded, JSON.stringify(input));
});
