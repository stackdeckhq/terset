import { z } from 'zod';
import type { CountInput } from './count-claude.ts';

function slug(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '');
}

/** Private source data is accepted here, but never copied into count output. */
export const NeutralInputsSchema = z.strictObject({
  cases: z.array(z.strictObject({
    name: z.string().trim().min(1).refine((name) => slug(name).length > 0, 'Name needs a letter or number'),
    data: z.union([z.record(z.string(), z.json()), z.array(z.json())]),
  })).min(1),
}).superRefine(({ cases }, context) => {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const row of cases) {
    if (names.has(row.name)) context.addIssue({ code: 'custom', message: 'Duplicate case names' });
    if (ids.has(slug(row.name))) context.addIssue({ code: 'custom', message: 'Case names produce duplicate slugs' });
    names.add(row.name);
    ids.add(slug(row.name));
  }
});

export function parseNeutralInputs(text: string): CountInput[] {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new Error('Invalid --inputs file: expected JSON with a cases array'); }
  const result = NeutralInputsSchema.safeParse(raw);
  if (!result.success) {
    // Schema issues can include private values. Report only the required shape.
    throw new Error('Invalid --inputs file: cases need unique names and slugs, object or array data, and no extra fields');
  }
  return result.data.cases.map(({ name, data }) => ({ id: `benchmark:${slug(name)}`, source: 'benchmark', name, value: data }));
}
