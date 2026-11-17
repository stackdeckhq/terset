# Accuracy benchmark: matched-opus-2026-11-17-r2

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
| claude-opus-5-5 | json-compact | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 1796661 | 48552 | $7.186644 | $0.971040 | $8.157684 | $0.000000 |
| claude-opus-5-5 | json-compact | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 280558 | 7727 | $1.122232 | $0.154540 | $1.276772 | $0.000000 |
| claude-opus-5-5 | json-pretty | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 2334345 | 48623 | $9.337380 | $0.972460 | $10.309840 | -$2.152156 |
| claude-opus-5-5 | json-pretty | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 379409 | 8891 | $1.517636 | $0.177820 | $1.695456 | -$0.418684 |
| claude-opus-5-5 | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1400264 | 43660 | $5.601056 | $0.873200 | $6.474256 | $1.683428 |
| claude-opus-5-5 | toon | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 174737 | 8652 | $0.698948 | $0.173040 | $0.871988 | $0.404784 |
| claude-opus-5-5 | terset | ALL | 243 | 244 | 99.59% | 97.72% to 99.93% | 1219159 | 44447 | $4.876636 | $0.888940 | $5.765576 | $2.392108 |
| claude-opus-5-5 | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 166250 | 8295 | $0.665000 | $0.165900 | $0.830900 | $0.445872 |
| claude-opus-5-5 | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 471529 | 6422 | $1.886116 | $0.128440 | $2.014556 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 637374 | 5854 | $2.549496 | $0.117080 | $2.666576 | -$0.652020 |
| claude-opus-5-5 | toon | nested | 40 | 41 | 97.56% | 87.40% to 99.57% | 431800 | 5657 | $1.727200 | $0.113140 | $1.840340 | $0.174216 |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 6095 | $1.468900 | $0.121900 | $1.590800 | $0.423756 |
| claude-opus-5-5 | json-compact | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 102524 | 8140 | $0.410096 | $0.162800 | $0.572896 | $0.000000 |
| claude-opus-5-5 | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 142454 | 8367 | $0.569816 | $0.167340 | $0.737156 | -$0.164260 |
| claude-opus-5-5 | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 55754 | 7947 | $0.223016 | $0.158940 | $0.381956 | $0.190940 |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 7903 | $0.202736 | $0.158060 | $0.360796 | $0.212100 |
| claude-opus-5-5 | json-compact | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 562092 | 16930 | $2.248368 | $0.338600 | $2.586968 | $0.000000 |
| claude-opus-5-5 | json-pretty | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 681420 | 15863 | $2.725680 | $0.317260 | $3.042940 | -$0.455972 |
| claude-opus-5-5 | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 385278 | 13229 | $1.541112 | $0.264580 | $1.805692 | $0.781276 |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 13738 | $1.505208 | $0.274760 | $1.779968 | $0.807000 |
| claude-opus-5-5 | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 221159 | 8192 | $0.884636 | $0.163840 | $1.048476 | $0.000000 |
| claude-opus-5-5 | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 282509 | 8711 | $1.130036 | $0.174220 | $1.304256 | -$0.255780 |
| claude-opus-5-5 | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 236309 | 7460 | $0.945236 | $0.149200 | $1.094436 | -$0.045960 |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 148679 | 7470 | $0.594716 | $0.149400 | $0.744116 | $0.304360 |
| claude-opus-5-5 | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 34933 | 237 | $0.139732 | $0.004740 | $0.144472 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 46185 | 156 | $0.184740 | $0.003120 | $0.187860 | -$0.043388 |
| claude-opus-5-5 | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 36499 | 106 | $0.145996 | $0.002120 | $0.148116 | -$0.003644 |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35397 | 180 | $0.141588 | $0.003600 | $0.145188 | -$0.000716 |
| claude-opus-5-5 | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 39017 | 97 | $0.156068 | $0.001940 | $0.158008 | $0.000000 |
| claude-opus-5-5 | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 48707 | 155 | $0.194828 | $0.003100 | $0.197928 | -$0.039920 |
| claude-opus-5-5 | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 24703 | 259 | $0.098812 | $0.005180 | $0.103992 | $0.054016 |
| claude-opus-5-5 | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 22629 | 365 | $0.090516 | $0.007300 | $0.097816 | $0.060192 |
| claude-opus-5-5 | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 76919 | 561 | $0.307676 | $0.011220 | $0.318896 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 105917 | 552 | $0.423668 | $0.011040 | $0.434708 | -$0.115812 |
| claude-opus-5-5 | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 49343 | 102 | $0.197372 | $0.002040 | $0.199412 | $0.119484 |
| claude-opus-5-5 | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 46787 | 150 | $0.187148 | $0.003000 | $0.190148 | $0.128748 |
| claude-opus-5-5 | json-compact | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1599 | 53 | $0.006396 | $0.001060 | $0.007456 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 2090 | 4 | $0.008360 | $0.000080 | $0.008440 | -$0.000984 |
| claude-opus-5-5 | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1178 | 126 | $0.004712 | $0.002520 | $0.007232 | $0.000224 |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 88 | $0.004204 | $0.001760 | $0.005964 | $0.001492 |
| claude-opus-5-5 | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1409 | 53 | $0.005636 | $0.001060 | $0.006696 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1828 | 4 | $0.007312 | $0.000080 | $0.007392 | -$0.000696 |
| claude-opus-5-5 | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 1069 | 23 | $0.004276 | $0.000460 | $0.004736 | $0.001960 |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 25 | $0.003780 | $0.000500 | $0.004280 | $0.002416 |
| claude-opus-5-5 | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1799 | 77 | $0.007196 | $0.001540 | $0.008736 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 2362 | 4 | $0.009448 | $0.000080 | $0.009528 | -$0.000792 |
| claude-opus-5-5 | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1297 | 32 | $0.005188 | $0.000640 | $0.005828 | $0.002908 |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 51 | $0.004668 | $0.001020 | $0.005688 | $0.003048 |
| claude-opus-5-5 | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1592 | 22 | $0.006368 | $0.000440 | $0.006808 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 2080 | 22 | $0.008320 | $0.000440 | $0.008760 | -$0.001952 |
| claude-opus-5-5 | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1175 | 63 | $0.004700 | $0.001260 | $0.005960 | $0.000848 |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 35 | $0.004192 | $0.000700 | $0.004892 | $0.001916 |
| claude-opus-5-5 | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1531 | 41 | $0.006124 | $0.000820 | $0.006944 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 2010 | 40 | $0.008040 | $0.000800 | $0.008840 | -$0.001896 |
| claude-opus-5-5 | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1122 | 4 | $0.004488 | $0.000080 | $0.004568 | $0.002376 |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 52 | $0.003980 | $0.001040 | $0.005020 | $0.001924 |
