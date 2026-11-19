# Accuracy benchmark: accuracy-opus-2026-11-19

Status: complete. Mode: http. Recorded 976/976 calls.
Results are published as measured.
Stop reason: none.

Input reservation exceeded: 886 calls.

Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.
Dropped incomplete questions: 0 (model claude-opus-5-5).

API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.

Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.

| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | json-compact | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 1796661 | 48770 | $7.186644 | $0.975400 | $8.162044 | $0.000000 |
| claude-opus-5-5 | json-compact | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 280558 | 8707 | $1.122232 | $0.174140 | $1.296372 | $0.000000 |
| claude-opus-5-5 | json-pretty | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 2334345 | 48313 | $9.337380 | $0.966260 | $10.303640 | -$2.141596 |
| claude-opus-5-5 | json-pretty | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 379409 | 7964 | $1.517636 | $0.159280 | $1.676916 | -$0.380544 |
| claude-opus-5-5 | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1400264 | 43078 | $5.601056 | $0.861560 | $6.462616 | $1.699428 |
| claude-opus-5-5 | toon | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 174737 | 8012 | $0.698948 | $0.160240 | $0.859188 | $0.437184 |
| claude-opus-5-5 | terset | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1220011 | 43496 | $4.880044 | $0.869920 | $5.749964 | $2.412080 |
| claude-opus-5-5 | terset | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 166250 | 7911 | $0.665000 | $0.158220 | $0.823220 | $0.473152 |
| claude-opus-5-5 | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 471529 | 6366 | $1.886116 | $0.127320 | $2.013436 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 637374 | 5984 | $2.549496 | $0.119680 | $2.669176 | -$0.655740 |
| claude-opus-5-5 | toon | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 431800 | 4979 | $1.727200 | $0.099580 | $1.826780 | $0.186656 |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 6221 | $1.468900 | $0.124420 | $1.593320 | $0.420116 |
| claude-opus-5-5 | json-compact | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 102524 | 8140 | $0.410096 | $0.162800 | $0.572896 | $0.000000 |
| claude-opus-5-5 | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 142454 | 8227 | $0.569816 | $0.164540 | $0.734356 | -$0.161460 |
| claude-opus-5-5 | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 55754 | 8333 | $0.223016 | $0.166660 | $0.389676 | $0.183220 |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 8202 | $0.202736 | $0.164040 | $0.366776 | $0.206120 |
| claude-opus-5-5 | json-compact | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 562092 | 16588 | $2.248368 | $0.331760 | $2.580128 | $0.000000 |
| claude-opus-5-5 | json-pretty | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 681420 | 16932 | $2.725680 | $0.338640 | $3.064320 | -$0.484192 |
| claude-opus-5-5 | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 385278 | 13825 | $1.541112 | $0.276500 | $1.817612 | $0.762516 |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 14007 | $1.505208 | $0.280140 | $1.785348 | $0.794780 |
| claude-opus-5-5 | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 221159 | 7810 | $0.884636 | $0.156200 | $1.040836 | $0.000000 |
| claude-opus-5-5 | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 282509 | 8202 | $1.130036 | $0.164040 | $1.294076 | -$0.253240 |
| claude-opus-5-5 | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 236309 | 7391 | $0.945236 | $0.147820 | $1.093056 | -$0.052220 |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 149009 | 6451 | $0.596036 | $0.129020 | $0.725056 | $0.315780 |
| claude-opus-5-5 | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 34933 | 346 | $0.139732 | $0.006920 | $0.146652 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 46185 | 137 | $0.184740 | $0.002740 | $0.187480 | -$0.040828 |
| claude-opus-5-5 | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 36499 | 125 | $0.145996 | $0.002500 | $0.148496 | -$0.001844 |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35919 | 154 | $0.143676 | $0.003080 | $0.146756 | -$0.000104 |
| claude-opus-5-5 | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 39017 | 100 | $0.156068 | $0.002000 | $0.158068 | $0.000000 |
| claude-opus-5-5 | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 48707 | 135 | $0.194828 | $0.002700 | $0.197528 | -$0.039460 |
| claude-opus-5-5 | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 24703 | 197 | $0.098812 | $0.003940 | $0.102752 | $0.055316 |
| claude-opus-5-5 | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 22629 | 231 | $0.090516 | $0.004620 | $0.095136 | $0.062932 |
| claude-opus-5-5 | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 76919 | 541 | $0.307676 | $0.010820 | $0.318496 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 105917 | 658 | $0.423668 | $0.013160 | $0.436828 | -$0.118332 |
| claude-opus-5-5 | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 49343 | 91 | $0.197372 | $0.001820 | $0.199192 | $0.119304 |
| claude-opus-5-5 | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 46787 | 91 | $0.187148 | $0.001820 | $0.188968 | $0.129528 |
| claude-opus-5-5 | json-compact | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1599 | 43 | $0.006396 | $0.000860 | $0.007256 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 2090 | 4 | $0.008360 | $0.000080 | $0.008440 | -$0.001184 |
| claude-opus-5-5 | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1178 | 71 | $0.004712 | $0.001420 | $0.006132 | $0.001124 |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 104 | $0.004204 | $0.002080 | $0.006284 | $0.000972 |
| claude-opus-5-5 | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1409 | 4 | $0.005636 | $0.000080 | $0.005716 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1828 | 4 | $0.007312 | $0.000080 | $0.007392 | -$0.001676 |
| claude-opus-5-5 | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 1069 | 23 | $0.004276 | $0.000460 | $0.004736 | $0.000980 |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 26 | $0.003780 | $0.000520 | $0.004300 | $0.001416 |
| claude-opus-5-5 | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1799 | 88 | $0.007196 | $0.001760 | $0.008956 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 2362 | 4 | $0.009448 | $0.000080 | $0.009528 | -$0.000572 |
| claude-opus-5-5 | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1297 | 23 | $0.005188 | $0.000460 | $0.005648 | $0.003308 |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 23 | $0.004668 | $0.000460 | $0.005128 | $0.003828 |
| claude-opus-5-5 | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1592 | 4 | $0.006368 | $0.000080 | $0.006448 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 2080 | 21 | $0.008320 | $0.000420 | $0.008740 | -$0.002292 |
| claude-opus-5-5 | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1175 | 4 | $0.004700 | $0.000080 | $0.004780 | $0.001668 |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 35 | $0.004192 | $0.000700 | $0.004892 | $0.001556 |
| claude-opus-5-5 | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1531 | 33 | $0.006124 | $0.000660 | $0.006784 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 2010 | 41 | $0.008040 | $0.000820 | $0.008860 | -$0.002076 |
| claude-opus-5-5 | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1122 | 4 | $0.004488 | $0.000080 | $0.004568 | $0.002216 |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 40 | $0.003980 | $0.000800 | $0.004780 | $0.002004 |
