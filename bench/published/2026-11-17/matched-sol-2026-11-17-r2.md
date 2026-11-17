# Accuracy benchmark: matched-sol-2026-11-17-r2

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
| gpt-6.1-sol | json-compact | ALL | 234 | 244 | 95.90% | 92.62% to 97.76% | 1158229 | 17458 | $2.316458 | $0.174580 | $2.491038 | $0.000000 |
| gpt-6.1-sol | json-compact | tabular | 38 | 41 | 92.68% | 80.57% to 97.48% | 165713 | 3204 | $0.331426 | $0.032040 | $0.363466 | $0.000000 |
| gpt-6.1-sol | json-pretty | ALL | 238 | 244 | 97.54% | 94.74% to 98.87% | 1696152 | 16907 | $3.392304 | $0.169070 | $3.561374 | -$1.070336 |
| gpt-6.1-sol | json-pretty | tabular | 39 | 41 | 95.12% | 83.86% to 98.65% | 264400 | 2897 | $0.528800 | $0.028970 | $0.557770 | -$0.194304 |
| gpt-6.1-sol | toon | ALL | 242 | 244 | 99.18% | 97.06% to 99.77% | 1020628 | 15751 | $2.041256 | $0.157510 | $2.198766 | $0.292272 |
| gpt-6.1-sol | toon | tabular | 40 | 41 | 97.56% | 87.40% to 99.57% | 109256 | 3051 | $0.218512 | $0.030510 | $0.249022 | $0.114444 |
| gpt-6.1-sol | terset | ALL | 241 | 244 | 98.77% | 96.45% to 99.58% | 842260 | 15968 | $1.684520 | $0.159680 | $1.844200 | $0.646838 |
| gpt-6.1-sol | terset | tabular | 41 | 41 | 100.00% | 91.43% to 100.00% | 97489 | 3047 | $0.194978 | $0.030470 | $0.225448 | $0.138018 |
| gpt-6.1-sol | json-compact | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 291387 | 2266 | $0.582774 | $0.022660 | $0.605434 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 456781 | 2116 | $0.913562 | $0.021160 | $0.934722 | -$0.329288 |
| gpt-6.1-sol | toon | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 309632 | 2186 | $0.619264 | $0.021860 | $0.641124 | -$0.035690 |
| gpt-6.1-sol | terset | nested | 41 | 41 | 100.00% | 91.43% to 100.00% | 236980 | 2079 | $0.473960 | $0.020790 | $0.494750 | $0.110684 |
| gpt-6.1-sol | json-compact | analytics | 28 | 30 | 93.33% | 78.68% to 98.15% | 73721 | 2885 | $0.147442 | $0.028850 | $0.176292 | $0.000000 |
| gpt-6.1-sol | json-pretty | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 113531 | 2821 | $0.227062 | $0.028210 | $0.255272 | -$0.078980 |
| gpt-6.1-sol | toon | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 51011 | 2961 | $0.102022 | $0.029610 | $0.131632 | $0.044660 |
| gpt-6.1-sol | terset | analytics | 30 | 30 | 100.00% | 88.65% to 100.00% | 45191 | 2722 | $0.090382 | $0.027220 | $0.117602 | $0.058690 |
| gpt-6.1-sol | json-compact | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 387862 | 5690 | $0.775724 | $0.056900 | $0.832624 | $0.000000 |
| gpt-6.1-sol | json-pretty | github | 31 | 33 | 93.94% | 80.39% to 98.32% | 509962 | 5785 | $1.019924 | $0.057850 | $1.077774 | -$0.245150 |
| gpt-6.1-sol | toon | github | 32 | 33 | 96.97% | 84.68% to 99.46% | 300940 | 4827 | $0.601880 | $0.048270 | $0.650150 | $0.182474 |
| gpt-6.1-sol | terset | github | 30 | 33 | 90.91% | 76.43% to 96.86% | 289258 | 5484 | $0.578516 | $0.054840 | $0.633356 | $0.199268 |
| gpt-6.1-sol | json-compact | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 147793 | 2620 | $0.295586 | $0.026200 | $0.321786 | $0.000000 |
| gpt-6.1-sol | json-pretty | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 206773 | 2785 | $0.413546 | $0.027850 | $0.441396 | -$0.119610 |
| gpt-6.1-sol | toon | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 178393 | 2336 | $0.356786 | $0.023360 | $0.380146 | -$0.058360 |
| gpt-6.1-sol | terset | event-logs | 30 | 30 | 100.00% | 88.65% to 100.00% | 108793 | 2229 | $0.217586 | $0.022290 | $0.239876 | $0.081910 |
| gpt-6.1-sol | json-compact | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 19170 | 213 | $0.038340 | $0.002130 | $0.040470 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 29523 | 158 | $0.059046 | $0.001580 | $0.060626 | -$0.020156 |
| gpt-6.1-sol | toon | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 22128 | 158 | $0.044256 | $0.001580 | $0.045836 | -$0.005366 |
| gpt-6.1-sol | terset | nested-config | 29 | 29 | 100.00% | 88.30% to 100.00% | 20214 | 158 | $0.040428 | $0.001580 | $0.042008 | -$0.001538 |
| gpt-6.1-sol | json-compact | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 23401 | 202 | $0.046802 | $0.002020 | $0.048822 | $0.000000 |
| gpt-6.1-sol | json-pretty | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 33754 | 166 | $0.067508 | $0.001660 | $0.069168 | -$0.020346 |
| gpt-6.1-sol | toon | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 17757 | 100 | $0.035514 | $0.001000 | $0.036514 | $0.012308 |
| gpt-6.1-sol | terset | keyed | 17 | 17 | 100.00% | 81.57% to 100.00% | 15581 | 100 | $0.031162 | $0.001000 | $0.032162 | $0.016660 |
| gpt-6.1-sol | json-compact | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 44726 | 305 | $0.089452 | $0.003050 | $0.092502 | $0.000000 |
| gpt-6.1-sol | json-pretty | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 74552 | 154 | $0.149104 | $0.001540 | $0.150644 | -$0.058142 |
| gpt-6.1-sol | toon | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 28112 | 107 | $0.056224 | $0.001070 | $0.057294 | $0.035208 |
| gpt-6.1-sol | terset | nested-group | 18 | 18 | 100.00% | 82.41% to 100.00% | 25934 | 107 | $0.051868 | $0.001070 | $0.052938 | $0.039564 |
| gpt-6.1-sol | json-compact | structural-validation-control | 0 | 1 | 0.00% | 0.00% to 79.35% | 898 | 41 | $0.001796 | $0.000410 | $0.002206 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 1385 | 5 | $0.002770 | $0.000050 | $0.002820 | -$0.000614 |
| gpt-6.1-sol | toon | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 685 | 5 | $0.001370 | $0.000050 | $0.001420 | $0.000786 |
| gpt-6.1-sol | terset | structural-validation-control | 1 | 1 | 100.00% | 20.65% to 100.00% | 569 | 22 | $0.001138 | $0.000220 | $0.001358 | $0.000848 |
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
| gpt-6.1-sol | json-compact | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 861 | 17 | $0.001722 | $0.000170 | $0.001892 | $0.000000 |
| gpt-6.1-sol | json-pretty | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 1336 | 5 | $0.002672 | $0.000050 | $0.002722 | -$0.000830 |
| gpt-6.1-sol | toon | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 656 | 5 | $0.001312 | $0.000050 | $0.001362 | $0.000530 |
| gpt-6.1-sol | terset | structural-validation-missing-fields | 1 | 1 | 100.00% | 20.65% to 100.00% | 540 | 5 | $0.001080 | $0.000050 | $0.001130 | $0.000762 |
