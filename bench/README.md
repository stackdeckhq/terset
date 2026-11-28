# Answer accuracy benchmark

The TOON suite's datasets and questions are adapted from the MIT-licensed benchmark at
https://github.com/toon-format/toon, commit
`22caca377f08d737789a2ca60ab02c425a3aa947`.
See [the frozen input record](data/README.md) and `LICENSE-THIRD-PARTY`.

Results are published as measured. Token counts alone do not establish answer
accuracy. Fake responses verify the harness and are not model measurements.

## Published results

`bench/results/` is ignored by git. Runs that the site and the READMEs quote are
copied unchanged into `bench/published/<date>/`, with the run's JSON file and
its Markdown report. The published real runs include both question sets and
the separate pilot for the 400-question run.

- 2026-11-19, format 1.1. The TOON suite runs are
  `accuracy-opus-2026-11-19` and `accuracy-sol-2026-11-19`, 244 questions in
  four formats. Terset got 242 of 244 on Claude Opus 5.5 and 243 of 244 on
  GPT 6.1 Sol. The stress suite runs are `stress-opus-2026-11-19`,
  `stress-sol-2026-11-19` and `stress-haiku-2026-11-19`, 120 questions in four
  formats. Terset got 119, 118 and 113 of 120. Three calls failed, none of
  them Terset's: pretty JSON q235 on Opus, TOON q219 on Sol and compact JSON
  s096 on Sol. Each was asked again, and the second answer is the one scored.
  The failed attempts stay listed in their run files.
- [2026-11-26](published/2026-11-26), format 1.1. The real suite runs are
  `real-opus-2026-11-26` and `real-sol-2026-11-26`. Each covers 40 questions
  in three formats.
- [2026-11-28](published/2026-11-28), format 1.1. The 400-question runs are
  `real400-opus-2026-11-28` and `real400-sol-2026-11-28`. All 400 questions
  were frozen before any model call. The separate 24-question pilot ran first
  and changed no question. Its runs are `real400-pilot-opus-2026-11-28` and
  `real400-pilot-sol-2026-11-28`. Both sets used an output limit of 8,192 tokens
  per call. A time limit stopped the full Opus run once. It resumed with the
  same run ID and answered all 400 questions in each format. The interrupted
  compact JSON call for q367 stays in the budget ledger as a charge. The retry
  supplied the scored answer.

`pnpm accuracy` rebuilds `apps/site/src/data/accuracy-results.json` from the
published runs, and updates the accuracy blocks in the READMEs. It takes one
run per model, and each run must hold only its model. No run is picked.
Input tokens are as each model reported them, including Claude.
The runs must share data hashes, the upstream commit, the tokenizer, the
per-call output cap, the input reservation and the question set.
Each table row records its run date. Tests fail when the committed site file
or a README accuracy block drifts from the published runs, or when a run file in
`bench/published/` is left out.

The stress suite has its own published list and generated file,
`apps/site/src/data/accuracy-stress-results.json`. `pnpm accuracy` also builds
its README blocks. It records correct answers, totals and reported input
tokens overall and per group, with each run id and date. Each model shows one
run. Gaps of a few questions are within noise. The stress checks require the same suite, data hashes, generator source
and hash, seed, reference date, tokenizer, input reservation, per-call output
cap and encoder versions. Each run must hold only its listed model and the
frozen question set exactly once in every format. The checks hash the repository's
question, dataset and generator files. They re-score every answer against the
frozen question and take its group from the question's type. Stress input
tokens come from each model's report, including Claude.

`pnpm accuracy` also builds the 40-question and 400-question real data files.
The 400-question file lists the pilot runs for reference. Its scores, token
counts and paired comparisons use the full runs.

## Local use

Node 24 and the workspace dependencies are required. Plans and fake runs need
no provider credentials.

```sh
pnpm bench --dry-run
```

```sh
pnpm bench --fake --limit 2 --run-id fake-example
```

The plan lists questions per dataset, calls per model and format, and input
estimates and reserved input tokens with the existing `o200k_base` tokenizer. Estimates include shared
instructions and each format's primer, and exclude API framing. Dry runs make no calls, construct
no HTTP client, and write no results. `--limit N` takes up to N questions per
dataset by stable hashes of upstream question ids, then restores upstream order.
Every model and format gets the same subset.

`terset` uses the real package encoder and decoder. List tables carry row
counts. Eligible maps use keyed tables, and uniform nested objects use dotted
columns. Structural fixtures retain the original count and headers after
damage. The decoder rejects damaged text.

`--formats a,b,c` selects formats in that order. The default remains
`json-compact,json-pretty,toon,terset`.
`--datasets a,b` selects datasets by name. The default includes all datasets.
Both flags reject unknown names and duplicates. A saved run refuses a changed
selection. Comparisons use questions complete in every selected format.
Savings cells stay blank when compact JSON is absent.

`--suite toon|stress|real|real-400|real-400-pilot` selects frozen inputs. The default is `toon`, with the
same data, questions, prompts and fingerprints as existing runs. Dataset names
are validated within the selected suite. Results record the suite, input
hashes and source. TOON records the upstream commit. Stress records the
generator path and hash, seed and reference date. Real records the generator
path and hash and both original file hashes. A saved run refuses a different
plan.

The [stress freeze record](data/stress/README.md) describes its 120 questions
across scale, deep nesting, messy data and damage detection. To plan it:

```sh
pnpm bench --suite stress --dry-run
```

Plans also list reserved dollars per model and in total. Input cost uses
`ceil(estimate × margin) + allowance` per call. Output cost reserves the full
`--per-call-max-output-tokens` cap for every call, default 128 or 8192 for the
two real-400 suites. Supply the cap
intended for the measured run, for example 2048. Prices come from the selected
config. A reservation is a spending estimate, with the same limits described
under Budgets and resume.

Fake mode is the default. The CLI fake client returns the frozen expected
answer to exercise the scorer and storage. It is not a model measurement.
The exported fake client also accepts arbitrary recorded or incorrect answers.
Its optional third argument, `{ inputTokenOffset: 7 }`, simulates reported input
usage above the estimate. A negative offset simulates lower usage, floored at zero.

Files go to `bench/results/<run-id>.json` and `<run-id>.md`, ignored by Git.
JSON retains model, format, dataset, question id, expected value, raw answer,
correctness, and input/output tokens. Both files mark incomplete runs partial.
Summaries give correct/total, accuracy, Wilson 95% intervals, tokens and
API-equivalent input, output and total dollars per model/format and dataset.
Savings in dollars compare each format with compact JSON. Costs use reported
tokens at configured list prices, without discounts or cache-specific rates.
All summaries, accuracy and savings use only questions complete in every selected
format for that model. Each summary records `droppedIncompleteQuestions`;
the Markdown report states that count per model. Only started, incomplete
questions count as dropped. Raw completed rows and the budget ledger retain
every call, including rows excluded from comparisons.
Failed requests may have unreported charges. Intervals are descriptive because questions share
data and are not independent trials.

## Real suite

The real suite uses a USGS daily earthquake feed and a National Weather
Service gridpoint forecast. Each dataset contains the whole frozen document.
There are 20 questions per dataset. The [freeze record](data/real/README.md)
lists the sources, hashes and question rules.

```sh
pnpm bench --suite real --formats json-compact,toon,terset --dry-run --per-call-max-output-tokens 2048
```

`real-400` uses the same documents with 200 questions per file.
`real-400-pilot` has 12 separate questions per file. Both sets use an
8,192-token output limit. Pass `--per-call-max-output-tokens 8192` for HTTP runs.

```sh
pnpm bench --suite real-400-pilot --dry-run
pnpm bench --suite real-400 --dry-run
```

## HTTP client

Supported APIs: Anthropic Messages and OpenAI Chat Completions. A JSON config
contains only model settings, never credentials:

```json
{
  "inputReservation": { "margin": 1.25, "allowance": 64 },
  "models": [{
    "id": "replace-with-model-id",
    "api": "openai",
    "temperature": "zero",
    "outputTokenParameter": "max_completion_tokens",
    "price": {
      "inputPerMillion": 2,
      "outputPerMillion": 10,
      "sourceUrl": "https://example.invalid/replace-with-price-source",
      "dateRead": "2026-11-12"
    }
  }]
}
```

`api` is `openai` or `anthropic`. Temperature defaults to zero; set it to
`omit` when a model rejects it. Chat Completions defaults to
`max_completion_tokens`; use `max_tokens` where required. Messages always uses
`max_tokens`. There are no automatic parameter retries.

Every model requires input/output dollars per million tokens, a source URL
and its read date. Missing prices refuse the run before any call. Rates live
only in config, never in source. `models.sample.json` records the supplied
rates dated 2026-11-12. Check them before use. Default fake runs use the
fixture price in `fixtures/fake-model.json`; their dollars are synthetic.

Load `TERSET_BENCH_BASE_URL` and `TERSET_BENCH_API_KEY` through your approved
credential route. The base is an HTTPS root without `/v1`, query parameters,
or embedded credentials. Plain HTTP is accepted only for a server on this
machine (`127.0.0.1`, `localhost` or `[::1]`). The client appends `/v1/messages` or
`/v1/chat/completions`. Models in a run share the base and credential.
Redirects are refused. Requests time out after 10 minutes. Raw transport
errors and provider response bodies are withheld. Text and usage are validated;
missing usage is an error. Tests use fake fetch only.

HTTP mode requires config and all four explicit budget flags:

```sh
pnpm bench --http --config bench/models.local.json --run-id measured-example --limit 2 --max-calls 84 --max-input-tokens 2000000 --max-output-tokens 10752 --per-call-max-output-tokens 128
```

This command makes real calls. It is not part of the tests or dry run.

## Budgets and resume

Calls run sequentially, ordered by question, then model and format. Before
starting a question, the guard checks that all its unfinished calls fit the
whole-run call count, input reservations and per-call output reservations.
The API receives that output cap. A reservation that exceeds any limit stops
the run before the question. Budget stops retain the same questions for every
format and model. Request failures can interrupt a question; explicit resume
finishes its remaining calls first when the retained budgets permit. Zero limits permit zero calls.

Fake and HTTP calls reserve `ceil(estimated input × margin) + allowance`
input tokens. Run config sets `inputReservation.margin` (default 1.25, at least
1) and `inputReservation.allowance` (default 64 tokens). The dry run shows both
the plain estimate and the reservation per format. Output reservations equal
the per-call output cap sent to the provider.

After each successful call, reported input and output replace both reservations
in the ledger, even when reported usage is lower. Anthropic requests mark the
data block for caching. Rows include cache creation and read counts when the
API reports them. The total input count includes both. Counts above the local estimate are normal because API framing
and provider tokenizers differ. Input above the reservation adds a warning to
the run's `.log` file and increments the warning count in its report.

Before every call, the guard checks recorded spend plus that call's reservation.
It also checks all remaining calls of a question before starting or resuming it.
A provider can report usage above the reservation, so these caps are planning
limits rather than guaranteed spending limits. The worst overrun is bounded by
one call. The next call checks the real spend and stops if its reservation no
longer fits. Output limits also depend on the API honoring its cap.

Rerun the same id to skip recorded rows and retain budget usage. Raise whole-run
limits to continue a budget stop. Changes to questions, prompts, models, mode
or per-call cap are refused. JSON saves atomically after each response. A lock
refuses concurrent writers with the same id.

Reservations save before a request. Failed or interrupted requests may have
been billed, so those reservations remain charged. A failure is recorded with
its task identity and reserved tokens, then the run stops without automatic
retries. Null completion content is a failure, with one exception: a model
that spends its whole output cap and returns no text (`finish_reason` of
`length`) gave an empty answer, which is recorded and scored wrong. Explicitly rerun the same id
to retry the failed call and skip completed calls. All recorded calls and
reservations count toward the same caps, including every failed attempt.
A killed process can leave a lock file; remove it only after
proving the process has stopped. No key or environment dump is written.

## Method and upstream differences

Frozen data, question wording, ids, answer types and options come from upstream
without edits. Expected answers q233 and q234 are corrected to the frozen field
order. See `data/README.md` for reproduction and
hashes. Faker is not a workspace dependency. Both TOON encoders are 4.4.0:
the site's package and upstream's source. With defaults they produce
identical text for all 13 frozen datasets.
JSON is compact or indented with two spaces. Terset uses the workspace encoder.

Some checked-in upstream result answers differ from the current pinned
generator output. This harness preserves that generator output. It does not
claim that its inputs equal the older published run. Matching recorded answers
are used as scorer regressions alongside formatting variants.

The user prompt keeps upstream's shared wording and answer requirements.
Each JSON format and TOON receive their upstream primer, copied verbatim.
Terset receives `rulesFor(text)`, fitted to the valid encoded data before any
structural damage. Since 2026-11-17, `rulesFor` returns only the sentences
that text uses. All other instructions are identical
across formats, with a common fence and a format-name line. Each format's
primer tokens count toward its input tokens in plans and reports.

Structural fixtures encode valid data first, then apply the upstream row/field
damage while retaining table headers. JSON retains valid syntax. Some missing
or extra rows cannot be detected from JSON alone; upstream's expected validity
answers remain unchanged. Round-trip tests apply before intentional corruption.

Scoring ports upstream's deterministic normalizer. Numbers extract the first
numeric token and accept grouping, currency, percentages, tolerance and decimal
rounding. Booleans accept yes/no equivalents. Dates normalize to calendar dates.
Strings trim quotes/fences and ignore case unless overridden. Comma-separated
lists either preserve or ignore order; empty items are dropped as upstream does.
There is no model judge or question type needing a replacement judge.

The benchmark is not part of either published package, and their file lists
do not include it. Root type checking, lint and tests include this code.
