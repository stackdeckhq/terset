# Accuracy benchmark: matched-opus-2026-11-17-r3

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
| claude-opus-5-5 | json-compact | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 1796661 | 49362 | $7.186644 | $0.987240 | $8.173884 | $0.000000 |
| claude-opus-5-5 | json-compact | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 280558 | 8270 | $1.122232 | $0.165400 | $1.287632 | $0.000000 |
| claude-opus-5-5 | json-pretty | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 2334345 | 46865 | $9.337380 | $0.937300 | $10.274680 | -$2.100796 |
| claude-opus-5-5 | json-pretty | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 379409 | 8011 | $1.517636 | $0.160220 | $1.677856 | -$0.390224 |
| claude-opus-5-5 | toon | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 1400264 | 42006 | $5.601056 | $0.840120 | $6.441176 | $1.732708 |
| claude-opus-5-5 | toon | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 174737 | 7954 | $0.698948 | $0.159080 | $0.858028 | $0.429604 |
| claude-opus-5-5 | terset | ALL | 243 | 244 | 99.59% | 97.72% to 99.93% | 1219159 | 45271 | $4.876636 | $0.905420 | $5.782056 | $2.391828 |
| claude-opus-5-5 | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 166250 | 7928 | $0.665000 | $0.158560 | $0.823560 | $0.464072 |
| claude-opus-5-5 | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 471529 | 6461 | $1.886116 | $0.129220 | $2.015336 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 637374 | 5764 | $2.549496 | $0.115280 | $2.664776 | -$0.649440 |
| claude-opus-5-5 | toon | nested | 40 | 41 | 97.56% | 87.40% to 99.57% | 431800 | 4781 | $1.727200 | $0.095620 | $1.822820 | $0.192516 |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 6638 | $1.468900 | $0.132760 | $1.601660 | $0.413676 |
| claude-opus-5-5 | json-compact | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 102524 | 8511 | $0.410096 | $0.170220 | $0.580316 | $0.000000 |
| claude-opus-5-5 | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 142454 | 8116 | $0.569816 | $0.162320 | $0.732136 | -$0.151820 |
| claude-opus-5-5 | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 55754 | 7568 | $0.223016 | $0.151360 | $0.374376 | $0.205940 |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 7941 | $0.202736 | $0.158820 | $0.361556 | $0.218760 |
| claude-opus-5-5 | json-compact | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 562092 | 17252 | $2.248368 | $0.345040 | $2.593408 | $0.000000 |
| claude-opus-5-5 | json-pretty | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 681420 | 16024 | $2.725680 | $0.320480 | $3.046160 | -$0.452752 |
| claude-opus-5-5 | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 385278 | 13758 | $1.541112 | $0.275160 | $1.816272 | $0.777136 |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 14513 | $1.505208 | $0.290260 | $1.795468 | $0.797940 |
| claude-opus-5-5 | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 221159 | 7826 | $0.884636 | $0.156520 | $1.041156 | $0.000000 |
| claude-opus-5-5 | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 282509 | 8146 | $1.130036 | $0.162920 | $1.292956 | -$0.251800 |
| claude-opus-5-5 | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 236309 | 7273 | $0.945236 | $0.145460 | $1.090696 | -$0.049540 |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 148679 | 7488 | $0.594716 | $0.149760 | $0.744476 | $0.296680 |
| claude-opus-5-5 | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 34933 | 235 | $0.139732 | $0.004700 | $0.144432 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 46185 | 128 | $0.184740 | $0.002560 | $0.187300 | -$0.042868 |
| claude-opus-5-5 | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 36499 | 106 | $0.145996 | $0.002120 | $0.148116 | -$0.003684 |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35397 | 192 | $0.141588 | $0.003840 | $0.145428 | -$0.000996 |
| claude-opus-5-5 | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 39017 | 124 | $0.156068 | $0.002480 | $0.158548 | $0.000000 |
| claude-opus-5-5 | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 48707 | 127 | $0.194828 | $0.002540 | $0.197368 | -$0.038820 |
| claude-opus-5-5 | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 24703 | 239 | $0.098812 | $0.004780 | $0.103592 | $0.054956 |
| claude-opus-5-5 | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 22629 | 280 | $0.090516 | $0.005600 | $0.096116 | $0.062432 |
| claude-opus-5-5 | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 76919 | 536 | $0.307676 | $0.010720 | $0.318396 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 105917 | 494 | $0.423668 | $0.009880 | $0.433548 | -$0.115152 |
| claude-opus-5-5 | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 49343 | 195 | $0.197372 | $0.003900 | $0.201272 | $0.117124 |
| claude-opus-5-5 | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 46787 | 91 | $0.187148 | $0.001820 | $0.188968 | $0.129428 |
| claude-opus-5-5 | json-compact | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1599 | 61 | $0.006396 | $0.001220 | $0.007616 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 2090 | 4 | $0.008360 | $0.000080 | $0.008440 | -$0.000824 |
| claude-opus-5-5 | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1178 | 69 | $0.004712 | $0.001380 | $0.006092 | $0.001524 |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 71 | $0.004204 | $0.001420 | $0.005624 | $0.001992 |
| claude-opus-5-5 | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1409 | 4 | $0.005636 | $0.000080 | $0.005716 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1828 | 4 | $0.007312 | $0.000080 | $0.007392 | -$0.001676 |
| claude-opus-5-5 | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 1069 | 23 | $0.004276 | $0.000460 | $0.004736 | $0.000980 |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 27 | $0.003780 | $0.000540 | $0.004320 | $0.001396 |
| claude-opus-5-5 | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1799 | 55 | $0.007196 | $0.001100 | $0.008296 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 2362 | 4 | $0.009448 | $0.000080 | $0.009528 | -$0.001232 |
| claude-opus-5-5 | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1297 | 32 | $0.005188 | $0.000640 | $0.005828 | $0.002468 |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 25 | $0.004668 | $0.000500 | $0.005168 | $0.003128 |
| claude-opus-5-5 | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1592 | 23 | $0.006368 | $0.000460 | $0.006828 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 2080 | 4 | $0.008320 | $0.000080 | $0.008400 | -$0.001572 |
| claude-opus-5-5 | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1175 | 4 | $0.004700 | $0.000080 | $0.004780 | $0.002048 |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 35 | $0.004192 | $0.000700 | $0.004892 | $0.001936 |
| claude-opus-5-5 | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1531 | 4 | $0.006124 | $0.000080 | $0.006204 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 2010 | 39 | $0.008040 | $0.000780 | $0.008820 | -$0.002616 |
| claude-opus-5-5 | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1122 | 4 | $0.004488 | $0.000080 | $0.004568 | $0.001636 |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 42 | $0.003980 | $0.000840 | $0.004820 | $0.001384 |
