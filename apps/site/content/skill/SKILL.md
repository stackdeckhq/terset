---
name: terset
description: Read or write Terset, a compact format for JSON records in LLM prompts. Use when a prompt holds lists of records and tokens matter, when Terset text has table rows or slash-separated keys, or when someone mentions Terset or terset.dev.
---

# Terset

Terset writes a set of JSON records as one terse table. A model reads the same data with fewer tokens. Decoding gives the same JSON back.

This is a skill file. Any agent harness that loads skill files can use it.

## Install

{{RELEASE}}. JavaScript requires Node 20 or later. Python requires Python 3.10 or later.

{{INSTALL}}

## Encode

The package exports `encode`, `decode`, `RULES` and `rulesFor`.
`rulesFor(text)` gives only the rules sentences that text needs.

```js
{{USAGE}}
```

Never write Terset by hand. Always use `encode`. For one text, send `rulesFor(text)` right before the data. A shared or cached system prompt for many texts takes the full rules:

```text
{{RULES}}
```

{{FORMAT}}

## How to read it

A list starts with `key[N]:` and a keyed table with `key{N}:`. `N` counts rows. Keyed tables start with `@key`, and each row starts with its key. Fields that only some rows have can follow the columns as `name=value`. In older text, empty cells mean absent. Bare `id` means string IDs. Quoted `"id"` keeps typed cells. Uniform nested fields in rows can use dotted columns. Read `a/b: 1` as `{"a":{"b":1}}`. The encoder uses path entries only when they take fewer bytes.

{{EXAMPLE:users}}

## Answers

Ask the model to answer in JSON, not Terset.

## Short handles

When ids are long, your code can swap them for 1, 2, 3 before the prompt and map them back after. Flag any handle the input never had. This is a technique, not a package feature. It helped JSON as much as Terset in one small measured task.

## Limits

- The root must be an object or an array.
- A numeric `-0` and nesting deeper than 500 levels are explicit errors.
- Lists nested inside a record stay JSON inside their cell.
- Compact JSON can be smaller for config with no lists and for tiny data.

Full guide: https://terset.dev/agents.md
