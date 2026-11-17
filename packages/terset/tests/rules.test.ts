import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { decode, RULES, rulesFor } from "../src/index.ts";
import { encoderRules } from "./rules-truth.ts";

it("fits the shared construct combinations and ignores quoted and cell lookalikes", () => {
  const cases = JSON.parse(readFileSync(new URL("./rules-cases.json", import.meta.url), "utf8")) as { name: string; text: string; rules: string }[];
  for (const entry of cases) {
    assert.equal(encoderRules(decode(entry.text)), entry.rules, `${entry.name}: source oracle`);
    assert.equal(rulesFor(entry.text), entry.rules, entry.name);
  }
  assert.equal(cases.at(-1)?.rules, RULES);
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
