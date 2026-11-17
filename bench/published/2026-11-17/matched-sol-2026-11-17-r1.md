# Accuracy benchmark: matched-sol-2026-11-17-r1

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
| gpt-6.1-sol | json-compact | ALL | 236 | 244 | 96.72% | 93.66% to 98.33% | 1158229 | 17978 | $2.316458 | $0.179780 | $2.496238 | $0.000000 |
| gpt-6.1-sol | json-compact | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 165713 | 3170 | $0.331426 | $0.031700 | $0.363126 | $0.000000 |
| gpt-6.1-sol | json-pretty | ALL | 237 | 244 | 97.13% | 94.20% to 98.60% | 1696152 | 16258 | $3.392304 | $0.162580 | $3.554884 | -$1.058646 |
| gpt-6.1-sol | json-pretty | tabular | 39 | 41 | 95.12% | 83.86% to 98.65% | 264400 | 2809 | $0.528800 | $0.028090 | $0.556890 | -$0.193764 |
| gpt-6.1-sol | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1020628 | 15081 | $2.041256 | $0.150810 | $2.192066 | $0.304172 |
| gpt-6.1-sol | toon | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 109256 | 3006 | $0.218512 | $0.030060 | $0.248572 | $0.114554 |
| gpt-6.1-sol | terset | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 842260 | 15342 | $1.684520 | $0.153420 | $1.837940 | $0.658298 |
| gpt-6.1-sol | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 97489 | 3129 | $0.194978 | $0.031290 | $0.226268 | $0.136858 |
| gpt-6.1-sol | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 291387 | 2354 | $0.582774 | $0.023540 | $0.606314 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 456781 | 2255 | $0.913562 | $0.022550 | $0.936112 | -$0.329798 |
| gpt-6.1-sol | toon | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 309632 | 2160 | $0.619264 | $0.021600 | $0.640864 | -$0.034550 |
| gpt-6.1-sol | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 236980 | 2129 | $0.473960 | $0.021290 | $0.495250 | $0.111064 |
| gpt-6.1-sol | json-compact | analytics | 28 | 30 | 93.33% | 78.68% to 98.15% | 73721 | 2872 | $0.147442 | $0.028720 | $0.176162 | $0.000000 |
| gpt-6.1-sol | json-pretty | analytics | 29 | 30 | 96.67% | 83.33% to 99.41% | 113531 | 2855 | $0.227062 | $0.028550 | $0.255612 | -$0.079450 |
| gpt-6.1-sol | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 51011 | 2763 | $0.102022 | $0.027630 | $0.129652 | $0.046510 |
| gpt-6.1-sol | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 45191 | 2892 | $0.090382 | $0.028920 | $0.119302 | $0.056860 |
| gpt-6.1-sol | json-compact | github | 30 | 33 | 90.91% | 76.43% to 96.86% | 387862 | 5772 | $0.775724 | $0.057720 | $0.833444 | $0.000000 |
| gpt-6.1-sol | json-pretty | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 509962 | 5276 | $1.019924 | $0.052760 | $1.072684 | -$0.239240 |
| gpt-6.1-sol | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 300940 | 4674 | $0.601880 | $0.046740 | $0.648620 | $0.184824 |
| gpt-6.1-sol | terset | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 289258 | 4557 | $0.578516 | $0.045570 | $0.624086 | $0.209358 |
| gpt-6.1-sol | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 147793 | 3036 | $0.295586 | $0.030360 | $0.325946 | $0.000000 |
| gpt-6.1-sol | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 206773 | 2673 | $0.413546 | $0.026730 | $0.440276 | -$0.114330 |
| gpt-6.1-sol | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 178393 | 2088 | $0.356786 | $0.020880 | $0.377666 | -$0.051720 |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 108793 | 2245 | $0.217586 | $0.022450 | $0.240036 | $0.085910 |
| gpt-6.1-sol | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 19170 | 200 | $0.038340 | $0.002000 | $0.040340 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 29523 | 158 | $0.059046 | $0.001580 | $0.060626 | -$0.020286 |
| gpt-6.1-sol | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 22128 | 158 | $0.044256 | $0.001580 | $0.045836 | -$0.005496 |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20214 | 158 | $0.040428 | $0.001580 | $0.042008 | -$0.001668 |
| gpt-6.1-sol | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 23401 | 235 | $0.046802 | $0.002350 | $0.049152 | $0.000000 |
| gpt-6.1-sol | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 33754 | 100 | $0.067508 | $0.001000 | $0.068508 | -$0.019356 |
| gpt-6.1-sol | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 17757 | 100 | $0.035514 | $0.001000 | $0.036514 | $0.012638 |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 | $0.016990 |
| gpt-6.1-sol | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 44726 | 267 | $0.089452 | $0.002670 | $0.092122 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 74552 | 107 | $0.149104 | $0.001070 | $0.150174 | -$0.058052 |
| gpt-6.1-sol | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 28112 | 107 | $0.056224 | $0.001070 | $0.057294 | $0.034828 |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 | $0.039184 |
| gpt-6.1-sol | json-compact | structural-validation-control | 0 | 1 | 0.00% | 0.00% to 79.35% | 898 | 52 | $0.001796 | $0.000520 | $0.002316 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1385 | 5 | $0.002770 | $0.000050 | $0.002820 | -$0.000504 |
| gpt-6.1-sol | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 685 | 5 | $0.001370 | $0.000050 | $0.001420 | $0.000896 |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 5 | $0.001138 | $0.000050 | $0.001188 | $0.001128 |
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
| gpt-6.1-sol | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1336 | 5 | $0.002672 | $0.000050 | $0.002722 | -$0.000950 |
| gpt-6.1-sol | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 656 | 5 | $0.001312 | $0.000050 | $0.001362 | $0.000410 |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 | $0.000642 |
