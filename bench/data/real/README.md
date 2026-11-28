# Real data

Two real public JSON documents, frozen byte for byte as fetched. Nobody
tuned the Terset encoder or its rules line on them.

The files were frozen before any token count was taken. No encoder, decoder
or rules change was made after looking at them. `pnpm real` counts them; it
never changes them.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| usgs-earthquakes-all-day.geojson | 157609 | 7306b59e3a896439a3c57efd6597ac062b8234dd459ebcd1eb4c5fcfc07b5485 |
| nws-gridpoint-lwx-97-71.json | 166043 | 9ca6b9be09aed19680ae60eb24c6e92e8caac82cd6dfee3af034478482f39158 |

## usgs-earthquakes-all-day.geojson

- Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
- Fetched: 2026-11-17 20:01:49 UTC. The feed says it was generated at
  2026-11-17 20:00:54 UTC.
- What it is: every earthquake the US Geological Survey listed in the past
  day, 221 events. Mostly one list of records with the same fields.
- License: US public domain. USGS data is a work of the US government. See
  https://www.usgs.gov/information-policy-and-guidelines/copyrights-and-credits.

## nws-gridpoint-lwx-97-71.json

- Source: https://api.weather.gov/gridpoints/LWX/97,71, fetched with
  `Accept: application/geo+json`.
- Fetched: 2026-11-17 20:02:00 UTC. The data says it was updated at
  2026-11-17 18:29:06 UTC.
- What it is: the raw forecast grid data the US National Weather Service
  publishes for one grid square in Washington, DC. Deeply nested: 59 forecast
  series, each with a list of timed values, and 20 of them with a unit. Nine
  more fields describe the grid square.
- License: US public domain. NWS information is a work of the US government.
  See https://www.weather.gov/disclaimer.
- Why this one: the aim was a nested document of 20 KB to 400 KB. The
  ready-made forecast at `.../forecast` is 12.8 KB. So the raw grid data was
  chosen instead.

## Personal data

Neither file names a person. The USGS file holds place names near each
event, network codes and links to USGS pages. The NWS file holds a map
square, unit codes and forecast values.

## Question freeze

The questions were frozen on 2026-11-26 before any model call. No question is
removed after seeing results.

Each document has five questions of each kind. They are field retrieval,
count, extreme and nested lookup. The generator computes every answer from the
original data. It samples lookup records at fixed intervals in source order.
It checks that each extreme that asks for a record has exactly one match.

The generator is `bench/src/real/generate.ts`. It checks both source hashes
listed above before reading the data.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `bench/src/real/generate.ts` | 9067 | c09f85fe3e3d685292a38500881c469c9c1b9bd627354f5f4dba7b8eaaf099db |
| `suite/datasets.json` | 420151 | 452a7579e65fe464f61f996a98d363cf26cb9b5510509d31eddc5f110e1527b6 |
| `suite/questions.json` | 11655 | a43dc5e2423f5a14c3caed102c7e1fe680e50eb24ee335b90aecc189466e2889 |

Regenerate the frozen dataset and question files from the repository root.

```sh
pnpm --dir bench real:freeze
```

## Question freeze, 400-question suite

The questions were frozen on 2026-11-28 before any model call. No question
is removed after results. The separate 24-question pilot tunes nothing.
The output limit was set before the run at 8,192 tokens per call for both sets.

Each file has 25 questions of each of eight kinds. The four added kinds ask
for a count with two conditions, a comparison, a position or a rank. The
generator checks both source hashes and computes the answers from the parsed
files. It samples in source order at fixed strides and offsets. The pilot
uses different offsets and shares no prompts with the full suite.

Both sets use the frozen `suite/datasets.json` listed above.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `bench/src/real/generate-400.ts` | 13985 | ef9f973521096d42344c79c01ace7730b24095e7660b9bd90c4917cd3e2d7630 |
| `suite-400/questions.json` | 122304 | f5bc3212982e9dc239bd3595d59471952e8a24b97fc2e3132b71e1be66e29ac8 |
| `suite-400/pilot.json` | 7301 | d43c2b8b6706257748026eec0f1492e8727a9e7d0e6a5ad6a3b0168f1482d181 |

Regenerate the question files from the repository root.

```sh
pnpm --dir bench real-400:freeze
```
