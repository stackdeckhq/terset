<p align="center">
  <img src="https://terset.dev/brand/terset-mark.svg" alt="Terset" width="64" height="64">
</p>

<h1 align="center">Terset</h1>

<p align="center">A compact text format for JSON records in LLM prompts. Same data, fewer input tokens.</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@stackdeck/terset" alt="npm version">
  <img src="https://img.shields.io/npm/l/@stackdeck/terset" alt="license MIT">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
  <img src="https://img.shields.io/node/v/@stackdeck/terset" alt="node 20 and up">
</p>

<p align="center"><a href="https://terset.dev">terset.dev</a> · <a href="https://terset.dev/docs">Docs</a> · <a href="https://terset.dev/#b2">Try it with your JSON</a></p>

Both packages write Terset 1.2 by default and still read formats 1.0 and 1.1.
To write an older format, pass `{ format: "1.1" }` or `{ format: "1.0" }`
in JavaScript. In Python, pass `format="1.1"` or `format="1.0"`.

<!-- docs:pitch -->
JSON repeats every key in every record, and a model reads each repeat as input tokens. Terset writes a list of records as one table instead. The keys go in a header once, and each record becomes a row. `decode` turns the text back into the same JSON.

- **Fewer tokens.** Over the 11 benchmark cases, Terset 1.2 used 26.4% fewer tokens than compact JSON and 6.0% fewer than TOON's best form, counted with the `o200k_base` tokenizer. The saved Claude Opus 5.5 counts for Terset 1.1 show 31.4% and 3.8% fewer tokens. [See the benchmark](#benchmark).
- **Lossless.** `decode` gives back the same JSON, key order included. The benchmark decodes every Terset output and checks it against its input before counting it.
- **Uneven records keep their table.** A record can skip a field or hold a list and still be one row.
- **Same text from JavaScript and Python.** Both packages pass the same format tests.
- **Zero dependencies.** Neither package installs anything else.
<!-- /docs:pitch -->

This repository holds the JavaScript and Python packages and the site.

<!-- docs:contents -->
**Contents**

- [See it](#see-it)
- [Install](#install)
- [Use it](#use-it)
- [Python](#python)
- [How it compares](#how-it-compares)
- [How it works](#how-it-works)
- [Benchmark](#benchmark)
- [When not to use it](#when-not-to-use-it)
- [FAQ](#faq)
- [Reference](#reference)
- [For agents](#for-agents)
- [What is here](#what-is-here)
- [Develop](#develop)
- [License](#license)
<!-- /docs:contents -->

## See it

<!-- docs:see-it -->
[Try it with your JSON](https://terset.dev/#b2)

The same data, as compact JSON and as Terset.

```json
{"team":"core","users":[{"id":"u1","name":"Ada","role":"admin","active":true,"logins":41},{"id":"u2","name":"Ben","role":"ops","active":true,"logins":7},{"id":"u3","name":"Chen","role":"ops","active":false,"logins":0},{"id":"u4","name":"Dara","active":true,"logins":12,"note":"on leave"}]}
```

```text
team: core
users[4]:
id	name	name=value
u1	Ada	role=admin	active=true	logins=41
u2	Ben	role=ops	active=true	logins=7
u3	Chen	role=ops	active=false	logins=0
u4	Dara	active=true	logins=12	note=on leave
```

The gaps between cells are real tab characters.

The fitted rules line for this text:

```text
Tables use tab-separated headers and rows. After the header columns, a row lists its other fields as name=value. A field a row does not list is absent. A leading bare id header marks string IDs.
```

Send the rules line once per prompt, right before the data. The data goes in the user message, before the question. The [benchmark page](https://terset.dev/benchmark#what-gets-sent) shows the full prompt.

Counts use the `o200k_base` tokenizer. The rules line and the data are counted together with a newline between them.

| Format | Bytes | Tokens |
| --- | --- | --- |
| Terset data alone | 199 | 70 |
| Terset data plus rules | 394 | 112 |
| Compact JSON | 289 | 99 |

Four records do not save enough tokens to pay for the rules line.

Repeat the same record shapes to make 10 users, each with a unique ID. With the rules included, Terset uses 35 fewer tokens.

| Format | Bytes | Tokens |
| --- | --- | --- |
| Terset data alone | 438 | 156 |
| Terset data plus rules | 633 | 198 |
| Compact JSON | 683 | 233 |
<!-- /docs:see-it -->

`decode` turns the Terset text back into the same object, key order included.

## Install

<!-- docs:install -->
```sh
pnpm add @stackdeck/terset
```

```sh
npm install @stackdeck/terset
```

```sh
yarn add @stackdeck/terset
```

```sh
bun add @stackdeck/terset
```

Zero dependencies. Node 20 and up. Types are included.
<!-- /docs:install -->

## Use it

<!-- docs:use -->
The API exports `encode`, `decode`, `RULES` and `rulesFor`.
`rulesFor(text)` gives only the rules sentences that text needs. `RULES` keeps the full rules.

Save this as `example.mjs`.

```js
import { rulesFor, decode, encode } from "@stackdeck/terset";

/** @type {import("@stackdeck/terset").JsonRoot} */
const data = {
  team: "core",
  users: [
    { id: "u1", name: "Ada", role: "admin" },
    { id: "u2", name: "Ben", role: "ops" },
    { id: "u3", name: "Chen" },
  ],
};

const text = encode(data);

// One text: send its fitted rules right before the data.
const messages = [
  { role: "system", content: "You read Terset data." },
  { role: "user", content: `Which users have no role?\n\n${rulesFor(text)}\n${text}` },
];

console.log(text);
console.log(JSON.stringify(decode(text)) === JSON.stringify(data)); // true
```

```sh
node example.mjs
```

Output (the gaps are tabs):

```text
team: core
users[3]:
id	name	name=value
u1	Ada	role=admin
u2	Ben	role=ops
u3	Chen
true
```

1. `encode(value)` turns a JSON object or array into Terset text.
2. Send `rulesFor(text)` right before the data. A shared or cached system prompt for many texts takes `RULES` instead.
3. `decode(text)` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.

Never write Terset by hand. Always use `encode`.

**JavaScript details**

- Terset ships as an ES module. In a CommonJS project, use `await import("@stackdeck/terset")` inside an async function.
- `decode` and `rulesFor` throw `SyntaxError` on any text they reject, and `TypeError` when the input is not a string.
- Values must be plain objects, arrays and JSON scalars. Class instances, symbol keys and sparse arrays throw `TypeError`.
- Numbers are JavaScript numbers. Numeric `-0`, `NaN` and infinities throw `TypeError`.
<!-- /docs:use -->

## Python

The same API for Python, with `rules_for` in snake case. Both packages write the same text.
See the [Python package README](./packages/terset-py/README.md).

<!-- docs:install-py -->
```sh
pip install terset
```

Zero dependencies. Python 3.10 and up. Type hints are included.
<!-- /docs:install-py -->

<!-- docs:use-py -->
The API exports `encode`, `decode`, `RULES` and `rules_for`.
`rules_for(text)` gives only the rules sentences that text needs. `RULES` keeps the full rules.

Save this as `example.py`.

```python
from terset import JsonRoot, decode, encode, rules_for

data: JsonRoot = {
    "team": "core",
    "users": [
        {"id": "u1", "name": "Ada", "role": "admin"},
        {"id": "u2", "name": "Ben", "role": "ops"},
        {"id": "u3", "name": "Chen"},
    ],
}

text = encode(data)

# One text: send its fitted rules right before the data.
messages = [
    {"role": "system", "content": "You read Terset data."},
    {"role": "user", "content": f"Which users have no role?\n\n{rules_for(text)}\n{text}"},
]

print(text)
print(decode(text) == data)  # True
```

```sh
python3 example.py
```

Output (the gaps are tabs):

```text
team: core
users[3]:
id	name	name=value
u1	Ada	role=admin
u2	Ben	role=ops
u3	Chen
True
```

1. `encode(value)` turns a JSON object or array into Terset text.
2. Send `rules_for(text)` right before the data. A shared or cached system prompt for many texts takes `RULES` instead.
3. `decode(text)` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.

Never write Terset by hand. Always use `encode`.

**Python details**

- `decode` and `rules_for` raise `ValueError` on any text they reject, and `TypeError` when the input is not a string.
- Numbers follow JavaScript, so `1.0` writes as `1`. Decoded whole numbers within `[-2**53, 2**53]` become `int`. Others become `float`.
- An `int` that a binary64 float cannot hold exactly, such as `9007199254740993`, raises `TypeError` instead of rounding.
- Numeric `-0`, `nan`, infinities, cycles and types other than `dict`, `list`, `str`, numbers, `bool` and `None` raise `TypeError`.
- Dictionary order is kept, with array-index keys such as `"2"` and `"10"` first, in numeric order, as in JavaScript.
- `encode` takes the read-only `JsonInputRoot` type. `decode` returns `JsonRoot`. The package ships `py.typed`.
<!-- /docs:use-py -->

## How it compares

<!-- docs:compare -->
- **Compact JSON** is the baseline here. Terset is smaller in 9 of 11 cases on o200k_base and 10 on Claude.
- **TOON** is another table format for prompts. Terset is smaller in 8 of 11 cases on o200k_base and 10 on Claude. TOON's best form is smaller in 3 on o200k_base and 1 on Claude, all listed in the benchmark below. When records skip a field or hold a list, TOON drops its table and writes one line per field. Terset keeps the table.
- **CSV** needs no rules line, so it is smaller than Terset in 3 of 11 cases on o200k_base and 5 on Claude. It has no types and cannot tell null, a missing field and empty text apart, so its text does not always read back to the same JSON. Nested values fit only as JSON inside a cell.
- **YAML and pretty JSON** are easy for people to read and cost the most in total here. Over all 11 cases on o200k_base, Terset is 38.9% smaller than YAML and 50.2% smaller than pretty JSON.
<!-- /docs:compare -->

## How it works

- **Lists become counted tables.** A list of two or more objects becomes a tab-separated header and one row per record. A named list starts with `name[N]:`. A root table starts with `[N]` on its own line.
- **Table size.** Compare a list table's header and rows with compact JSON in UTF-8 bytes, then add the count. A tie keeps JSON.
- **Maps can become keyed tables.** An object entry can use `name{N}:`. The first column, `@key`, holds each row's key. The complete named block must be shorter than the entry with compact JSON.
- **Missing fields are absent.** A field that only some rows have can appear as `name=value` after the columns. In format 1.0, an empty cell means absent. Empty text is `""`. Null is `null`.
- **Quotes keep types.** Text that looks like a number, boolean or null is JSON-quoted, so `"42"` stays text and `42` stays a number.
- **The `id` column.** A bare `id` header first in a list table marks string ids, so `007` stays `007`. An unflattened first `id` column in a list table that does not meet the string-id rules is written `"id"` and keeps typed cells. Uniform objects can expand into dotted columns. Keyed tables use ordinary typed cells for `id`.
- **Dotted columns.** When rows share the same ordered nested keys, those keys can become columns such as `address.city`. A literal dotted field name is quoted. Nested values left inside a row cell use compact JSON.
- **Path entries.** A slash separates nested keys. For example, `{"a":{"b":1}}` can become `a/b: 1`. The encoder uses path entries only when the full expansion takes fewer bytes.
- **Counts are checked.** The decoder rejects missing or extra rows. It reads the canonical text for formats 1.0, 1.1 and 1.2.
- **Where tables go.** Tables can appear at the root, under a field or under a path such as `a/b[3]:`. The encoder keeps key and column order.

Full rules: [SPEC.md](./packages/terset/SPEC.md).

## Benchmark

<!-- docs:bench-summary -->
Total tokens over all 11 cases. Lower is better. Terset counts include its fitted rules line. TOON best is the smaller of TOON's comma and tab forms.

| Format | o200k_base | Claude Opus 5.5 |
| --- | --- | --- |
| Terset | 43,297 | 59,047 |
| TOON best | 46,068 | 61,360 |
| Compact JSON | 58,808 | 86,102 |
| YAML | 70,846 | 88,145 |
| Pretty JSON | 87,020 | 113,574 |

- o200k_base: TOON's best is smaller than Terset on 3 cases: Translation batch; Deep nested config; and Reviews, long text. The 2 file-list cases hold 57% of Terset's total. Per case, the median saving is 21.5% against compact JSON and 6.9% against TOON's best.
- Claude: TOON's best is smaller than Terset on 1 case: Deep nested config. The 2 file-list cases hold 56% of Terset's total. Per case, the median saving is 27.9% against compact JSON and 3.5% against TOON's best.

The `o200k_base` tokenizer counts Terset 1.2. The saved Claude Opus 5.5 token counts use Terset 1.1. Open the section below for every case, the input cost and the method.
<!-- /docs:bench-summary -->

<details>
<summary>Every case, the input cost and the method</summary>

### o200k_base

| Case | Terset | Compact JSON | YAML | TOON best | Terset vs compact JSON |
|---|---|---|---|---|---|
| UI text, uneven rows | 547 | 697 | 812 | 814 | -21.5% |
| UI text, uniform rows | 480 | 737 | 910 | 518 | -34.9% |
| Translation batch | 1,139 | 1,448 | 1,674 | 1,110 | -21.3% |
| File list, short | 9,608 | 12,808 | 15,304 | 10,315 | -25.0% |
| File list, long | 15,042 | 19,969 | 23,966 | 15,502 | -24.7% |
| 200 users | 5,404 | 9,051 | 10,924 | 5,589 | -40.3% |
| Metrics, numbers and booleans | 2,940 | 4,798 | 5,999 | 3,181 | -38.7% |
| Deep nested config | 319 | 251 | 316 | 296 | +27.1% |
| Mixed-type array | 63 | 63 | 89 | 99 | 0.0% |
| Reviews, long text | 3,700 | 4,308 | 5,006 | 3,662 | -14.1% |
| Orders with line items | 4,055 | 4,678 | 5,846 | 4,982 | -13.3% |
| Total | 43,297 | 58,808 | 70,846 | 46,068 | -26.4% |

Terset, fitted rules line included, is under TOON's best in 8 of 11
cases and under compact JSON in 9 of 11.

Over all 11 cases, Terset totals 43,297 tokens: 26.4% fewer than compact
JSON (58,808), 50.2% fewer than pretty JSON (87,020), 38.9% fewer than
YAML (70,846), and 6.0% fewer than TOON's best (46,068).

### Claude Opus 5.5

| Case | Terset | Compact JSON | YAML | TOON best | Terset vs compact JSON |
|---|---|---|---|---|---|
| UI text, uneven rows | 831 | 1,083 | 1,062 | 1,065 | -23.3% |
| UI text, uniform rows | 745 | 1,253 | 1,160 | 774 | -40.5% |
| Translation batch | 1,813 | 2,514 | 2,413 | 1,833 | -27.9% |
| File list, short | 11,972 | 18,018 | 18,012 | 12,671 | -33.6% |
| File list, long | 21,259 | 30,405 | 31,199 | 22,019 | -30.1% |
| 200 users | 7,665 | 12,819 | 13,214 | 7,836 | -40.2% |
| Metrics, numbers and booleans | 3,310 | 6,535 | 6,960 | 3,467 | -49.3% |
| Deep nested config | 402 | 405 | 412 | 394 | -0.7% |
| Mixed-type array | 89 | 89 | 101 | 118 | 0.0% |
| Reviews, long text | 4,899 | 5,979 | 6,404 | 4,915 | -18.1% |
| Orders with line items | 6,062 | 7,002 | 7,208 | 6,268 | -13.4% |
| Total | 59,047 | 86,102 | 88,145 | 61,360 | -31.4% |

Terset, fitted rules line included, is under TOON's best in 10 of 11
cases and under compact JSON in 10 of 11.

Over all 11 cases, Terset totals 59,047 tokens: 31.4% fewer than compact
JSON (86,102), 48.0% fewer than pretty JSON (113,574), 33.0% fewer than
YAML (88,145), and 3.8% fewer than TOON's best (61,360).

### Input cost at list price

Input cost for 1,000 requests of each case, in US dollars. Input tokens
only, at the list price on the day it was read. It is not a bill.

Claude Opus 5.5 at $4 per million input tokens, on the Claude counts:

| Case | Terset | Compact JSON | Terset vs compact JSON |
|---|---|---|---|
| UI text, uneven rows | $3.32 | $4.33 | $1.01 less |
| UI text, uniform rows | $2.98 | $5.01 | $2.03 less |
| Translation batch | $7.25 | $10.06 | $2.81 less |
| File list, short | $47.89 | $72.07 | $24.18 less |
| File list, long | $85.04 | $121.62 | $36.58 less |
| 200 users | $30.66 | $51.28 | $20.62 less |
| Metrics, numbers and booleans | $13.24 | $26.14 | $12.90 less |
| Deep nested config | $1.61 | $1.62 | $0.01 less |
| Mixed-type array | $0.36 | $0.36 | the same |
| Reviews, long text | $19.60 | $23.92 | $4.32 less |
| Orders with line items | $24.25 | $28.01 | $3.76 less |
| Total | $236.19 | $344.41 | $108.22 less |

GPT 6.1 Sol at $2 per million input tokens, context up to 272K, on the
`o200k_base` counts:

| Case | Terset | Compact JSON | Terset vs compact JSON |
|---|---|---|---|
| UI text, uneven rows | $1.09 | $1.39 | $0.30 less |
| UI text, uniform rows | $0.96 | $1.47 | $0.51 less |
| Translation batch | $2.28 | $2.90 | $0.62 less |
| File list, short | $19.22 | $25.62 | $6.40 less |
| File list, long | $30.08 | $39.94 | $9.86 less |
| 200 users | $10.81 | $18.10 | $7.29 less |
| Metrics, numbers and booleans | $5.88 | $9.60 | $3.72 less |
| Deep nested config | $0.64 | $0.50 | $0.14 more |
| Mixed-type array | $0.13 | $0.13 | the same |
| Reviews, long text | $7.40 | $8.62 | $1.22 less |
| Orders with line items | $8.11 | $9.36 | $1.25 less |
| Total | $86.59 | $117.62 | $31.03 less |

How it was measured:

- The `o200k_base` counts use the `o200k_base` tokenizer and Terset 1.2, run locally.
- The Claude counts come from Anthropic's token count endpoint for `claude-opus-5-5`, run on 2026-11-19 UTC with Terset 1.1.
- Each text is sent as one user message. The same run also counts the one-letter text "a", which comes back as 9 tokens. Its 8 tokens of fixed message framing are taken off every count, assuming "a" itself is 1 token.
- Every Claude case was made from the same input as the o200k_base case of the same name. The build checks this by comparing the compact JSON counted locally with o200k_base.
- All 11 case inputs are made-up data in this repository: `apps/site/src/data/count-cases.json`, built by `pnpm cases` from seed 20261117. `pnpm numbers` recounts them with o200k_base.
- Every format gets the same input.
- Compact JSON is `JSON.stringify(value)`, with no spaces. It is the main baseline.
- Pretty JSON is `JSON.stringify(value, null, 2)`, with a 2-space indent.
- YAML is the `yaml` package, version 2.9.1, `stringify` with default options.
- TOON is the `@toon-format/toon` package, version 4.4.0, the smaller of its comma and tab forms for each case.
- Terset o200k_base counts include `rulesFor(text)`, fitted to each encoded text, once per prompt. The full `RULES` reference is 108 tokens. The Claude counts include `rulesFor(text)`, a newline and the data in one message.
- Each Terset output is decoded and compared with its input before it is counted.

How the cost was worked out:

- Cost is the input tokens of one request times the list price, shown per 1,000 requests of that case. It is input only: no output tokens, no caching and no discounts. It is not a bill.
- Claude Opus 5.5 is $4 per million input tokens ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)). It is applied to the Claude counts.
- GPT 6.1 Sol is $2 per million input tokens, context up to 272K ([pricing](https://developers.openai.com/api/docs/pricing)). It is applied to the `o200k_base` counts. Those are tokenizer counts, not counts reported for that model, so the GPT 6.1 Sol figure assumes that tokenizer.
- Both pricing pages were read on 2026-11-17.

Where Terset does not win:

- o200k_base: Compact JSON ties Terset on mixed-type array (63 vs 63). Compact JSON is smaller than Terset on deep nested config (251 vs 319).
- Claude: Compact JSON ties Terset on mixed-type array (89 vs 89).
- o200k_base: TOON's best is smaller than Terset in 3 of 11 cases: Translation batch (1,110 vs 1,139); Deep nested config (296 vs 319); Reviews, long text (3,662 vs 3,700).
- Claude: TOON's best is smaller than Terset in 1 of 11 cases: Deep nested config (394 vs 402).
- o200k_base: Plain CSV is 9 to 88 tokens smaller on 2 flat, uniform lists, because it needs no rules line. On orders with line items it is larger: 4,769 vs 4,055.
- Claude: Plain CSV is 23 to 38 tokens smaller on 4 flat, uniform lists, because it needs no rules line. On orders with line items it is larger: 6,490 vs 6,062.
- On every counter, plain CSV has no types, merges null, absent and empty text, and cannot hold nesting.

Across 1,000 seeds of the same 11 case shapes, counted with o200k_base, Terset wins, ties or loses against compact JSON and TOON the same way on every seed.

Token counts say nothing about answer quality. Terset is about fewer tokens.
Other tokenizers and models will give other counts. Full benchmark with pretty JSON and CSV counts:
[terset.dev/benchmark](https://terset.dev/benchmark).

</details>

### Answer accuracy

On 244 questions and two models, Terset 1.1 used fewer input tokens than compact JSON. The 95% accuracy ranges of all four formats overlap on both models.

#### Claude Opus 5.5

| Format | Correct | Accuracy | 95% interval | Input tokens | Cost | Terset costs less by |
| --- | --- | --- | --- | --- | --- | --- |
| Terset | 242 of 244 | 99.2% | 97.1% to 99.8% | 1,220,011 | $5.75 | - |
| Compact JSON | 241 of 244 | 98.8% | 96.4% to 99.6% | 1,796,661 | $8.16 | 29.6% |
| Pretty JSON | 241 of 244 | 98.8% | 96.4% to 99.6% | 2,334,345 | $10.30 | 44.2% |
| TOON | 242 of 244 | 99.2% | 97.1% to 99.8% | 1,400,264 | $6.46 | 11.0% |

#### GPT 6.1 Sol

| Format | Correct | Accuracy | 95% interval | Input tokens | Cost | Terset costs less by |
| --- | --- | --- | --- | --- | --- | --- |
| Terset | 243 of 244 | 99.6% | 97.7% to 99.9% | 843,325 | $1.84 | - |
| Compact JSON | 237 of 244 | 97.1% | 94.2% to 98.6% | 1,158,229 | $2.50 | 26.4% |
| Pretty JSON | 238 of 244 | 97.5% | 94.7% to 98.9% | 1,696,152 | $3.56 | 48.4% |
| TOON | 238 of 244 | 97.5% | 94.7% to 98.9% | 1,020,628 | $2.19 | 16.1% |

Pretty JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.

Each model ran once, with every format, on 2026-11-19. Each table shows that one run.

The 95% accuracy ranges of all four formats overlap on both models. That does not prove the formats are equally accurate.
Against compact JSON, Terset cost 29.6% less on Claude Opus 5.5 and 26.4% less on GPT 6.1 Sol.

Cost is at API list price: input and output tokens times list prices read on 2026-11-17. Input tokens are as each model reported them. Temperature 0 where the model accepts it. These runs used Terset 1.1 with fitted rules for each text.

Method and limits: [terset.dev/benchmark](https://terset.dev/benchmark#accuracy). Every answer and its score: [2026-11-19](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-19).

### Stress accuracy

Each model answered 120 harder questions in four groups, sent in each of four formats. Each model ran once, on 2026-11-19. Each cell is that one run. These runs used Terset 1.1.

| Format | Claude Opus 5.5 | GPT 6.1 Sol | Claude Haiku 5.5 |
| --- | --- | --- | --- |
| Terset | 119 of 120 | 118 of 120 | 113 of 120 |
| Compact JSON | 117 of 120 | 100 of 120 | 111 of 120 |
| Pretty JSON | 117 of 120 | 113 of 120 | 113 of 120 |
| TOON | 120 of 120 | 118 of 120 | 113 of 120 |

Of Terset's 10 misses across the three models, 9 were on long lists. On Claude Haiku 5.5 it got 24 of 30 long-list questions, where pretty JSON got 27. Its one other miss was a field count on sparse records, on Claude Haiku 5.5. Results by group, every loss and the method: [terset.dev/benchmark](https://terset.dev/benchmark#stress). Every answer and its score: [Claude Opus 5.5](https://github.com/stackdeckhq/terset/blob/main/bench/published/2026-11-19/stress-opus-2026-11-19.md), [GPT 6.1 Sol](https://github.com/stackdeckhq/terset/blob/main/bench/published/2026-11-19/stress-sol-2026-11-19.md) and [Claude Haiku 5.5](https://github.com/stackdeckhq/terset/blob/main/bench/published/2026-11-19/stress-haiku-2026-11-19.md).

## When not to use it

<!-- docs:when-not -->
- **No lists of records.** Path entries can save bytes and still cost more tokens. Compact JSON uses fewer tokens on the config example once Terset includes its rules line.
- **One-row lists.** A list needs two or more objects to become a table.
- **Mixed arrays.** A list with any item that is not an object stays JSON.
- **Lists inside rows.** A list inside a table row stays JSON in its cell. A list under an object path can have its own table.
- **Hard limits.** The root must be an object or an array. Numeric `-0` and nesting deeper than 500 levels are explicit errors.
- **Writing back.** Terset is for the model to read. Ask for answers in JSON.
<!-- /docs:when-not -->

## FAQ

<!-- docs:faq -->
**Is it stable?** Format 1.0 is frozen. Formats 1.0 and 1.1 still decode. The encoder writes format 1.2. The packages are at 0.x, so their API can still change.

**Does it change answer accuracy?** Each model answered the same 244 questions in each format. The runs used Terset 1.1. The 95% accuracy ranges of all four formats overlap on both models. That does not prove the formats are equally accurate. See [Answer accuracy](#answer-accuracy).

**Do I have to explain the format to the model?** Yes, once per prompt. Send `rulesFor(text)` (`rules_for` in Python) right before the data. It holds only the rules that text needs, and it is empty when the text needs none. For one cached system prompt that serves many texts, send the full `RULES` there instead.

**Where does the name come from?** TERse SETs: a set of records, written tersely.
<!-- /docs:faq -->

## Reference

<!-- docs:reference -->
Every function, parameter, error and limit, for JavaScript and Python: [terset.dev/docs](https://terset.dev/docs).

The encoder writes format version 1.2 by default. Text written in format 1.0 still decodes. Format 1.1 text also decodes. Write 1.1 with `encode(value, { format: "1.1" })` in JavaScript or `encode(value, format="1.1")` in Python. Use `"1.0"` for 1.0 text.
<!-- /docs:reference -->

<!-- docs:implementations -->
| Language | Package | Install | Conformance |
| --- | --- | --- | --- |
| JavaScript | [@stackdeck/terset](https://www.npmjs.com/package/@stackdeck/terset) | `pnpm add @stackdeck/terset` | Passes the 1.0, 1.1, and 1.2 suites |
| Python | [terset](https://pypi.org/project/terset/) | `pip install terset` | Passes the 1.0, 1.1, and 1.2 suites |

Both packages run the shared test suites at [conformance/](https://github.com/stackdeckhq/terset/tree/main/conformance) for 1.0, [conformance/1.1/](https://github.com/stackdeckhq/terset/tree/main/conformance/1.1) for 1.1, and [conformance/1.2/](https://github.com/stackdeckhq/terset/tree/main/conformance/1.2) for 1.2.
<!-- /docs:implementations -->

## For agents

<!-- docs:agents -->
Plain files an agent can read:

- [terset.dev/llms.txt](https://terset.dev/llms.txt): the index.
- [terset.dev/agents.md](https://terset.dev/agents.md): everything an agent needs in one read.
- [terset.dev/docs.md](https://terset.dev/docs.md): this reference as one plain file.
- [terset.dev/spec.md](https://terset.dev/spec.md): every rule of the format.
- [terset.dev/benchmark.md](https://terset.dev/benchmark.md): every count, the method and the limits.
- [terset.dev/skill/SKILL.md](https://terset.dev/skill/SKILL.md): a skill file an agent harness can load.
- [terset.dev/llms-full.txt](https://terset.dev/llms-full.txt): the guide, the reference, the spec and the benchmark in one file.
<!-- /docs:agents -->

## What is here

- [`packages/terset`](./packages/terset): the JavaScript and TypeScript package. Zero dependencies.
- [`packages/terset-py`](./packages/terset-py): the Python package. Zero dependencies.
- [`apps/site`](./apps/site): the site at terset.dev, with the docs, the benchmark and the agent files.

## Develop

Node 24 and pnpm 10.

```sh
pnpm install
pnpm gate
```

`pnpm gate` runs the type check, lint, tests, the build and a deploy dry run.
The package alone runs with `node --test tests/*.test.ts` from
`packages/terset`.

## License

MIT, copyright (c) 2026 TrueWear, LLC. See [LICENSE](./LICENSE).
