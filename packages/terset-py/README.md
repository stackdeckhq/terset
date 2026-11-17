<!-- docs:header -->
<p align="center">
  <img src="https://terset.dev/brand/terset-mark.svg" alt="Terset" width="64" height="64">
</p>

<h1 align="center">Terset</h1>

<p align="center">The official Python package for Terset.</p>

<p align="center">Terset: TERse SETs. It writes a set of records as one terse table, so a model reads the same data with fewer tokens.</p>

<p align="center">
  <img src="https://img.shields.io/pypi/v/terset" alt="PyPI version">
  <img src="https://img.shields.io/pypi/l/terset" alt="license MIT">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies">
  <img src="https://img.shields.io/pypi/pyversions/terset" alt="Python 3.10 and up">
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
pip install terset
```

Zero dependencies. Python 3.10 and up. Type hints are included.
<!-- /docs:install -->

## Use it

<!-- docs:use -->
The API exports `encode`, `decode`, `RULES` and `rules_for`.
`rules_for(text)` gives the shortest valid rules sentence. `RULES` keeps the full rules.

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

# Send the fitted rules once in the system prompt, and the text as the data.
messages = [
    {"role": "system", "content": f"You read Terset data. {rules_for(text)}"},
    {"role": "user", "content": f"Which users have no role?\n\n{text}"},
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
2. Put `rules_for(text)` in the system prompt once. The data carries no legend.
3. `decode(text)` gives back the same value. Ask the model to answer in JSON, since Terset is for reading.

Never write Terset by hand. Always use `encode`.

**Python details**

- `decode` and `rules_for` raise `ValueError` on any text they reject, and `TypeError` when the input is not a string.
- Numbers follow JavaScript, so `1.0` writes as `1`. Decoded whole numbers within `[-2**53, 2**53]` become `int`. Others become `float`.
- An `int` that a binary64 float cannot hold exactly, such as `9007199254740993`, raises `TypeError` instead of rounding.
- Numeric `-0`, `nan`, infinities, cycles and types other than `dict`, `list`, `str`, numbers, `bool` and `None` raise `TypeError`.
- Dictionary order is kept, with array-index keys such as `"2"` and `"10"` first, in numeric order, as in JavaScript.
- `encode` takes the read-only `JsonInputRoot` type. `decode` returns `JsonRoot`. The package ships `py.typed`.
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
| UI text, uneven rows | 546 | 697 | 812 | 814 | -21.7% |
| UI text, uniform rows | 512 | 737 | 910 | 518 | -30.5% |
| Translation batch | 1,162 | 1,448 | 1,674 | 1,110 | -19.8% |
| File list, short | 9,640 | 12,808 | 15,304 | 10,315 | -24.7% |
| File list, long | 15,061 | 19,969 | 23,966 | 15,502 | -24.6% |
| 200 users | 5,427 | 9,051 | 10,924 | 5,589 | -40.0% |
| Metrics, numbers and booleans | 2,972 | 4,798 | 5,999 | 3,181 | -38.1% |
| Deep nested config | 290 | 251 | 316 | 296 | +15.5% |
| Mixed-type array | 103 | 63 | 89 | 99 | +63.5% |
| Reviews, long text | 3,723 | 4,308 | 5,006 | 3,662 | -13.6% |
| Orders with line items | 3,912 | 4,678 | 5,846 | 4,982 | -16.4% |
| Total | 43,348 | 58,808 | 70,846 | 46,068 | -26.3% |

Terset, rules line included, is under TOON's best in 8 of 11 cases and
under compact JSON in 9 of 11.

Over all 11 cases, Terset totals 43,348 tokens: 26.3% fewer than JSON
compact (58,808), 50.2% fewer than JSON pretty (87,020), 38.8% fewer than
YAML (70,846), and 5.9% fewer than TOON's best (46,068).

### Claude Opus 5.5

| Case | Terset | JSON compact | YAML | TOON best | Terset vs JSON compact |
|---|---|---|---|---|---|
| UI text, uneven rows | 815 | 1,083 | 1,062 | 1,065 | -24.7% |
| UI text, uniform rows | 804 | 1,253 | 1,160 | 774 | -35.8% |
| Translation batch | 1,858 | 2,514 | 2,413 | 1,833 | -26.1% |
| File list, short | 12,031 | 18,018 | 18,012 | 12,671 | -33.2% |
| File list, long | 21,293 | 30,405 | 31,199 | 22,019 | -30.0% |
| 200 users | 7,710 | 12,819 | 13,214 | 7,836 | -39.9% |
| Metrics, numbers and booleans | 3,369 | 6,535 | 6,960 | 3,467 | -48.4% |
| Deep nested config | 477 | 405 | 412 | 394 | +17.8% |
| Mixed-type array | 164 | 89 | 101 | 118 | +84.3% |
| Reviews, long text | 4,944 | 5,979 | 6,404 | 4,915 | -17.3% |
| Orders with line items | 5,687 | 7,002 | 7,208 | 6,268 | -18.8% |
| Total | 59,152 | 86,102 | 88,145 | 61,360 | -31.3% |

Terset, rules line included, is under TOON's best in 6 of 11 cases and
under compact JSON in 9 of 11.

Over all 11 cases, Terset totals 59,152 tokens: 31.3% fewer than JSON
compact (86,102), 47.9% fewer than JSON pretty (113,574), 32.9% fewer than
YAML (88,145), and 3.6% fewer than TOON's best (61,360).

### Input cost at list price

Input cost for 1,000 requests of each case, in US dollars. Input tokens
only, at the list price on the day it was read. It is not a bill.

Claude Opus 5.5 at $4 per million input tokens, on the Claude counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $3.26 | $4.33 | -$1.07 |
| UI text, uniform rows | $3.22 | $5.01 | -$1.79 |
| Translation batch | $7.43 | $10.06 | -$2.63 |
| File list, short | $48.12 | $72.07 | -$23.95 |
| File list, long | $85.17 | $121.62 | -$36.45 |
| 200 users | $30.84 | $51.28 | -$20.44 |
| Metrics, numbers and booleans | $13.48 | $26.14 | -$12.66 |
| Deep nested config | $1.91 | $1.62 | +$0.29 |
| Mixed-type array | $0.66 | $0.36 | +$0.30 |
| Reviews, long text | $19.78 | $23.92 | -$4.14 |
| Orders with line items | $22.75 | $28.01 | -$5.26 |
| Total | $236.61 | $344.41 | -$107.80 |

GPT 6.1 Sol at $2 per million input tokens, context up to 272K, on the
`o200k_base` counts:

| Case | Terset | JSON compact | vs JSON compact |
|---|---|---|---|
| UI text, uneven rows | $1.09 | $1.39 | -$0.30 |
| UI text, uniform rows | $1.02 | $1.47 | -$0.45 |
| Translation batch | $2.32 | $2.90 | -$0.58 |
| File list, short | $19.28 | $25.62 | -$6.34 |
| File list, long | $30.12 | $39.94 | -$9.82 |
| 200 users | $10.85 | $18.10 | -$7.25 |
| Metrics, numbers and booleans | $5.94 | $9.60 | -$3.66 |
| Deep nested config | $0.58 | $0.50 | +$0.08 |
| Mixed-type array | $0.21 | $0.13 | +$0.08 |
| Reviews, long text | $7.45 | $8.62 | -$1.17 |
| Orders with line items | $7.82 | $9.36 | -$1.54 |
| Total | $86.70 | $117.62 | -$30.92 |

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

- o200k_base: Compact JSON wins on deep nested config (251 vs 290) and mixed-type array (63 vs 103).
- Claude: Compact JSON wins on deep nested config (405 vs 477) and mixed-type array (89 vs 164).
- o200k_base: TOON's best is smaller than or equal to Terset in 3 of 11 cases: Translation batch (1,110 vs 1,162); Mixed-type array (99 vs 103); Reviews, long text (3,662 vs 3,723).
- Claude: TOON's best is smaller than or equal to Terset in 5 of 11 cases: UI text, uniform rows (774 vs 804); Translation batch (1,833 vs 1,858); Deep nested config (394 vs 477); Mixed-type array (118 vs 164); Reviews, long text (4,915 vs 4,944).
- o200k_base: Plain CSV is 41 to 111 tokens smaller on 2 flat, uniform lists, because it needs no rules line. It has no types, it merges null, absent and empty text, and it cannot hold nesting. On orders with line items it is larger: 4,769 vs 3,912.
- Claude: Plain CSV is 81 to 83 tokens smaller on 4 flat, uniform lists, because it needs no rules line. It has no types, it merges null, absent and empty text, and it cannot hold nesting. On orders with line items it is larger: 6,490 vs 5,687.

Across 1,000 seeds of the same 11 case shapes, counted with o200k_base, Terset wins or loses against JSON compact and TOON the same way on every seed, except UI text, uniform rows against TOON, where Terset is smaller on 985 of 1,000.

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
