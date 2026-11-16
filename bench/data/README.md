# Frozen inputs

Source: https://github.com/toon-format/toon, commit
`22caca377f08d737789a2ca60ab02c425a3aa947`. See `../LICENSE-THIRD-PARTY`.

Generated with Node 24.22.1, Faker 10.6.0, and `TZ=UTC`. The generator uses
seed 12345 and reference date `2025-06-01T00:00:00.000Z`. It resets to seeds
67890 and 67891 for keyed and nested-group inputs. Preserve module evaluation
order, including the token-efficiency datasets that consume the shared stream.

Two separate processes produced byte-identical generator files. The stored
questions then receive the two corrections described below:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| datasets.json | 205667 | ee0ce056cb7c1cd01fa68d44c343ca72ae2dd1a443b54b82837472771a0c3b7e |
| questions.json | 52062 | af0121660a4c6a20e4f6b64a4e18b3dde9007799256af5f205fd959a20527b93 |

Deviation from upstream: q233 lists repository fields in their frozen data
order: `id,name,repo,description,createdAt,updatedAt,pushedAt,stars,watchers,forks,defaultBranch`.
q234's seventh field is `pushedAt`. Upstream's structure generator hardcodes
a different field order at `benchmarks/src/questions/structure.ts:273`.
Only these two expected answers are corrected; datasets remain unchanged.
The uncorrected generated questions were 52059 bytes with SHA-256
`b66b951bff7ae72ab5a33c81f919a1cb59221f4d400aa6636cc0db24154364f6`.

Reproduction of the pinned upstream generator is by construction, using the
same source, pinned Faker, seeds and reference date. Equality with upstream's
published run inputs is UNKNOWN because no generated input snapshot is checked
in. Its checked-in `benchmarks/results/accuracy/models/gpt-5.4-nano` contains
1329 result rows. Before the two structure-answer corrections above, 881
expected answers match the generated freeze; 85 distinct questions (448 rows)
differ from the published run. Seed and timezone are ruled out by matching
seeded records and regeneration across timezones. The
likely but unproven cause is a different Faker release in the published run:
name-derived values differ first, followed by drift in the shared random stream.
The exact release is UNKNOWN. Those older answers are not substituted for the
current generator's output. The `github` input was compared directly with upstream's
checked-in `github-repos.json` and is equal.

To regenerate outside this workspace:

1. Check out the source commit above.
2. In an empty temporary directory, run `npm init -y`, then
   `npm install --ignore-scripts --save-exact @faker-js/faker@10.6.0`.
   Set `type` to `module` in the temporary package.json.
3. Copy `benchmarks/src/datasets.ts`, `types.ts`, `constants.ts`, `normalize.ts`,
   all `benchmarks/src/questions/*.ts`, and
   `benchmarks/data/github-repos.json`, preserving their relative paths.
4. Save this as `freeze.mjs` in the temporary directory:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { ACCURACY_DATASETS } from './benchmarks/src/datasets.ts';
import { generateQuestions } from './benchmarks/src/questions/index.ts';

const destination = process.argv[2];
if (!destination) throw new Error('Pass an output directory');
await mkdir(destination, { recursive: true });
await writeFile(`${destination}/datasets.json`, `${JSON.stringify(ACCURACY_DATASETS, null, 2)}\n`);
await writeFile(`${destination}/questions.json`, `${JSON.stringify(generateQuestions(), null, 2)}\n`);
```

5. Run `TZ=UTC node freeze.mjs first` and `TZ=UTC node freeze.mjs second`.
6. Compare each pair with `cmp`. Run `shasum -a 256 first/*.json second/*.json`.
   Compare questions against the uncorrected hash above, then apply the q233
   and q234 corrections before comparing with the stored hash.

The registry integrity for Faker 10.6.0 is
`sha512-3RQHgEtvL1Frl/d1cSreo7qhJ3Gk1OdNUai/CtZ8G+wYeRQnJih3s9xJ9/kgYekPQRdwgh0HXRPqMlzWGwivIQ==`.
Faker is used only during this freeze step. It is not a workspace dependency.
