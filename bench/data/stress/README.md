# Frozen stress inputs

Source: `bench/src/stress/generate.ts`, seed `20261117`, reference date
`2026-11-17T00:00:00.000Z`. The generator uses its own Mulberry32 PRNG. It
uses no clock, Faker, locale-sensitive formatting or external data.

Generator SHA-256: `36e8782fe7dad303057132ff4ea5e2f85ff1dce4135ba3b3b5fe05be24010cd1`.
Terset encoder package: `@stackdeck/terset` version `0.2.4`. TOON encoder:
`@toon-format/toon` version `4.4.0`. Each run file records both versions,
read from the installed packages.

Questions were frozen before any model call. Only fake and dry runs were used
during implementation. The first freeze, `c78aa1a4ff97a7f58712a196cce8efa1400d806f`,
was replaced the same day after code review, also before any model call. The
review made damage answers half YES and half NO, moved one end removal into the
middle, quoted text values in questions, varied the count answers and removed
answers that needed a literal tab or line break. Freeze commit: `016ece9e4f57fe4138ef44e316da104e9cfd8913`.

On 2026-11-18 the suite moved from Terset 0.2.1 to 0.2.4, before any full run.
Generating again on 0.2.4 gave byte-identical files with the same hashes,
because the data and questions do not depend on any encoder. The prompts do,
so runs on 0.2.4 have a different plan fingerprint. One 12-call smoke run on
0.2.1 came before the move. It checked the setup only and is not published.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| datasets.json | 1379798 | a827116f254dcb19483e6326f85ddec07d8721cf1849c4c8a504aa562eb63cab |
| questions.json | 28485 | 0a1e63fa6db21cc34bae61a4f6fb56aa7828bedb62854149bfbd041f41aa1c37 |

From the repository root:

```sh
pnpm --dir bench stress:freeze
```

To compare independent processes without overwriting the freeze:

```sh
pnpm --dir bench stress:freeze "$TMPDIR/stress-first"
```

```sh
pnpm --dir bench stress:freeze "$TMPDIR/stress-second"
```

```sh
cmp "$TMPDIR/stress-first/datasets.json" "$TMPDIR/stress-second/datasets.json"
```

```sh
cmp "$TMPDIR/stress-first/questions.json" "$TMPDIR/stress-second/questions.json"
```

The freeze has 38 datasets and 120 questions: scale 30, deep 25, messy 40,
damage 25. Expected answers are computed from generated data. Tests independently
recompute each answer, round-trip every undamaged source in all four formats,
and check every prompt with the harness's o200k token estimate.

Scale lists have 500, 750 and 1,000 records. Object nesting reaches 6, 8 and 10
levels. Record leaves reach 7, 8 and 9 dotted header segments. The nine-segment
case exceeds Terset's eight-segment cap and retains a JSON cell. Messy inputs
include 30% field omission, three mixed record shapes, absent/null/empty text,
type-like strings, tabs, newlines, quotes and non-Latin text. These include cases
that can increase Terset's size or reduce its accuracy.

Damage fixtures keep their original count and field headers while editing a
single top-level list of 300 records. There are 12 distinct clean controls and
13 damaged lists: rows cut from the end (3) and the middle (3), extra rows (2),
a missing field (3) and a duplicated row (2). Always answering NO scores 13 of
25. The question wording, boolean answer type and validity semantics mirror the
five upstream structural-validation questions. Missing and extra rows remain
invalid by the original fixture's structure, even when JSON alone cannot reveal
that damage. Rows cut from the end leave no trace in JSON, because JSON states
no row count. No extra count hints are added to any format.

A first attempt used a 2,048-token output cap. It was stopped and is not
published. The published runs used a 16,000-token cap, a 1.25 input margin and
a 64-token allowance. Haiku 5.5 used the full cap on TOON question s028. It
returned no answer and was scored wrong. Price sources and their supplied
2026-11-17 read date live in the scratch run config, outside the repository.
