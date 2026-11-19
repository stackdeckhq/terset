# Accuracy benchmark: accuracy-sol-2026-11-19

Status: complete. Mode: http. Recorded 976/976 calls.
Results are published as measured.
Stop reason: none.

Input reservation exceeded: 0 calls.

Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.
Dropped incomplete questions: 0 (model gpt-6.1-sol).

API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.

Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.

| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-6.1-sol | json-compact | ALL | 237 | 244 | 97.13% | 94.20% to 98.60% | 1158229 | 18464 | $2.316458 | $0.184640 | $2.501098 | $0.000000 |
| gpt-6.1-sol | json-compact | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 165713 | 3080 | $0.331426 | $0.030800 | $0.362226 | $0.000000 |
| gpt-6.1-sol | json-pretty | ALL | 238 | 244 | 97.54% | 94.74% to 98.87% | 1696152 | 17258 | $3.392304 | $0.172580 | $3.564884 | -$1.063786 |
| gpt-6.1-sol | json-pretty | tabular | 39 | 41 | 95.12% | 83.86% to 98.65% | 264400 | 3042 | $0.528800 | $0.030420 | $0.559220 | -$0.196994 |
| gpt-6.1-sol | toon | ALL | 238 | 244 | 97.54% | 94.74% to 98.87% | 1020628 | 15273 | $2.041256 | $0.152730 | $2.193986 | $0.307112 |
| gpt-6.1-sol | toon | tabular | 38 | 41 | 92.68% | 80.57% to 97.48% | 109256 | 2802 | $0.218512 | $0.028020 | $0.246532 | $0.115694 |
| gpt-6.1-sol | terset | ALL | 243 | 244 | 99.59% | 97.72% to 99.93% | 843325 | 15402 | $1.686650 | $0.154020 | $1.840670 | $0.660428 |
| gpt-6.1-sol | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 97489 | 2884 | $0.194978 | $0.028840 | $0.223818 | $0.138408 |
| gpt-6.1-sol | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 291387 | 2334 | $0.582774 | $0.023340 | $0.606114 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 456781 | 2018 | $0.913562 | $0.020180 | $0.933742 | -$0.327628 |
| gpt-6.1-sol | toon | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 309632 | 2041 | $0.619264 | $0.020410 | $0.639674 | -$0.033560 |
| gpt-6.1-sol | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 236980 | 2245 | $0.473960 | $0.022450 | $0.496410 | $0.109704 |
| gpt-6.1-sol | json-compact | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 73721 | 3037 | $0.147442 | $0.030370 | $0.177812 | $0.000000 |
| gpt-6.1-sol | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 113531 | 2954 | $0.227062 | $0.029540 | $0.256602 | -$0.078790 |
| gpt-6.1-sol | toon | analytics | 29 | 30 | 96.67% | 83.33% to 99.41% | 51011 | 2905 | $0.102022 | $0.029050 | $0.131072 | $0.046740 |
| gpt-6.1-sol | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 45191 | 2918 | $0.090382 | $0.029180 | $0.119562 | $0.058250 |
| gpt-6.1-sol | json-compact | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 387862 | 5763 | $0.775724 | $0.057630 | $0.833354 | $0.000000 |
| gpt-6.1-sol | json-pretty | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 509962 | 5893 | $1.019924 | $0.058930 | $1.078854 | -$0.245500 |
| gpt-6.1-sol | toon | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 300940 | 4893 | $0.601880 | $0.048930 | $0.650810 | $0.182544 |
| gpt-6.1-sol | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 289258 | 4738 | $0.578516 | $0.047380 | $0.625896 | $0.207458 |
| gpt-6.1-sol | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 147793 | 3245 | $0.295586 | $0.032450 | $0.328036 | $0.000000 |
| gpt-6.1-sol | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 206773 | 2861 | $0.413546 | $0.028610 | $0.442156 | -$0.114120 |
| gpt-6.1-sol | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 178393 | 2242 | $0.356786 | $0.022420 | $0.379206 | -$0.051170 |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 109423 | 2227 | $0.218846 | $0.022270 | $0.241116 | $0.086920 |
| gpt-6.1-sol | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 19170 | 253 | $0.038340 | $0.002530 | $0.040870 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 29523 | 158 | $0.059046 | $0.001580 | $0.060626 | -$0.019756 |
| gpt-6.1-sol | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 22128 | 158 | $0.044256 | $0.001580 | $0.045836 | -$0.004966 |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20649 | 158 | $0.041298 | $0.001580 | $0.042878 | -$0.002008 |
| gpt-6.1-sol | json-compact | keyed | 16 | 17 | 94.12% | 73.02% to 98.95% | 23401 | 357 | $0.046802 | $0.003570 | $0.050372 | $0.000000 |
| gpt-6.1-sol | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 33754 | 154 | $0.067508 | $0.001540 | $0.069048 | -$0.018676 |
| gpt-6.1-sol | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 17757 | 100 | $0.035514 | $0.001000 | $0.036514 | $0.013858 |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 | $0.018210 |
| gpt-6.1-sol | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 44726 | 279 | $0.089452 | $0.002790 | $0.092242 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 74552 | 153 | $0.149104 | $0.001530 | $0.150634 | -$0.058392 |
| gpt-6.1-sol | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 28112 | 107 | $0.056224 | $0.001070 | $0.057294 | $0.034948 |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 | $0.039304 |
| gpt-6.1-sol | json-compact | structural-validation-control | 0 | 1 | 0.00% | 0.00% to 79.35% | 898 | 55 | $0.001796 | $0.000550 | $0.002346 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1385 | 5 | $0.002770 | $0.000050 | $0.002820 | -$0.000474 |
| gpt-6.1-sol | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 685 | 5 | $0.001370 | $0.000050 | $0.001420 | $0.000926 |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 5 | $0.001138 | $0.000050 | $0.001188 | $0.001158 |
| gpt-6.1-sol | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 785 | 5 | $0.001570 | $0.000050 | $0.001620 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1200 | 5 | $0.002400 | $0.000050 | $0.002450 | -$0.000830 |
| gpt-6.1-sol | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 615 | 5 | $0.001230 | $0.000050 | $0.001280 | $0.000340 |
| gpt-6.1-sol | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 506 | 5 | $0.001012 | $0.000050 | $0.001062 | $0.000558 |
| gpt-6.1-sol | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1019 | 46 | $0.002038 | $0.000460 | $0.002498 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1578 | 5 | $0.003156 | $0.000050 | $0.003206 | -$0.000708 |
| gpt-6.1-sol | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 761 | 5 | $0.001522 | $0.000050 | $0.001572 | $0.000926 |
| gpt-6.1-sol | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 639 | 5 | $0.001278 | $0.000050 | $0.001328 | $0.001170 |
| gpt-6.1-sol | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 893 | 5 | $0.001786 | $0.000050 | $0.001836 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1377 | 5 | $0.002754 | $0.000050 | $0.002804 | -$0.000968 |
| gpt-6.1-sol | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 682 | 5 | $0.001364 | $0.000050 | $0.001414 | $0.000422 |
| gpt-6.1-sol | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 566 | 5 | $0.001132 | $0.000050 | $0.001182 | $0.000654 |
| gpt-6.1-sol | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 861 | 5 | $0.001722 | $0.000050 | $0.001772 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1336 | 5 | $0.002672 | $0.000050 | $0.002722 | -$0.000950 |
| gpt-6.1-sol | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 656 | 5 | $0.001312 | $0.000050 | $0.001362 | $0.000410 |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 | $0.000642 |
