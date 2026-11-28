# Accuracy benchmark: real400-pilot-opus-2026-11-28

Status: complete. Mode: http. Recorded 72/72 calls.
Results are published as measured.
Stop reason: none.

Input reservation exceeded: 0 calls.

Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.
Dropped incomplete questions: 0 (model claude-opus-5-5).

API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.

Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.

| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | json-compact | ALL | 23 | 24 | 95.83% | 79.76% to 99.26% | 1486137 | 9439 | $5.944548 | $0.188780 | $6.133328 | $0.000000 |
| claude-opus-5-5 | json-compact | usgs-earthquakes | 11 | 12 | 91.67% | 64.61% to 98.51% | 984297 | 4619 | $3.937188 | $0.092380 | $4.029568 | $0.000000 |
| claude-opus-5-5 | toon | ALL | 23 | 24 | 95.83% | 79.76% to 99.26% | 1464057 | 7078 | $5.856228 | $0.141560 | $5.997788 | $0.135540 |
| claude-opus-5-5 | toon | usgs-earthquakes | 11 | 12 | 91.67% | 64.61% to 98.51% | 1050489 | 4177 | $4.201956 | $0.083540 | $4.285496 | -$0.255928 |
| claude-opus-5-5 | terset | ALL | 23 | 24 | 95.83% | 79.76% to 99.26% | 1151961 | 7523 | $4.607844 | $0.150460 | $4.758304 | $1.375024 |
| claude-opus-5-5 | terset | usgs-earthquakes | 11 | 12 | 91.67% | 64.61% to 98.51% | 650445 | 2843 | $2.601780 | $0.056860 | $2.658640 | $1.370928 |
| claude-opus-5-5 | json-compact | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 501840 | 4820 | $2.007360 | $0.096400 | $2.103760 | $0.000000 |
| claude-opus-5-5 | toon | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 413568 | 2901 | $1.654272 | $0.058020 | $1.712292 | $0.391468 |
| claude-opus-5-5 | terset | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 501516 | 4680 | $2.006064 | $0.093600 | $2.099664 | $0.004096 |

## Paired accuracy

The gap is Terset accuracy minus the comparison format accuracy. The 95% paired interval uses conservative exact bounds.
McNemar p-values are exact and two-sided. Questions share datasets, so use these results descriptively.

| Model | Comparison format | Paired questions | Only Terset correct | Only comparison correct | Gap (pp) | Paired 95% CI (pp) | McNemar p |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| claude-opus-5-5 | json-compact | 24 | 0 | 0 | 0.00 | -16.69 to 16.69 | 1 |
| claude-opus-5-5 | toon | 24 | 0 | 0 | 0.00 | -16.69 to 16.69 | 1 |
