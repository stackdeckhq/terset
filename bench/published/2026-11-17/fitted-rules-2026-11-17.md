# Accuracy benchmark: fitted-rules-2026-11-17

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
| claude-opus-5-5 | terset | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1219159 | 43842 | $4.876636 | $0.876840 | $5.753476 |  |
| claude-opus-5-5 | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 166250 | 7606 | $0.665000 | $0.152120 | $0.817120 |  |
| gpt-6.1-sol | terset | ALL | 238 | 244 | 97.54% | 94.74% to 98.87% | 842260 | 14979 | $1.684520 | $0.149790 | $1.834310 |  |
| gpt-6.1-sol | terset | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 97489 | 2847 | $0.194978 | $0.028470 | $0.223448 |  |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 5886 | $1.468900 | $0.117720 | $1.586620 |  |
| gpt-6.1-sol | terset | nested | 40 | 41 | 97.56% | 87.40% to 99.57% | 236980 | 2111 | $0.473960 | $0.021110 | $0.495070 |  |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 8004 | $0.202736 | $0.160080 | $0.362816 |  |
| gpt-6.1-sol | terset | analytics | 28 | 30 | 93.33% | 78.68% to 98.15% | 45191 | 2945 | $0.090382 | $0.029450 | $0.119832 |  |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 14645 | $1.505208 | $0.292900 | $1.798108 |  |
| gpt-6.1-sol | terset | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 289258 | 4459 | $0.578516 | $0.044590 | $0.623106 |  |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 148679 | 6902 | $0.594716 | $0.138040 | $0.732756 |  |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 108793 | 2227 | $0.217586 | $0.022270 | $0.239856 |  |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35397 | 106 | $0.141588 | $0.002120 | $0.143708 |  |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20214 | 158 | $0.040428 | $0.001580 | $0.042008 |  |
| claude-opus-5-5 | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 22629 | 345 | $0.090516 | $0.006900 | $0.097416 |  |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 |  |
| claude-opus-5-5 | terset | nested-group | 17 | 18 | 94.44% | 74.24% to 99.01% | 46787 | 111 | $0.187148 | $0.002220 | $0.189368 |  |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 |  |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 95 | $0.004204 | $0.001900 | $0.006104 |  |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 5 | $0.001138 | $0.000050 | $0.001188 |  |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 23 | $0.003780 | $0.000460 | $0.004240 |  |
| gpt-6.1-sol | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 506 | 5 | $0.001012 | $0.000050 | $0.001062 |  |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 44 | $0.004668 | $0.000880 | $0.005548 |  |
| gpt-6.1-sol | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 639 | 5 | $0.001278 | $0.000050 | $0.001328 |  |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 35 | $0.004192 | $0.000700 | $0.004892 |  |
| gpt-6.1-sol | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 566 | 5 | $0.001132 | $0.000050 | $0.001182 |  |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 40 | $0.003980 | $0.000800 | $0.004780 |  |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 |  |
