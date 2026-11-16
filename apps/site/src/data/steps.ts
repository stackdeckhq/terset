// The eight steps of the home page, in order. The rail, the mobile strip and
// the sections all read this list.

export const STEPS = [
  { id: 'b1', label: 'Have JSON rows' },
  { id: 'b2', label: 'Encode once' },
  { id: 'b3', label: 'Read the table' },
  { id: 'b4', label: 'Uneven rows fit' },
  { id: 'b5', label: 'Nothing is lost' },
  { id: 'b6', label: 'Count tokens' },
  { id: 'b7', label: 'Prompt it' },
  { id: 'b8', label: 'Hand it to an agent' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
export const STEP_IDS: readonly StepId[] = STEPS.map((step) => step.id);
