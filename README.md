<p align="center">
  <img src="https://terset.dev/brand/terset-mark.svg" alt="Terset" width="64" height="64">
</p>

<h1 align="center">Terset</h1>

<p align="center">Terset: TERse SETs. It writes a set of records as one terse table, so a model reads the same data with fewer tokens.</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@stackdeck/terset" alt="npm version">
  <img src="https://img.shields.io/npm/l/@stackdeck/terset" alt="license MIT">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
  <img src="https://img.shields.io/node/v/@stackdeck/terset" alt="node 20 and up">
</p>

<p align="center"><a href="https://terset.dev">terset.dev</a> · <a href="https://terset.dev/docs">Docs</a></p>

This repository holds the JavaScript and Python packages and the site.

Terset is an early project. It was first published in November 2026. The format is frozen at 1.0.

<!-- docs:contents -->
**Contents**

- [See it](#see-it)
- [Install](#install)
- [Use it](#use-it)
- [Python](#python)
- [How it works](#how-it-works)
- [Benchmark](#benchmark)
- [When not to use it](#when-not-to-use-it)
- [Reference](#reference)
- [For agents](#for-agents)
- [What is here](#what-is-here)
- [Develop](#develop)
- [License](#license)
<!-- /docs:contents -->

## See it

The same data, as compact JSON and as Terset.

```json
{"team":"core","users":[{"id":"u1","name":"Ada","role":"admin","active":true,"logins":41},{"id":"u2","name":"Ben","role":"ops","active":true,"logins":7},{"id":"u3","name":"Chen","role":"ops","active":false,"logins":0},{"id":"u4","name":"Dara","active":true,"logins":12,"note":"on leave"}]}
```

```text
team: core
users[4]:
id	name	role	active	logins	note
u1	Ada	admin	true	41	
u2	Ben	ops	true	7	
u3	Chen	ops	false	0	
u4	Dara		true	12	on leave
```

The gaps between cells are real tab characters.

| | Bytes | Tokens |
|---|---|---|
| Terset | 140 | 56 |
| Compact JSON | 289 | 99 |

Tokens are counted with the `o200k_base` tokenizer, for the data alone.
Terset also needs the fitted rules line once per prompt. Across many records that
cost is paid once.

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

```js
import { rulesFor, decode, encode } from "@stackdeck/terset";

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

Output (the gaps are tabs):

```text
team: core
users[3]:
id	name	role
u1	Ada	admin
u2	Ben	ops
u3	Chen	
true
```

1. `encode(value)` turns a JSON object or array into Terset text.
2. Send `rulesFor(text)` right before the data. A shared or cached system prompt for many texts takes `RULES` instead.
3. `decode(text)` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.

Never write Terset by hand. Always use `encode`.

**JavaScript details**

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

```python
from terset import decode, encode, rules_for

data = {
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

Output (the gaps are tabs):

```text
team: core
users[3]:
id	name	role
u1	Ada	admin
u2	Ben	ops
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

## How it works

- **Lists become counted tables.** A list of two or more objects becomes a tab-separated header and one row per record. A named list starts with `name[N]:`. A root table starts with `[N]` on its own line.
- **Only when smaller.** Compare the list table's header and rows with compact JSON in UTF-8 bytes, then add its count. A tie keeps JSON.
- **Maps can become keyed tables.** A direct root field with object entries can use `name{N}:`. The first column, `@key`, holds each entry's key. It is not a field. The complete named block must be strictly shorter than `name: JSON`.
- **Empty cells mean absent.** Empty text is `""`. Null is `null`.
- **Quotes keep types.** Text that looks like a number, boolean or null is JSON-quoted, so `"42"` stays text and `42` stays a number.
- **The `id` column.** A bare `id` header first in a list table marks string ids, so `007` stays `007`. An unflattened first `id` column in a list table that does not meet the string-id rules is written `"id"` and keeps typed cells. Uniform objects can expand into dotted columns. Keyed tables use ordinary typed cells for `id`.
- **Uniform nested objects become columns.** When every row has the same ordered nested keys, simple keys without dots expand recursively, up to 8 levels, into headers such as `address.city`. A literal dotted field name is quoted. Other nested values stay compact JSON.
- **Counts are checked.** The decoder rejects missing or extra rows. It accepts only the current canonical format.
- **Tables only at the top.** Tables are chosen for a root array or the direct fields of a root object. No sorting and no column reordering.

Full rules: [SPEC.md](./packages/terset/SPEC.md).

## Benchmark

Token counts for the same input in each format. Lower is better.
There are two counters: the `o200k_base` tokenizer, and Claude's own count
for Claude Opus 5.5. They give different numbers for the same text.

### o200k_base

| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |
|---|---|---|---|---|---|
| UI text, uneven rows | 519 | 697 | 812 | 814 | -25.5% |
| UI text, uniform rows | 480 | 737 | 910 | 518 | -34.9% |
| Translation batch | 1,139 | 1,448 | 1,674 | 1,110 | -21.3% |
| File list, short | 9,608 | 12,808 | 15,304 | 10,315 | -25.0% |
| File list, long | 15,042 | 19,969 | 23,966 | 15,502 | -24.7% |
| 200 users | 5,404 | 9,051 | 10,924 | 5,589 | -40.3% |
| Metrics, numbers and booleans | 2,940 | 4,798 | 5,999 | 3,181 | -38.7% |
| Deep nested config | 250 | 251 | 316 | 296 | -0.4% |
| Mixed-type array | 63 | 63 | 89 | 99 | 0.0% |
| Reviews, long text | 3,700 | 4,308 | 5,006 | 3,662 | -14.1% |
| Orders with line items | 3,899 | 4,678 | 5,846 | 4,982 | -16.7% |
| Total | 43,044 | 58,808 | 70,846 | 46,068 | -26.8% |

Terset, fitted rules line included, is under TOON's best in 9 of 11
cases and under compact JSON in 10 of 11.

Over all 11 cases, Terset totals 43,044 tokens: 26.8% fewer than JSON
compact (58,808), 50.5% fewer than JSON pretty (87,020), 39.2% fewer than
YAML (70,846), and 6.6% fewer than TOON's best (46,068).

### Claude Opus 5.5

| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |
|---|---|---|---|---|---|
| UI text, uneven rows | 766 | 1,083 | 1,062 | 1,065 | -29.3% |
| UI text, uniform rows | 745 | 1,253 | 1,160 | 774 | -40.5% |
| Translation batch | 1,813 | 2,514 | 2,413 | 1,833 | -27.9% |
| File list, short | 11,972 | 18,018 | 18,012 | 12,671 | -33.6% |
| File list, long | 21,259 | 30,405 | 31,199 | 22,019 | -30.1% |
| 200 users | 7,665 | 12,819 | 13,214 | 7,836 | -40.2% |
| Metrics, numbers and booleans | 3,310 | 6,535 | 6,960 | 3,467 | -49.3% |
| Deep nested config | 402 | 405 | 412 | 394 | -0.7% |
| Mixed-type array | 89 | 89 | 101 | 118 | 0.0% |
| Reviews, long text | 4,899 | 5,979 | 6,404 | 4,915 | -18.1% |
| Orders with line items | 5,662 | 7,002 | 7,208 | 6,268 | -19.1% |
| Total | 58,582 | 86,102 | 88,145 | 61,360 | -32.0% |

Terset, fitted rules line included, is under TOON's best in 10 of 11
cases and under compact JSON in 10 of 11.

Over all 11 cases, Terset totals 58,582 tokens: 32.0% fewer than JSON
compact (86,102), 48.4% fewer than JSON pretty (113,574), 33.5% fewer than
YAML (88,145), and 4.5% fewer than TOON's best (61,360).

### Input cost at list price

Input cost for 1,000 requests of each case, in US dollars. Input tokens
only, at the list price on the day it was read. It is not a bill.

Claude Opus 5.5 at $4 per million input tokens, on the Claude counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $3.06 | $4.33 | -$1.27 |
| UI text, uniform rows | $2.98 | $5.01 | -$2.03 |
| Translation batch | $7.25 | $10.06 | -$2.81 |
| File list, short | $47.89 | $72.07 | -$24.18 |
| File list, long | $85.04 | $121.62 | -$36.58 |
| 200 users | $30.66 | $51.28 | -$20.62 |
| Metrics, numbers and booleans | $13.24 | $26.14 | -$12.90 |
| Deep nested config | $1.61 | $1.62 | -$0.01 |
| Mixed-type array | $0.36 | $0.36 | $0.00 |
| Reviews, long text | $19.60 | $23.92 | -$4.32 |
| Orders with line items | $22.65 | $28.01 | -$5.36 |
| Total | $234.33 | $344.41 | -$110.08 |

GPT 6.1 Sol at $2 per million input tokens, context up to 272K, on the
`o200k_base` counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $1.04 | $1.39 | -$0.35 |
| UI text, uniform rows | $0.96 | $1.47 | -$0.51 |
| Translation batch | $2.28 | $2.90 | -$0.62 |
| File list, short | $19.22 | $25.62 | -$6.40 |
| File list, long | $30.08 | $39.94 | -$9.86 |
| 200 users | $10.81 | $18.10 | -$7.29 |
| Metrics, numbers and booleans | $5.88 | $9.60 | -$3.72 |
| Deep nested config | $0.50 | $0.50 | $0.00 |
| Mixed-type array | $0.13 | $0.13 | $0.00 |
| Reviews, long text | $7.40 | $8.62 | -$1.22 |
| Orders with line items | $7.80 | $9.36 | -$1.56 |
| Total | $86.09 | $117.62 | -$31.53 |

How it was measured:

- The `o200k_base` counts use the `o200k_base` tokenizer, run locally.
- The Claude counts come from Anthropic's token count endpoint for `claude-opus-5-5`, run on 2026-11-17 UTC.
- Each text is sent as one user message. The same run also counts the one-letter text "a", which comes back as 9 tokens. Its 8 tokens of fixed message framing are taken off every count, assuming "a" itself is 1 token.
- Every Claude case was made from the same input as the o200k_base case of the same name. The build checks this by comparing the compact JSON counted locally with o200k_base.
- All 11 case inputs are made-up data in this repository: `apps/site/src/data/count-cases.json`, built by `pnpm cases` from seed 20261117. `pnpm numbers` recounts them with o200k_base.
- Every format gets the same input.
- JSON compact is `JSON.stringify(value)`, with no spaces. It is the main baseline.
- JSON pretty is `JSON.stringify(value, null, 2)`, with a 2-space indent.
- YAML is the `yaml` package, version 2.9.1, `stringify` with default options.
- TOON is the `@toon-format/toon` package, version 4.4.0, the smaller of its comma and tab forms for each case.
- Terset o200k_base counts include `rulesFor(text)`, fitted to each encoded text, once per prompt. The full `RULES` reference is 73 tokens. The Claude counts include `rulesFor(text)`, a newline and the data in one message.
- Each Terset output is decoded and compared with its input before it is counted.

How the cost was worked out:

- Cost is the input tokens of one request times the list price, shown per 1,000 requests of that case. It is input only: no output tokens, no caching and no discounts. It is not a bill.
- Claude Opus 5.5 is $4 per million input tokens ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)). It is applied to the Claude counts.
- GPT 6.1 Sol is $2 per million input tokens, context up to 272K ([pricing](https://developers.openai.com/api/docs/pricing)). It is applied to the `o200k_base` counts. Those are tokenizer counts, not counts reported for that model, so the GPT 6.1 Sol figure assumes that tokenizer.
- Both pricing pages were read on 2026-11-12.

Where Terset does not win:

- o200k_base: Compact JSON is smaller than or equal to Terset on mixed-type array (63 vs 63).
- Claude: Compact JSON is smaller than or equal to Terset on mixed-type array (89 vs 89).
- o200k_base: TOON's best is smaller than or equal to Terset in 2 of 11 cases: Translation batch (1,110 vs 1,139); Reviews, long text (3,662 vs 3,700).
- Claude: TOON's best is smaller than or equal to Terset in 1 of 11 cases: Deep nested config (394 vs 402).
- o200k_base: Plain CSV is 9 to 88 tokens smaller on 2 flat, uniform lists, because it needs no rules line. It has no types, it merges null, absent and empty text, and it cannot hold nesting. On orders with line items it is larger: 4,769 vs 3,899.
- Claude: Plain CSV is 23 to 38 tokens smaller on 4 flat, uniform lists, because it needs no rules line. It has no types, it merges null, absent and empty text, and it cannot hold nesting. On orders with line items it is larger: 6,490 vs 5,662.

Across 1,000 seeds of the same 11 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed.

Token counts say nothing about answer quality. Terset is about fewer tokens.
Other tokenizers and models will give other counts. Full benchmark with pretty JSON and CSV counts:
[terset.dev/benchmark](https://terset.dev/benchmark).

### Answer accuracy

On 244 questions and two models, accuracy is a tie. Terset used fewer input tokens than compact JSON.

#### Claude Opus 5.5

| Format | Correct | Runs | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terset | 243 of 244 | Mean of 3 runs: 243, 243, 243 | 99.6% | 97.7% to 99.9% | 1,188,659 | $5.65 | Reference | 2026-11-17 |
| Compact JSON | 241 of 244 | Mean of 3 runs: 241, 241, 241 | 98.8% | 96.4% to 99.6% | 1,766,161 | $8.05 | +42.4% | 2026-11-17 |
| JSON | 241 of 244 | Mean of 3 runs: 241, 241, 241 | 98.8% | 96.4% to 99.6% | 2,303,845 | $10.16 | +79.9% | 2026-11-17 |
| TOON | 241.7 of 244 | Mean of 3 runs: 242, 242, 241 (241 to 242) | 99.0% | 96.9% to 99.7% | 1,369,764 | $6.35 | +12.4% | 2026-11-17 |

#### GPT 6.1 Sol

| Format | Correct | Runs | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Terset | 242 of 244 | Mean of 3 runs: 242, 241, 243 (241 to 243) | 99.2% | 97.1% to 99.8% | 842,260 | $1.84 | Reference | 2026-11-17 |
| Compact JSON | 235.3 of 244 | Mean of 3 runs: 236, 234, 236 (234 to 236) | 96.4% | 93.3% to 98.1% | 1,158,229 | $2.49 | +35.3% | 2026-11-17 |
| JSON | 237.3 of 244 | Mean of 3 runs: 237, 238, 237 (237 to 238) | 97.3% | 94.4% to 98.7% | 1,696,152 | $3.56 | +93.0% | 2026-11-17 |
| TOON | 242 of 244 | Mean of 3 runs: 242, 242, 242 | 99.2% | 97.1% to 99.8% | 1,020,628 | $2.20 | +19.2% | 2026-11-17 |

JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.

On both models, every format ran three times on 2026-11-17. Each model's runs are one matched batch with the same setup. No run is picked. Each row shows the mean of its runs, and the Runs column lists each run's score.

Accuracy is a tie. On 244 questions, every format's 95% interval overlaps every other format's, on both models.
One format's score moved by up to two questions from run to run. A gap that small is noise, not a win.
Against compact JSON, Terset cost 29.8% less on Claude Opus 5.5 and 26.1% less on GPT 6.1 Sol.

Cost is at API list price: input and output tokens times list prices read on 2026-11-17. Claude Opus 5.5 input tokens were counted with Anthropic's token counting endpoint over the exact request; GPT 6.1 Sol input tokens are as the model reported them. Temperature 0 where the model accepts it. Terset ran with fitted rules, which send only the rules each text needs. Each row names its run date.

Method and limits: [terset.dev/benchmark](https://terset.dev/benchmark#accuracy). Every answer and its score: [2026-11-12](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-12), [2026-11-13](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-13) and [2026-11-17](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-17).

## When not to use it

<!-- docs:when-not -->
- **No lists of records.** Config files and deeply nested data stay JSON. Terset sends no rules for them and saves a few tokens at most.
- **One-row lists.** A list needs two or more objects to become a table.
- **Mixed arrays.** A list with any item that is not an object stays JSON.
- **Nested lists.** Lists of objects inside a record stay JSON inside their cell. Only the top level becomes tables.
- **Hard limits.** The root must be an object or an array. Numeric `-0` and nesting deeper than 500 levels are explicit errors.
- **Writing back.** Terset is for the model to read. Ask for answers in JSON.
<!-- /docs:when-not -->

## Reference

<!-- docs:reference -->
Every function, parameter, error and limit, for JavaScript and Python: [terset.dev/docs](https://terset.dev/docs).

The format is frozen at 1.0. JavaScript and Python are separate implementations that both pass the conformance suite at conformance/ in the repository.
<!-- /docs:reference -->

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
