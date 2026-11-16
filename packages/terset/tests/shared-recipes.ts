import type { JsonRoot, JsonValue } from "../src/index.ts";

export type SharedRecipe =
  | { kind: "repeat-text"; text: string; count: number }
  | { kind: "rows"; count: number; prefix: string; suffix: string }
  | { kind: "depth"; depth: number; leaf: string };

export type SharedCase =
  | { name: string; input: JsonRoot; encoded: string }
  | { name: string; recipe: SharedRecipe };

/** Expand input and expected text independently of encode. */
export function expandCase(entry: SharedCase): { input: JsonRoot; encoded: string } {
  if (!("recipe" in entry)) return entry;
  const recipe = entry.recipe;
  switch (recipe.kind) {
    case "repeat-text": {
      const text = recipe.text.repeat(recipe.count);
      const items = [{ id: "1", name: text, summary: text }];
      return { input: { items, text }, encoded: `items: ${JSON.stringify(items)}\ntext: ${text}` };
    }
    case "rows": {
      const rows = Array.from({ length: recipe.count }, (_, index) => ({ id: String(index + 1), name: `${recipe.prefix}${index}${recipe.suffix}` }));
      return { input: { items: rows }, encoded: `items[${recipe.count}]:\nid\tname\n${rows.map(({ id, name }) => `${id}\t${name}`).join("\n")}` };
    }
    case "depth": {
      let value: JsonValue = recipe.leaf;
      for (let index = 0; index < recipe.depth; index++) value = { next: value };
      return { input: { nested: value }, encoded: `nested: ${'{"next":'.repeat(recipe.depth)}${JSON.stringify(recipe.leaf)}${"}".repeat(recipe.depth)}` };
    }
  }
}
