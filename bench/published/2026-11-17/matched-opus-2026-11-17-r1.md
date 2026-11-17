# Accuracy benchmark: matched-opus-2026-11-17-r1

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
| claude-opus-5-5 | json-compact | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 1796661 | 49471 | $7.186644 | $0.989420 | $8.176064 | $0.000000 |
| claude-opus-5-5 | json-compact | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 280558 | 8394 | $1.122232 | $0.167880 | $1.290112 | $0.000000 |
| claude-opus-5-5 | json-pretty | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 2334345 | 46924 | $9.337380 | $0.938480 | $10.275860 | -$2.099796 |
| claude-opus-5-5 | json-pretty | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 379409 | 7703 | $1.517636 | $0.154060 | $1.671696 | -$0.381584 |
| claude-opus-5-5 | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1400264 | 44705 | $5.601056 | $0.894100 | $6.495156 | $1.680908 |
| claude-opus-5-5 | toon | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 174737 | 8562 | $0.698948 | $0.171240 | $0.870188 | $0.419924 |
| claude-opus-5-5 | terset | ALL | 243 | 244 | 99.59% | 97.72% to 99.93% | 1219159 | 44481 | $4.876636 | $0.889620 | $5.766256 | $2.409808 |
| claude-opus-5-5 | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 166250 | 8061 | $0.665000 | $0.161220 | $0.826220 | $0.463892 |
| claude-opus-5-5 | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 471529 | 6516 | $1.886116 | $0.130320 | $2.016436 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 637374 | 6065 | $2.549496 | $0.121300 | $2.670796 | -$0.654360 |
| claude-opus-5-5 | toon | nested | 40 | 41 | 97.56% | 87.40% to 99.57% | 431800 | 5004 | $1.727200 | $0.100080 | $1.827280 | $0.189156 |
| claude-opus-5-5 | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 367225 | 6209 | $1.468900 | $0.124180 | $1.593080 | $0.423356 |
| claude-opus-5-5 | json-compact | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 102524 | 7663 | $0.410096 | $0.153260 | $0.563356 | $0.000000 |
| claude-opus-5-5 | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 142454 | 7372 | $0.569816 | $0.147440 | $0.717256 | -$0.153900 |
| claude-opus-5-5 | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 55754 | 7639 | $0.223016 | $0.152780 | $0.375796 | $0.187560 |
| claude-opus-5-5 | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 50684 | 7864 | $0.202736 | $0.157280 | $0.360016 | $0.203340 |
| claude-opus-5-5 | json-compact | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 562092 | 17289 | $2.248368 | $0.345780 | $2.594148 | $0.000000 |
| claude-opus-5-5 | json-pretty | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 681420 | 16496 | $2.725680 | $0.329920 | $3.055600 | -$0.461452 |
| claude-opus-5-5 | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 385278 | 14731 | $1.541112 | $0.294620 | $1.835732 | $0.758416 |
| claude-opus-5-5 | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 376302 | 13729 | $1.505208 | $0.274580 | $1.779788 | $0.814360 |
| claude-opus-5-5 | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 221159 | 8444 | $0.884636 | $0.168880 | $1.053516 | $0.000000 |
| claude-opus-5-5 | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 282509 | 8171 | $1.130036 | $0.163420 | $1.293456 | -$0.239940 |
| claude-opus-5-5 | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 236309 | 7926 | $0.945236 | $0.158520 | $1.103756 | -$0.050240 |
| claude-opus-5-5 | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 148679 | 7776 | $0.594716 | $0.155520 | $0.750236 | $0.303280 |
| claude-opus-5-5 | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 34933 | 202 | $0.139732 | $0.004040 | $0.143772 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 46185 | 243 | $0.184740 | $0.004860 | $0.189600 | -$0.045828 |
| claude-opus-5-5 | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 36499 | 191 | $0.145996 | $0.003820 | $0.149816 | -$0.006044 |
| claude-opus-5-5 | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 35397 | 136 | $0.141588 | $0.002720 | $0.144308 | -$0.000536 |
| claude-opus-5-5 | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 39017 | 124 | $0.156068 | $0.002480 | $0.158548 | $0.000000 |
| claude-opus-5-5 | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 48707 | 142 | $0.194828 | $0.002840 | $0.197668 | -$0.039120 |
| claude-opus-5-5 | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 24703 | 335 | $0.098812 | $0.006700 | $0.105512 | $0.053036 |
| claude-opus-5-5 | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 22629 | 400 | $0.090516 | $0.008000 | $0.098516 | $0.060032 |
| claude-opus-5-5 | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 76919 | 663 | $0.307676 | $0.013260 | $0.320936 | $0.000000 |
| claude-opus-5-5 | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 105917 | 658 | $0.423668 | $0.013160 | $0.436828 | -$0.115892 |
| claude-opus-5-5 | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 49343 | 155 | $0.197372 | $0.003100 | $0.200472 | $0.120464 |
| claude-opus-5-5 | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 46787 | 143 | $0.187148 | $0.002860 | $0.190008 | $0.130928 |
| claude-opus-5-5 | json-compact | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1599 | 59 | $0.006396 | $0.001180 | $0.007576 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 2090 | 4 | $0.008360 | $0.000080 | $0.008440 | -$0.000864 |
| claude-opus-5-5 | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1178 | 71 | $0.004712 | $0.001420 | $0.006132 | $0.001444 |
| claude-opus-5-5 | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1051 | 4 | $0.004204 | $0.000080 | $0.004284 | $0.003292 |
| claude-opus-5-5 | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1409 | 4 | $0.005636 | $0.000080 | $0.005716 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1828 | 4 | $0.007312 | $0.000080 | $0.007392 | -$0.001676 |
| claude-opus-5-5 | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 1069 | 4 | $0.004276 | $0.000080 | $0.004356 | $0.001360 |
| claude-opus-5-5 | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 945 | 27 | $0.003780 | $0.000540 | $0.004320 | $0.001396 |
| claude-opus-5-5 | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1799 | 53 | $0.007196 | $0.001060 | $0.008256 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 2362 | 4 | $0.009448 | $0.000080 | $0.009528 | -$0.001272 |
| claude-opus-5-5 | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1297 | 29 | $0.005188 | $0.000580 | $0.005768 | $0.002488 |
| claude-opus-5-5 | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 1167 | 53 | $0.004668 | $0.001060 | $0.005728 | $0.002528 |
| claude-opus-5-5 | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1592 | 22 | $0.006368 | $0.000440 | $0.006808 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 2080 | 22 | $0.008320 | $0.000440 | $0.008760 | -$0.001952 |
| claude-opus-5-5 | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1175 | 54 | $0.004700 | $0.001080 | $0.005780 | $0.001028 |
| claude-opus-5-5 | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1048 | 35 | $0.004192 | $0.000700 | $0.004892 | $0.001916 |
| claude-opus-5-5 | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1531 | 38 | $0.006124 | $0.000760 | $0.006884 | $0.000000 |
| claude-opus-5-5 | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 2010 | 40 | $0.008040 | $0.000800 | $0.008840 | -$0.001956 |
| claude-opus-5-5 | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1122 | 4 | $0.004488 | $0.000080 | $0.004568 | $0.002316 |
| claude-opus-5-5 | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 995 | 44 | $0.003980 | $0.000880 | $0.004860 | $0.002024 |
