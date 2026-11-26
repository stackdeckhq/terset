---
name: terset
description: Read or write Terset, a terse table format for JSON records in LLM prompts. Use when a prompt holds lists of objects that share keys (users, orders, rows, logs) and tokens matter, when text has tab-separated header and row lines, or when someone mentions Terset or terset.dev. Not for config with no lists, tiny payloads, or model output.
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

## How to read it

A list starts with `key[N]:` and a keyed table with `key{N}:`, where `N` is the row count. A keyed table's first header is `@key`, and each row starts with its key. Each table has a tab-separated header and one row per record. When the header ends with `name=value`, each row lists its other fields after the columns as `name=value` cells, and a field a row does not list is absent. In older text, empty cells mean absent. Bare `id` means string ids; quoted `"id"` means typed cells. JSON quotes protect text that looks like a scalar. Uniform nested objects use dotted columns; other nested values stay JSON.

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
