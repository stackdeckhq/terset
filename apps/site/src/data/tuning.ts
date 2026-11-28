// What the rules line was tuned on, and which results are not independent checks of it.
// The /benchmark page and /benchmark.md both read these notes.
import { ACCURACY } from './accuracy.ts';
import { formatCount } from './bench.ts';
import { STRESS, stressHeldOutNote } from './stress.ts';
import { SWEEP } from './sweep.ts';

/**
 * What the numbers are and are not checked against. /benchmark shows it in the Accuracy method
 * fold, /benchmark.md under the accuracy method; both sit after the sweep and real sections.
 */
export const TUNING_DETAIL = `The rules line was tuned with the ${String(SWEEP.cases.length)} sample case shapes and the TOON question set in view. So they are not independent checks of it. The sweep across ${formatCount(SWEEP.seeds)} seeds draws new data for the same shapes. ${stressHeldOutNote(STRESS)} The Real data section gives offline counts for Terset 1.2.`;

/**
 * The short form of TUNING_DETAIL, open near the first result on /benchmark: which results had
 * their inputs in view while the rules line was tuned, and which did not. Each fact is one the
 * repo records: the full note above, bench/data/stress/README.md and bench/data/real/README.md.
 */
export const TUNING_NOTE = `The rules line was tuned with the ${String(SWEEP.cases.length)} sample case shapes and the TOON question set behind this ${formatCount(ACCURACY.questions)}-question test in view. So these results are not independent checks of it. ${stressHeldOutNote(STRESS)} The Terset 1.1 runs on the real files used the same encoder and rules.`;
