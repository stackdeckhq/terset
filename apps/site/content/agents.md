# Terset for agents

Terset writes JSON records as one terse table. Decoding gives the same JSON back.

## When to use it

- Use it for a root object or array that holds lists of records sharing keys.
- {{BENCH}}
- CSV notes and every count: https://terset.dev/benchmark.md

## How to get it

{{RELEASE}}. Node 20 or later.

{{INSTALL}}

```js
{{USAGE}}
```

Never write Terset by hand. Always use `encode`.

## The rules sentence

Put it in the system prompt once. The data carries no legend.
`rulesFor(text)` gives the shortest valid one.

```text
{{RULES}}
```

## How to read it

A root field is `key: value`. Tables start with `key[N]:`, or `key{N}:` when keyed; `N` counts rows. Keyed rows start with their key, under an `@key` header. Uniform nested objects use dotted columns like `ship.city`. Bare `id` means string ids; quoted `"id"` means typed cells. Scalar-like text is JSON-quoted.

{{EXAMPLE:users}}

A root table starts with `[N]`:

{{EXAMPLE:rows}}

## Ask for JSON back

Terset is for reading. Ask the model to answer in JSON.

## Technique: short handles

Your code can swap long ids for 1, 2, 3 before the prompt, then map answers back. Reject unknown handles. This technique is outside the package.

{{QUALITY}}

## Limits

- The root must be an object or an array.
- A numeric `-0` and nesting deeper than 500 levels are explicit errors.
- Lists inside a record stay JSON in their cell.
- Terset saves tokens. It claims no gain in answer quality.
