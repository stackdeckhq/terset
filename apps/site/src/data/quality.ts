// Measured results for the short-handles technique. Copied from one
// development measurement: a file-organizing task with 30 to 100 items,
// 24 runs per arm. These are answer counts, not token counts.

export const RUNS_PER_ARM = 24;

export interface QualityArm {
  readonly label: string;
  /** Runs whose answer the task's checker accepted. */
  readonly accepted: number;
  /** Runs that failed because the answer named an id that was not in the input. */
  readonly wrongId: number | null;
}

export const QUALITY_ARMS: readonly QualityArm[] = [
  { label: 'JSON, long ids', accepted: 10, wrongId: 12 },
  { label: 'JSON, short handles', accepted: 19, wrongId: 0 },
  { label: 'Terset, short handles', accepted: 16, wrongId: 0 },
  { label: 'JSON, handles and repair', accepted: 24, wrongId: 0 },
  { label: 'Terset, handles and repair', accepted: 24, wrongId: 0 },
];

/** Text with hard characters kept every original name byte for byte, in every arm. */
export const NAMES_KEPT = { kept: 132, of: 132 } as const;

export const QUALITY_LIMITS = 'One task, one model, reasoning off, 24 runs per arm. The repository does not record the Terset format. Production behavior was not measured.';

function accepted(label: string): number {
  const arm = QUALITY_ARMS.find((item) => item.label === label);
  if (arm === undefined) throw new Error(`No quality arm "${label}"`);
  return arm.accepted;
}

/** The measured result in two sentences, for the agent docs. */
export const QUALITY_SUMMARY =
  `Measured once, on a file-organizing task with 30 to 100 items, ${String(RUNS_PER_ARM)} runs per arm: JSON with long ids gave ${String(accepted('JSON, long ids'))} accepted answers, JSON with handles ${String(accepted('JSON, short handles'))}, Terset with handles ${String(accepted('Terset, short handles'))}. ` +
  `With handles and rule-based repair of small slips, JSON gave ${String(accepted('JSON, handles and repair'))} and Terset ${String(accepted('Terset, handles and repair'))}.`;

export const QUALITY_FAIRNESS ='Handles and repair help JSON as much as Terset. The layout alone does not give better answers.';
