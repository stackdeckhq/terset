# Accuracy benchmark: matched-sol-2026-11-17-r3

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
| gpt-6.1-sol | json-compact | ALL | 236 | 244 | 96.72% | 93.66% to 98.33% | 1158229 | 17653 | $2.316458 | $0.176530 | $2.492988 | $0.000000 |
| gpt-6.1-sol | json-compact | tabular | 39 | 41 | 95.12% | 83.86% to 98.65% | 165713 | 3103 | $0.331426 | $0.031030 | $0.362456 | $0.000000 |
| gpt-6.1-sol | json-pretty | ALL | 237 | 244 | 97.13% | 94.20% to 98.60% | 1696152 | 15951 | $3.392304 | $0.159510 | $3.551814 | -$1.058826 |
| gpt-6.1-sol | json-pretty | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 264400 | 2751 | $0.528800 | $0.027510 | $0.556310 | -$0.193854 |
| gpt-6.1-sol | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1020628 | 15710 | $2.041256 | $0.157100 | $2.198356 | $0.294632 |
| gpt-6.1-sol | toon | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 109256 | 2929 | $0.218512 | $0.029290 | $0.247802 | $0.114654 |
| gpt-6.1-sol | terset | ALL | 243 | 244 | 99.59% | 97.72% to 99.93% | 842260 | 16091 | $1.684520 | $0.160910 | $1.845430 | $0.647558 |
| gpt-6.1-sol | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 97489 | 3053 | $0.194978 | $0.030530 | $0.225508 | $0.136948 |
| gpt-6.1-sol | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 291387 | 2237 | $0.582774 | $0.022370 | $0.605144 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 456781 | 2023 | $0.913562 | $0.020230 | $0.933792 | -$0.328648 |
| gpt-6.1-sol | toon | nested | 40 | 41 | 97.56% | 87.40% to 99.57% | 309632 | 2220 | $0.619264 | $0.022200 | $0.641464 | -$0.036320 |
| gpt-6.1-sol | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 236980 | 2273 | $0.473960 | $0.022730 | $0.496690 | $0.108454 |
| gpt-6.1-sol | json-compact | analytics | 28 | 30 | 93.33% | 78.68% to 98.15% | 73721 | 3089 | $0.147442 | $0.030890 | $0.178332 | $0.000000 |
| gpt-6.1-sol | json-pretty | analytics | 29 | 30 | 96.67% | 83.33% to 99.41% | 113531 | 2730 | $0.227062 | $0.027300 | $0.254362 | -$0.076030 |
| gpt-6.1-sol | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 51011 | 3077 | $0.102022 | $0.030770 | $0.132792 | $0.045540 |
| gpt-6.1-sol | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 45191 | 2855 | $0.090382 | $0.028550 | $0.118932 | $0.059400 |
| gpt-6.1-sol | json-compact | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 387862 | 5471 | $0.775724 | $0.054710 | $0.830434 | $0.000000 |
| gpt-6.1-sol | json-pretty | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 509962 | 5228 | $1.019924 | $0.052280 | $1.072204 | -$0.241770 |
| gpt-6.1-sol | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 300940 | 5039 | $0.601880 | $0.050390 | $0.652270 | $0.178164 |
| gpt-6.1-sol | terset | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 289258 | 5224 | $0.578516 | $0.052240 | $0.630756 | $0.199678 |
| gpt-6.1-sol | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 147793 | 2986 | $0.295586 | $0.029860 | $0.325446 | $0.000000 |
| gpt-6.1-sol | json-pretty | event-logs | 29 | 30 | 96.67% | 83.33% to 99.41% | 206773 | 2773 | $0.413546 | $0.027730 | $0.441276 | -$0.115830 |
| gpt-6.1-sol | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 178393 | 2055 | $0.356786 | $0.020550 | $0.377336 | -$0.051890 |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 108793 | 2296 | $0.217586 | $0.022960 | $0.240546 | $0.084900 |
| gpt-6.1-sol | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 19170 | 209 | $0.038340 | $0.002090 | $0.040430 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 29523 | 158 | $0.059046 | $0.001580 | $0.060626 | -$0.020196 |
| gpt-6.1-sol | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 22128 | 158 | $0.044256 | $0.001580 | $0.045836 | -$0.005406 |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20214 | 158 | $0.040428 | $0.001580 | $0.042008 | -$0.001578 |
| gpt-6.1-sol | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 23401 | 248 | $0.046802 | $0.002480 | $0.049282 | $0.000000 |
| gpt-6.1-sol | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 33754 | 100 | $0.067508 | $0.001000 | $0.068508 | -$0.019226 |
| gpt-6.1-sol | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 17757 | 100 | $0.035514 | $0.001000 | $0.036514 | $0.012768 |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 | $0.017120 |
| gpt-6.1-sol | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 44726 | 285 | $0.089452 | $0.002850 | $0.092302 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 74552 | 151 | $0.149104 | $0.001510 | $0.150614 | -$0.058312 |
| gpt-6.1-sol | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 28112 | 107 | $0.056224 | $0.001070 | $0.057294 | $0.035008 |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 | $0.039364 |
| gpt-6.1-sol | json-compact | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 898 | 5 | $0.001796 | $0.000050 | $0.001846 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1385 | 5 | $0.002770 | $0.000050 | $0.002820 | -$0.000974 |
| gpt-6.1-sol | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 685 | 5 | $0.001370 | $0.000050 | $0.001420 | $0.000426 |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 5 | $0.001138 | $0.000050 | $0.001188 | $0.000658 |
| gpt-6.1-sol | json-compact | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 785 | 5 | $0.001570 | $0.000050 | $0.001620 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-truncated | 0 | 1 | 0.00% | 0.00% to 79.35% | 1200 | 5 | $0.002400 | $0.000050 | $0.002450 | -$0.000830 |
| gpt-6.1-sol | toon | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 615 | 5 | $0.001230 | $0.000050 | $0.001280 | $0.000340 |
| gpt-6.1-sol | terset | structural-validation-truncated | 1 | 1 | 100.00% | 20.65% to 100.00% | 506 | 5 | $0.001012 | $0.000050 | $0.001062 | $0.000558 |
| gpt-6.1-sol | json-compact | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1019 | 5 | $0.002038 | $0.000050 | $0.002088 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-extra-rows | 0 | 1 | 0.00% | 0.00% to 79.35% | 1578 | 5 | $0.003156 | $0.000050 | $0.003206 | -$0.001118 |
| gpt-6.1-sol | toon | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 761 | 5 | $0.001522 | $0.000050 | $0.001572 | $0.000516 |
| gpt-6.1-sol | terset | structural-validation-extra-rows | 1 | 1 | 100.00% | 20.65% to 100.00% | 639 | 5 | $0.001278 | $0.000050 | $0.001328 | $0.000760 |
| gpt-6.1-sol | json-compact | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 893 | 5 | $0.001786 | $0.000050 | $0.001836 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 1377 | 5 | $0.002754 | $0.000050 | $0.002804 | -$0.000968 |
| gpt-6.1-sol | toon | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 682 | 5 | $0.001364 | $0.000050 | $0.001414 | $0.000422 |
| gpt-6.1-sol | terset | structural-validation-width-mismatch | 1 | 1 | 100.00% | 20.65% to 100.00% | 566 | 5 | $0.001132 | $0.000050 | $0.001182 | $0.000654 |
| gpt-6.1-sol | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 861 | 5 | $0.001722 | $0.000050 | $0.001772 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1336 | 17 | $0.002672 | $0.000170 | $0.002842 | -$0.001070 |
| gpt-6.1-sol | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 656 | 5 | $0.001312 | $0.000050 | $0.001362 | $0.000410 |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 | $0.000642 |
