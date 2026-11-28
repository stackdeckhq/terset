# Terset for agents

Use Terset for lists of records. {{BENCH}}

## How to get it

{{RELEASE}}.

{{INSTALL}}

```js
{{USAGE}}
```

Generate Terset with `encode`. {{FORMAT}}

## The rules

Send `rulesFor(text)` right before the data. For a shared system prompt, use the full `RULES` below.

```text
{{RULES}}
```

## How to read it

Tables start with `key[N]:` or `key{N}:`. `N` counts rows. Read `a/b: 1` as `{"a":{"b":1}}`. The encoder uses paths only when they take fewer bytes.

{{EXAMPLE:users}}

A root table starts with `[N]`:

{{EXAMPLE:rows}}

Ask for answers in JSON.

## Technique: short handles

Swap long IDs for short handles. Map answers back and reject unknown handles.

{{QUALITY}}

## Limits

- The root must be an object or an array.
- A numeric `-0` and nesting deeper than 500 levels are explicit errors.
