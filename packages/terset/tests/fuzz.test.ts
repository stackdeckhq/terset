import assert from "node:assert/strict";
import { it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decode, encode, rulesFor, type JsonRoot, type JsonValue } from "../src/index.ts";
import { HARD_STRINGS } from "./hard-cases.ts";
import { encoderRules, SENTENCES } from "./rules-truth.ts";

const SEED = 20261112;
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STRINGS = [...HARD_STRINGS, " ", "1e3", '"x"', "[1]", "{x}", "x\\n", "trail "];
const KEYS = ["id", "name", "a", "b", "c", "__proto__", "constructor", "1", "02", "", "a: b", "a/b", "a.b", "x\ty", '"key"', "ñ"];

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function scalar(random: () => number): JsonValue {
  const roll = random();
  if (roll < 0.55) return pick(random, STRINGS);
  if (roll < 0.8) return pick(random, [0, 1, 2024, -7, 1e21, 1e-7, 5e-324, Number.MAX_VALUE]);
  return roll < 0.9 ? random() < 0.5 : null;
}

function value(random: () => number, depth: number): JsonValue {
  if (!depth || random() < 0.5) return scalar(random);
  if (random() < 0.5) return Array.from({ length: Math.floor(random() * 5) }, () => value(random, depth - 1));
  return Object.fromEntries(Array.from({ length: Math.floor(random() * 5) }, () => [pick(random, KEYS), value(random, depth - 1)]));
}

function rows(random: () => number): JsonValue[] {
  const first = pick(random, ["id", "name", "host", "long_field", "", "__proto__"]);
  const fields = [...new Set([first, ...Array.from({ length: Math.floor(random() * 6) }, () => pick(random, KEYS))])];
  return Array.from({ length: 1 + Math.floor(random() * 8) }, (_, index) => {
    if (random() < 0.08) return value(random, 2);
    let order = fields.filter(() => random() < 0.85);
    if (random() < 0.12) order = order.reverse();
    return Object.fromEntries(order.map((field) => [field, field === "id" ? (random() < 0.45 ? String(index + 1) : scalar(random)) : value(random, 2)]));
  });
}

it("round-trips 30,000 seeded JSON object and array roots weighted toward general tables", () => {
  const random = randomFrom(SEED);
  let tables = 0;
  let paths = 0;
  const texts: string[] = [];
  const fitted: string[] = [];
  for (let index = 0; index < 30_000; index++) {
    const input: JsonRoot = index % 7 === 0 ? {
      a: { "b/c": { d: rows(random) } },
      t: { r: Array.from({ length: 40 + index % 10 }, (_, v) => ({ v })) },
    }
      : random() < 0.45 ? rows(random)
      : Object.fromEntries(Array.from({ length: 1 + Math.floor(random() * 5) }, () => [pick(random, KEYS), random() < 0.75 ? rows(random) : value(random, 4)]));
    try {
      const text = encode(input);
      const v11 = encode(input, { format: "1.1" });
      const rules11 = rulesFor(v11);
      assert.equal(rules11, encoderRules(input));
      const rules = rulesFor(text);
      texts.push(text);
      fitted.push(rules);
      if (rules.includes(SENTENCES.path)) paths++;
      if (text !== v11) assert.ok(Buffer.byteLength(v11) - Buffer.byteLength(text) >= 256);
      if (Array.isArray(input) ? /^\[\d+\]\n/.test(text) : text.includes(":\n")) tables++;
      assert.deepEqual(decode(text), input);
      assert.equal(JSON.stringify(decode(text)), JSON.stringify(input));
      assert.deepEqual(decode(Buffer.from(text, "utf8").toString("utf8")), input);
      assert.equal(encode(input), text);
      assert.equal(JSON.stringify(decode(v11)), JSON.stringify(input));
      const legacy = encode(input, { format: "1.0" });
      assert.equal(rulesFor(legacy), encoderRules(input, "1.0"));
      assert.equal(JSON.stringify(decode(legacy)), JSON.stringify(input));
    } catch (error) {
      throw new Error(`seed ${SEED}, case ${index}, input ${JSON.stringify(input)}`, { cause: error });
    }
  }
  assert.ok(tables > 5000, `seed ${SEED}: only ${tables} tables`);
  assert.ok(paths > 3000, `seed ${SEED}: only ${paths} path documents`);
  const python = spawnSync("python3", ["-B", fileURLToPath(new URL("../../terset-py/tests/rules_parity.py", import.meta.url))], {
    input: JSON.stringify(texts), encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
  });
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), fitted);
});
