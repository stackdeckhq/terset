import type { JsonObject, JsonRoot, JsonValue } from "../src/index.ts";

/** Stable inputs covering keyed maps, nested columns and literal dotted keys. */
export function seededCases(): JsonRoot[] {
  let state = 0x5eed1234;
  function random(max: number): number {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 0x100000000) * max);
  }
  const keys = ["id", "name", "a", "b", "address", "a.b", "@key", "constructor", "__proto__", "", "0", "2", "odd key", "é"];
  const texts = ["Ada", "", "007", "true", "two words", "name[2]:", "name{2}:", "a:", " edge ", "\ud800", "😀", "\t", "\n"];
  function value(depth: number): JsonValue {
    switch (random(depth > 3 ? 4 : 6)) {
      case 0: return null;
      case 1: return random(2) === 1;
      case 2: return random(2001) - 1000;
      case 3: return texts[random(texts.length)]!;
      case 4: return Array.from({ length: random(5) }, () => value(depth + 1));
      default: return Object.fromEntries(Array.from({ length: random(6) }, () => [keys[random(keys.length)]!, value(depth + 1)]));
    }
  }
  return Array.from({ length: 2500 }, (_, index) => {
    if (index % 3 === 0) {
      const template: JsonObject = Object.fromEntries(Array.from({ length: 1 + random(5) }, () => [keys[random(keys.length)]!, value(0)]));
      const rows = Array.from({ length: 2 + random(5) }, () => Object.fromEntries(Object.entries(template)
        .filter(() => random(5) > 0).map(([key, entry]) => [key, random(4) === 0 ? value(0) : entry])));
      return index % 2 === 0 ? rows : { rows: Object.fromEntries(rows.map((row, i) => [texts[i] ?? String(i), row])) };
    }
    const generated = value(0);
    return generated !== null && typeof generated === "object" ? generated : { value: generated };
  });
}
