# Terset for agents

Terset writes JSON records as one terse table. Decoding gives the same JSON back.

## When to use it

- Use it for a root object or array holding lists of records.
- {{BENCH}}
- CSV notes and every count: https://terset.dev/benchmark.md

## How to get it

{{RELEASE}}. JavaScript requires Node 20 or later. Python requires Python 3.10 or later.

{{INSTALL}}

```js
{{USAGE}}
```

Never write Terset by hand. Always use `encode`.

## The rules

For one text, send `rulesFor(text)` right before the data. It gives only the sentences that text needs.
A shared or cached system prompt for many texts takes the full rules below.

```text
{{RULES}}
```

## How to read it

A root field is `key: value`. Tables start with `key[N]:`, or `key{N}:` when keyed; `N` counts rows. Fields every row has are columns. The rest follow as `name=value` in the rows that have them.

{{EXAMPLE:users}}

A root table starts with `[N]`:

{{EXAMPLE:rows}}

## Ask for JSON back

Terset is for reading. Ask for answers in JSON.

## Technique: short handles

Outside the package, your code can swap long ids for 1, 2, 3 before the prompt, map answers back and reject unknown handles.

{{QUALITY}}

## Limits

- The root must be an object or an array.
- A numeric `-0` and nesting deeper than 500 levels are explicit errors.
- Terset saves tokens. It claims no gain in answer quality.
