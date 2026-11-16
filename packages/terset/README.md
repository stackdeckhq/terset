<!-- docs:header -->
<p align="center">
  <img src="https://terset.dev/brand/terset-mark.svg" alt="Terset" width="64" height="64">
</p>

<h1 align="center">Terset</h1>

<p align="center">The official JavaScript and TypeScript package for Terset.</p>

<p align="center">Terset: TERse SETs. It writes a set of records as one terse table, so a model reads the same data with fewer tokens.</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@stackdeck/terset" alt="npm version">
  <img src="https://img.shields.io/npm/l/@stackdeck/terset" alt="license MIT">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
  <img src="https://img.shields.io/node/v/@stackdeck/terset" alt="node 20 and up">
</p>

<p align="center"><a href="https://terset.dev">terset.dev</a> · <a href="https://terset.dev/docs">Docs</a></p>
<!-- /docs:header -->

<!-- docs:contents -->
**Contents**

- [See it](#see-it)
- [Install](#install)
- [Use it](#use-it)
- [How it works](#how-it-works)
- [Benchmark](#benchmark)
- [When not to use it](#when-not-to-use-it)
- [Reference](#reference)
- [For agents](#for-agents)
- [Source](#source)
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
`rulesFor(text)` gives the shortest valid rules sentence. `RULES` keeps the full rules.

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

// Send the fitted rules once in the system prompt, and the text as the data.
const messages = [
  { role: "system", content: `You read Terset data. ${rulesFor(text)}` },
  { role: "user", content: `Which users have no role?\n\n${text}` },
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
2. Put `rulesFor(text)` in the system prompt once. The data carries no legend.
3. `decode(text)` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.

Never write Terset by hand. Always use `encode`.

**JavaScript details**

- `decode` and `rulesFor` throw `SyntaxError` on any text they reject, and `TypeError` when the input is not a string.
- Values must be plain objects, arrays and JSON scalars. Class instances, symbol keys and sparse arrays throw `TypeError`.
- Numbers are JavaScript numbers. Numeric `-0`, `NaN` and infinities throw `TypeError`.
<!-- /docs:use -->

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

Full rules: [terset.dev/format](https://terset.dev/format).

## Benchmark

Token counts for the same input in each format. Lower is better.
There are two counters: the `o200k_base` tokenizer, and Claude's own count
for Claude Opus 5.5. They give different numbers for the same text.

### o200k_base

| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |
|---|---|---|---|---|---|
| UI text, uneven rows | 507 | 695 | 802 | 846 | -27.1% |
| UI text, uniform rows | 537 | 742 | 857 | 539 | -27.6% |
| Translation batch | 1,228 | 1,450 | 1,623 | 1,660 | -15.3% |
| File list, short | 9,661 | 12,806 | 14,453 | 10,643 | -24.6% |
| File list, long | 16,487 | 19,627 | 22,129 | 17,476 | -16.0% |
| 200 users | 4,721 | 6,811 | 7,983 | 5,081 | -30.7% |
| Metrics, numbers and booleans | 2,572 | 4,797 | 6,115 | 2,654 | -46.4% |
| Deep nested config | 432 | 371 | 456 | 442 | +16.4% |
| Mixed-type array | 125 | 85 | 131 | 160 | +47.1% |
| Reviews, long text | 3,804 | 4,279 | 4,787 | 3,833 | -11.1% |
| Orders with line items | 3,971 | 4,585 | 5,673 | 4,419 | -13.4% |
| Total | 44,045 | 56,248 | 65,009 | 47,753 | -21.7% |

Terset, rules line included, is under TOON's best in 11 of 11 cases and
under compact JSON in 9 of 11.

Over all 11 cases, Terset totals 44,045 tokens: 21.7% fewer than JSON
compact (56,248), 42.9% fewer than JSON pretty (77,071), 32.2% fewer than
YAML (65,009), and 7.8% fewer than TOON's best (47,753).

### Claude Opus 5.5

| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |
|---|---|---|---|---|---|
| UI text, uneven rows | 1,066 | 1,463 | 1,341 | 1,387 | -27.1% |
| UI text, uniform rows | 1,130 | 1,567 | 1,444 | 1,098 | -27.9% |
| Translation batch | 2,267 | 2,714 | 2,519 | 2,581 | -16.5% |
| File list, short | 13,164 | 18,357 | 18,820 | 14,216 | -28.3% |
| File list, long | 25,229 | 30,419 | 31,925 | 26,274 | -17.1% |
| 200 users | 7,001 | 10,712 | 10,509 | 7,126 | -34.6% |
| Metrics, numbers and booleans | 2,860 | 6,957 | 7,314 | 2,907 | -58.9% |
| Deep nested config | 674 | 610 | 613 | 602 | +10.5% |
| Mixed-type array | 189 | 114 | 147 | 189 | +65.8% |
| Reviews, long text | 5,181 | 6,009 | 6,313 | 5,149 | -13.8% |
| Orders with line items | 5,738 | 6,795 | 7,000 | 5,691 | -15.6% |
| Total | 64,499 | 85,717 | 87,945 | 67,220 | -24.8% |

Terset, rules line included, is under TOON's best in 6 of 11 cases and
under compact JSON in 9 of 11.

Over all 11 cases, Terset totals 64,499 tokens: 24.8% fewer than JSON
compact (85,717), 39.5% fewer than JSON pretty (106,601), 26.7% fewer than
YAML (87,945), and 4.0% fewer than TOON's best (67,220).

### Input cost at list price

Input cost for 1,000 requests of each case, in US dollars. Input tokens
only, at the list price on the day it was read. It is not a bill.

Claude Opus 5.5 at $4 per million input tokens, on the Claude counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $4.26 | $5.85 | -$1.59 |
| UI text, uniform rows | $4.52 | $6.27 | -$1.75 |
| Translation batch | $9.07 | $10.86 | -$1.79 |
| File list, short | $52.66 | $73.43 | -$20.77 |
| File list, long | $100.92 | $121.68 | -$20.76 |
| 200 users | $28.00 | $42.85 | -$14.85 |
| Metrics, numbers and booleans | $11.44 | $27.83 | -$16.39 |
| Deep nested config | $2.70 | $2.44 | +$0.26 |
| Mixed-type array | $0.76 | $0.46 | +$0.30 |
| Reviews, long text | $20.72 | $24.04 | -$3.32 |
| Orders with line items | $22.95 | $27.18 | -$4.23 |
| Total | $258.00 | $342.87 | -$84.87 |

GPT 6.1 Sol at $2 per million input tokens, context up to 272K, on the
`o200k_base` counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $1.01 | $1.39 | -$0.38 |
| UI text, uniform rows | $1.07 | $1.48 | -$0.41 |
| Translation batch | $2.46 | $2.90 | -$0.44 |
| File list, short | $19.32 | $25.61 | -$6.29 |
| File list, long | $32.97 | $39.25 | -$6.28 |
| 200 users | $9.44 | $13.62 | -$4.18 |
| Metrics, numbers and booleans | $5.14 | $9.59 | -$4.45 |
| Deep nested config | $0.86 | $0.74 | +$0.12 |
| Mixed-type array | $0.25 | $0.17 | +$0.08 |
| Reviews, long text | $7.61 | $8.56 | -$0.95 |
| Orders with line items | $7.94 | $9.17 | -$1.23 |
| Total | $88.09 | $112.50 | -$24.41 |

How it was measured:

- The `o200k_base` counts use the `o200k_base` tokenizer, run locally.
- The Claude counts come from Anthropic's token count endpoint for `claude-opus-5-5`, run on 2026-11-13 UTC.
- Each text is sent as one user message. The same run also counts the one-letter text "a", which comes back as 9 tokens. Its 8 tokens of fixed message framing are taken off every count, assuming "a" itself is 1 token.
- Every Claude case was made from the same input as the o200k_base case of the same name. The build checks this by comparing the compact JSON counted locally with o200k_base.
- The case inputs are not in this repository. Eight are made-up data built from a fixed random seed. The UI text and translation cases use interface text from an app whose source is not public, so only their counts are published.
- Every format gets the same input.
- JSON compact is `JSON.stringify(value)`, with no spaces. It is the main baseline.
- JSON pretty is `JSON.stringify(value, null, 2)`, with a 2-space indent.
- YAML is the `yaml` package, version 2.9.1, `stringify` with default options.
- TOON is the smaller of its comma and tab forms for each case.
- Terset o200k_base counts include `rulesFor(text)`, fitted to each encoded text, once per prompt. The full `RULES` reference is 73 tokens. The Claude counts include `rulesFor(text)`, a newline and the data in one message.
- Each Terset output is decoded and compared with its input before it is counted.

How the cost was worked out:

- Cost is the input tokens of one request times the list price, shown per 1,000 requests of that case. It is input only: no output tokens, no caching and no discounts. It is not a bill.
- Claude Opus 5.5 is $4 per million input tokens ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)). It is applied to the Claude counts.
- GPT 6.1 Sol is $2 per million input tokens, context up to 272K ([pricing](https://developers.openai.com/api/docs/pricing)). It is applied to the `o200k_base` counts. Those are tokenizer counts, not counts reported for that model, so the GPT 6.1 Sol figure assumes that tokenizer.
- Both pricing pages were read on 2026-11-12.

Where Terset does not win:

- o200k_base: Compact JSON wins on deep nested config (371 vs 432) and mixed-type array (85 vs 125).
- Claude: Compact JSON wins on deep nested config (610 vs 674) and mixed-type array (114 vs 189).
- Claude: TOON's best is smaller than or equal to Terset in 5 of 11 cases: UI text, uniform rows (1,098 vs 1,130); Deep nested config (602 vs 674); Mixed-type array (189 vs 189); Reviews, long text (5,149 vs 5,181); Orders with line items (5,691 vs 5,738).
- Plain CSV is 34 to 44 tokens smaller on 4 flat, uniform lists, because it needs no rules line. It has no types, it merges null, absent and empty text, and it cannot hold nesting.

Token counts say nothing about answer quality. Terset is about fewer tokens.
Other tokenizers and models will give other counts. Full benchmark with pretty JSON and CSV counts:
[terset.dev/benchmark](https://terset.dev/benchmark).

### Answer accuracy

On 244 questions and two models, accuracy is a tie. Terset used fewer input tokens than compact JSON.

#### Claude Opus 5.5

| Format | Correct | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Terset | 243 of 244 | 99.6% | 97.7% to 99.9% | 1,200,640 | $5.69 | Reference | 2026-11-13 |
| Compact JSON | 241 of 244 | 98.8% | 96.4% to 99.6% | 1,766,161 | $8.04 | +41.3% | 2026-11-12 |
| JSON | 239 of 244 | 98.0% | 95.3% to 99.1% | 2,303,845 | $10.20 | +79.2% | 2026-11-12 |
| TOON | 242 of 244 | 99.2% | 97.1% to 99.8% | 1,369,764 | $6.35 | +11.6% | 2026-11-12 |

#### GPT 6.1 Sol

| Format | Correct | Accuracy | 95% interval | Input tokens | Cost | Costs more than Terset | Run date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Terset | 241 of 244 | 98.8% | 96.4% to 99.6% | 848,844 | $1.85 | Reference | 2026-11-13 |
| Compact JSON | 236 of 244 | 96.7% | 93.7% to 98.3% | 1,158,229 | $2.50 | +34.8% | 2026-11-12 |
| JSON | 237 of 244 | 97.1% | 94.2% to 98.6% | 1,696,152 | $3.56 | +92.2% | 2026-11-12 |
| TOON | 239 of 244 | 98.0% | 95.3% to 99.1% | 1,020,628 | $2.19 | +18.3% | 2026-11-12 |

JSON is indented with 2 spaces. Compact JSON has no spaces or line breaks.

Accuracy is a tie. On 244 questions, every format's 95% interval overlaps every other format's, on both models.
Against compact JSON, Terset cost 29.2% less on Claude Opus 5.5 and 25.8% less on GPT 6.1 Sol.

Cost is at API list price: input and output tokens times list prices read on 2026-11-12. Claude Opus 5.5 input tokens were counted with Anthropic's token counting endpoint over the exact request; GPT 6.1 Sol input tokens are as the model reported them. Temperature 0 where the model accepts it. Terset was rerun on 2026-11-13 after its format changed in 0.2.1; the other formats did not change. Each row names its run date.

Method and limits: [terset.dev/benchmark](https://terset.dev/benchmark#accuracy). Every answer and its score: [2026-11-12](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-12) and [2026-11-13](https://github.com/stackdeckhq/terset/tree/main/bench/published/2026-11-13).

## When not to use it

<!-- docs:when-not -->
- **No lists of records.** Config files and deeply nested data stay JSON, so the rules line only adds tokens.
- **One-row lists.** A list needs two or more objects to become a table.
- **Mixed arrays.** A list with any item that is not an object stays JSON.
- **Nested lists.** Lists of objects inside a record stay JSON inside their cell. Only the top level becomes tables.
- **Hard limits.** The root must be an object or an array. Numeric `-0` and nesting deeper than 500 levels are explicit errors.
- **Writing back.** Terset is for the model to read. Ask for answers in JSON.
<!-- /docs:when-not -->

## Reference

<!-- docs:reference -->
Every function, parameter, error and limit, for JavaScript and Python: [terset.dev/docs](https://terset.dev/docs).
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

## Source

The code, tests and site live at
[github.com/stackdeckhq/terset](https://github.com/stackdeckhq/terset).

## License

MIT, copyright (c) 2026 TrueWear, LLC. See [LICENSE](https://github.com/stackdeckhq/terset/blob/main/LICENSE).
