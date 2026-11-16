// The accuracy formats and kinds of data, in the order the site shows them.
// Plain constants with no zod, so browser code can import them. accuracy-schema.ts builds on them.

/** One row per format, Terset first. */
export const ACCURACY_FORMATS = ['terset', 'json-compact', 'json-pretty', 'toon'] as const;

/** The run's data sets, one kind each, in the order the site shows them. The five structure checks come last. */
export const ACCURACY_KINDS = [
  'tabular',
  'analytics',
  'github',
  'event-logs',
  'nested',
  'nested-group',
  'keyed',
  'nested-config',
  'structure-control',
  'structure-truncated',
  'structure-extra-rows',
  'structure-width-mismatch',
  'structure-missing-fields',
] as const;
