// Real public data the site shows: frozen files nobody tuned the encoder on,
// counted with o200k_base. `pnpm real` writes real-data.json. The file is typed
// without zod, so the browser skips it. data-check.ts proves it against RealDataSchema.
// Losses show as measured: a change too small to round shows in tokens.
import raw from './real-data.json' with { type: 'json' };
import { formatCount, pct } from './bench.ts';
import type { RealData } from './real-data-schema.ts';

/** The committed counts. */
export const REAL: RealData = raw;

const REAL_FILE = 'apps/site/src/data/real-data.json';
const REAL_RECORD = 'bench/data/real/README.md';

export const REAL_TABLE_HEAD = ['File', 'Terset', 'JSON compact', 'JSON pretty', 'TOON best', 'vs JSON compact', 'vs TOON'] as const;

/** One cell per REAL_TABLE_HEAD column, in the same order. */
export type RealTableRow = readonly [name: string, terset: string, json: string, jsonPretty: string, toon: string, vsJson: string, vsToon: string];

const tokenWord = (amount: number): string => (amount === 1 ? 'token' : 'tokens');

/** Signed change from `base` to Terset, like the sample table. When it rounds to 0.0% but the counts differ, the difference in tokens. */
export function realChange(terset: number, base: number): string {
  const change = pct(terset, base);
  const diff = terset - base;
  if (change !== '0.0%' || diff === 0) return change;
  return `${diff > 0 ? '+' : '−'}${formatCount(Math.abs(diff))} ${tokenWord(Math.abs(diff))}`;
}

export function realTableRows(data: RealData): readonly RealTableRow[] {
  return data.files.map((file) => [file.name, formatCount(file.terset), formatCount(file.json), formatCount(file.jsonPretty), formatCount(file.toon), realChange(file.terset, file.json), realChange(file.terset, file.toon)]);
}

/** "10.0% fewer tokens than X", "1 more token than X" or "as many tokens as X". */
function versus(terset: number, base: number, name: string): string {
  const diff = terset - base;
  if (diff === 0) return `as many tokens as ${name}`;
  const change = Math.abs(Math.round((diff / base) * 1000) / 10);
  const more = diff > 0 ? 'more' : 'fewer';
  if (change === 0) return `${formatCount(Math.abs(diff))} ${more} ${tokenWord(Math.abs(diff))} than ${name}`;
  return `${change.toFixed(1)}% ${more} tokens than ${name}`;
}

/** One line per file: Terset against compact JSON and against TOON, wins and losses alike. */
export function realLines(data: RealData): readonly string[] {
  return data.files.map((file) => `${file.name}: Terset has ${versus(file.terset, file.json, 'JSON compact')} and ${versus(file.terset, file.toon, 'TOON')}.`);
}

export function realIntro(data: RealData): string {
  return `The sample cases are made up. These ${String(data.files.length)} files are real public data, counted with ${data.tokenizer} the same way.`;
}

/** Where the data comes from, when it was frozen, and how it was counted. */
export function realMethod(data: RealData): string {
  const days = [...new Set(data.files.map((file) => file.fetched))].join(' and ');
  return `The files are the USGS earthquake feed for one day and the National Weather Service forecast grid for one square in Washington, DC. Both are US public domain. They were fetched and frozen on ${days}, before any count. The encoder and its rules line were not changed after, and nothing was tuned on them. \`pnpm real\` counts them as the sample table does: Terset includes rulesFor(text), and TOON is the smaller of its comma and tab forms. It writes \`${REAL_FILE}\`. Sources and hashes are in \`${REAL_RECORD}\`.`;
}
