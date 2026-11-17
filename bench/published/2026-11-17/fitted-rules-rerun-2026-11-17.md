# Accuracy benchmark: fitted-rules-rerun-2026-11-17

Status: complete. Mode: http. Recorded 488/488 calls.
Results are published as measured.
Stop reason: none.

Input reservation exceeded: 214 calls.

Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.
Dropped incomplete questions: 0 (model claude-opus-5-5).
Dropped incomplete questions: 0 (model gpt-6.1-sol).

API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.

Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.

| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | terset | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1219159 | 44555 | $4.876636 | $0.891100 | $5.767736 |  |
| claude-opus-5-5 | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 166250 | 7618 | $0.665000 | $0.152360 | $0.817360 |  |
| gpt-6.1-sol | terset | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 842260 | 15670 | $1.684520 | $0.156700 | $1.841220 |  |
| gpt-6.1-sol | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 97489 | 2921 | $0.194978 | $0.029210 | $0.224188 |  |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 6240 | $1.468900 | $0.124800 | $1.593700 |  |
| gpt-6.1-sol | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 236980 | 2208 | $0.473960 | $0.022080 | $0.496040 |  |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 8073 | $0.202736 | $0.161460 | $0.364196 |  |
| gpt-6.1-sol | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 45191 | 2848 | $0.090382 | $0.028480 | $0.118862 |  |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 14700 | $1.505208 | $0.294000 | $1.799208 |  |
| gpt-6.1-sol | terset | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 289258 | 5048 | $0.578516 | $0.050480 | $0.628996 |  |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 148679 | 7193 | $0.594716 | $0.143860 | $0.738576 |  |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 108793 | 2255 | $0.217586 | $0.022550 | $0.240136 |  |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35397 | 140 | $0.141588 | $0.002800 | $0.144388 |  |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20214 | 158 | $0.040428 | $0.001580 | $0.042008 |  |
| claude-opus-5-5 | terset | keyed | 16 | 17 | 94.12% | 73.02% to 98.95% | 22629 | 211 | $0.090516 | $0.004220 | $0.094736 |  |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 |  |
| claude-opus-5-5 | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 46787 | 118 | $0.187148 | $0.002360 | $0.189508 |  |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 |  |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 99 | $0.004204 | $0.001980 | $0.006184 |  |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 5 | $0.001138 | $0.000050 | $0.001188 |  |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 24 | $0.003780 | $0.000480 | $0.004260 |  |
| gpt-6.1-sol | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 506 | 5 | $0.001012 | $0.000050 | $0.001062 |  |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 30 | $0.004668 | $0.000600 | $0.005268 |  |
| gpt-6.1-sol | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 639 | 5 | $0.001278 | $0.000050 | $0.001328 |  |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 58 | $0.004192 | $0.001160 | $0.005352 |  |
| gpt-6.1-sol | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 566 | 5 | $0.001132 | $0.000050 | $0.001182 |  |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 51 | $0.003980 | $0.001020 | $0.005000 |  |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 |  |
