# Accuracy benchmark: real400-pilot-sol-2026-11-28

Status: complete. Mode: http. Recorded 72/72 calls.
Results are published as measured.
Stop reason: none.

Input reservation exceeded: 0 calls.

Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.
Dropped incomplete questions: 0 (model gpt-6.2-sol).

API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.

Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.

| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-6.2-sol | json-compact | ALL | 24 | 24 | 100.00% | 86.20% to 100.00% | 1074511 | 2786 | $2.149022 | $0.027860 | $2.176882 | $0.000000 |
| gpt-6.2-sol | json-compact | usgs-earthquakes | 12 | 12 | 100.00% | 75.75% to 100.00% | 664199 | 1282 | $1.328398 | $0.012820 | $1.341218 | $0.000000 |
| gpt-6.2-sol | toon | ALL | 23 | 24 | 95.83% | 79.76% to 99.26% | 1152667 | 2687 | $2.305334 | $0.026870 | $2.332204 | -$0.155322 |
| gpt-6.2-sol | toon | usgs-earthquakes | 11 | 12 | 91.67% | 64.61% to 98.51% | 777599 | 1701 | $1.555198 | $0.017010 | $1.572208 | -$0.230990 |
| gpt-6.2-sol | terset | ALL | 24 | 24 | 100.00% | 86.20% to 100.00% | 872263 | 2215 | $1.744526 | $0.022150 | $1.766676 | $0.410206 |
| gpt-6.2-sol | terset | usgs-earthquakes | 12 | 12 | 100.00% | 75.75% to 100.00% | 462071 | 1160 | $0.924142 | $0.011600 | $0.935742 | $0.405476 |
| gpt-6.2-sol | json-compact | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 410312 | 1504 | $0.820624 | $0.015040 | $0.835664 | $0.000000 |
| gpt-6.2-sol | toon | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 375068 | 986 | $0.750136 | $0.009860 | $0.759996 | $0.075668 |
| gpt-6.2-sol | terset | nws-gridpoint | 12 | 12 | 100.00% | 75.75% to 100.00% | 410192 | 1055 | $0.820384 | $0.010550 | $0.830934 | $0.004730 |

## Paired accuracy

The gap is Terset accuracy minus the comparison format accuracy. The 95% paired interval uses conservative exact bounds.
McNemar p-values are exact and two-sided. Questions share datasets, so use these results descriptively.

| Model | Comparison format | Paired questions | Only Terset correct | Only comparison correct | Gap (pp) | Paired 95% CI (pp) | McNemar p |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |
| gpt-6.2-sol | json-compact | 24 | 0 | 0 | 0.00 | -16.69 to 16.69 | 1 |
| gpt-6.2-sol | toon | 24 | 1 | 0 | 4.17 | -16.64 to 23.79 | 1 |
