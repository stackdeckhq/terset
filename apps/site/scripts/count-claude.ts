// Counts public inputs and optional private benchmark inputs. Importing makes no requests.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as o200kTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { stringify as yamlStringify } from 'yaml';
import { z } from 'zod';
import { ClaudeReadySchema } from '../src/data/claude-counts-schema.ts';
import type { ClaudeReady, ClaudeRow } from '../src/data/claude-counts-schema.ts';
import { DOC_EXAMPLES, SAMPLE_IDS, SAMPLE_LABELS, SAMPLES } from '../src/data/samples.ts';
import { rulesFor, decode, encode } from '../src/lib/format.ts';
import type { JsonObject, JsonRoot, JsonValue } from '../src/lib/format.ts';
import { parseNeutralInputs } from './claude-inputs.ts';

export const ENDPOINT = '/v1/messages/count_tokens';
export const METHOD = 'One user message per text. Subtract the same-run input_tokens for "a", then add 1, assuming "a" is one Claude text token. This estimates text tokens by removing fixed message framing. TOON is the smaller count of default and tab forms. Terset is rulesFor(text), a newline, then encoded data in one message; when rulesFor(text) is empty it is the encoded data alone. CSV is a root record list or the only field of an object; nested cells use compact JSON, null and absent cells are empty. csvExact compares the record list with cells inferred as JSON scalar values or plain text. o200kJson is compact JSON counted locally with o200k_base for input verification. Counts do not measure answer quality.';
const OUTPUT = new URL('../src/data/claude-counts.json', import.meta.url);
const ResponseSchema = z.object({ input_tokens: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) });

export interface CountInput {
  readonly id: string;
  readonly source: ClaudeRow['source'];
  readonly name: string;
  readonly value: JsonRoot;
}

export function publicInputs(): CountInput[] {
  return [
    ...SAMPLE_IDS.map((id): CountInput => ({ id: `sample:${id}`, source: 'sample', name: SAMPLE_LABELS[id], value: SAMPLES[id] })),
    ...Object.entries(DOC_EXAMPLES).map(([id, value]): CountInput => ({ id: `example:${id}`, source: 'example', name: id, value })),
  ];
}

function isRecord(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function recordList(value: JsonRoot): JsonObject[] | null {
  const fields = Array.isArray(value) ? [] : Object.values(value);
  const list = Array.isArray(value) ? value : fields.length === 1 ? fields[0] : undefined;
  if (!Array.isArray(list) || list.length === 0 || !list.every(isRecord)) return null;
  return list;
}

/** Plain CSV carries no type information. Only a single record list applies. */
export function csvText(value: JsonRoot): string | null {
  const list = recordList(value);
  if (list === null) return null;
  const keys = [...new Set(list.flatMap((row) => Object.keys(row)))];
  if (keys.length === 0) return null;
  const cell = (text: string): string => /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  const text = (item: JsonValue | undefined): string => item === undefined || item === null ? '' : typeof item === 'string' ? item : JSON.stringify(item);
  return [keys.map(cell).join(','), ...list.map((row) => keys.map((key) => cell(text(row[key]))).join(','))].join('\n');
}

/** Infer scalar types as a CSV reader would; nesting and missing cells lose data. */
function csvExact(value: JsonRoot): boolean | null {
  const list = recordList(value);
  if (list === null || csvText(value) === null) return null;
  const keys = [...new Set(list.flatMap((row) => Object.keys(row)))];
  const infer = (value: JsonValue | undefined): JsonValue => {
    const text = value === undefined || value === null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed === 'boolean' || typeof parsed === 'number') return parsed;
    } catch { /* Non-JSON scalar text remains text. */ }
    return text;
  };
  const restored = list.map((row) => Object.fromEntries(keys.map((key) => [key, infer(row[key])])));
  return JSON.stringify(restored) === JSON.stringify(list);
}

export function formatTexts(value: JsonRoot) {
  const terset = encode(value);
  if (JSON.stringify(decode(terset)) !== JSON.stringify(value)) throw new Error('Terset round trip failed');
  // Empty rules add nothing, so that text is sent as the data alone.
  const rules = rulesFor(terset);
  return {
    json: JSON.stringify(value),
    jsonPretty: JSON.stringify(value, null, 2),
    yaml: yamlStringify(value),
    toonDefault: toonEncode(value),
    toonTab: toonEncode(value, { delimiter: '\t' }),
    csv: csvText(value),
    csvExact: csvExact(value),
    terset: rules === '' ? terset : `${rules}\n${terset}`,
  };
}

export function requestPlan(inputs: readonly CountInput[]) {
  const rows = inputs.map((input) => ({ input, texts: formatTexts(input.value) }));
  return { rows, requests: 1 + rows.reduce((total, row) => total + (row.texts.csv === null ? 6 : 7), 0) };
}

export function adjustedCount(inputTokens: number, baselineTokens: number): number {
  const result = inputTokens - baselineTokens + 1;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Count is below the measured message framing baseline');
  return result;
}

interface Settings {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export function settingsFromEnv(env: NodeJS.ProcessEnv): Settings {
  // Do not include values in configuration or provider error messages.
  if (!env.TERSET_COUNT_API_KEY?.trim()) throw new Error('TERSET_COUNT_API_KEY is required');
  if (!env.TERSET_COUNT_BASE_URL?.trim()) throw new Error('TERSET_COUNT_BASE_URL is required');
  if (!env.TERSET_COUNT_MODEL?.trim()) throw new Error('TERSET_COUNT_MODEL is required');
  let url: URL;
  try { url = new URL(env.TERSET_COUNT_BASE_URL); }
  catch { throw new Error('TERSET_COUNT_BASE_URL must be a valid HTTP(S) URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('TERSET_COUNT_BASE_URL must be an HTTP(S) URL without credentials, query or fragment');
  }
  return { baseUrl: url.href.replace(/\/$/u, ''), apiKey: env.TERSET_COUNT_API_KEY, model: env.TERSET_COUNT_MODEL };
}

export function parseArgs(args: readonly string[]): { dryRun: boolean; maxRequests: number; inputsPath?: string } {
  let dryRun = false;
  let maxRequests = 400;
  let inputsPath: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--inputs') {
      if (inputsPath !== undefined) throw new Error('--inputs may be supplied only once');
      const value = args[++index];
      if (value === undefined || !value.trim() || value.startsWith('--')) throw new Error('--inputs needs a file path');
      inputsPath = value;
    } else if (arg === '--max-requests') {
      const value = args[++index];
      if (value === undefined || !/^[1-9]\d*$/u.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error('--max-requests needs a positive safe integer');
      }
      maxRequests = Number(value);
    } else throw new Error('Unknown argument. Use --dry-run, --inputs <file> or --max-requests <number>');
  }
  return { dryRun, maxRequests, ...(inputsPath === undefined ? {} : { inputsPath }) };
}

export interface CountOptions extends Settings {
  readonly maxRequests: number;
  readonly fetch: typeof fetch;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly utcDate: () => string;
}

/** One text as the only user message, with no system text. The baseline "a" uses it too. */
function textBody(model: string, text: string): { model: string; messages: { role: 'user'; content: string }[] } {
  return { model, messages: [{ role: 'user', content: text }] };
}

function countRequest(options: CountOptions, body: object): Promise<Response> {
  return options.fetch(`${options.baseUrl}${ENDPOINT}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function countClaude(inputs: readonly CountInput[], options: CountOptions): Promise<ClaudeReady> {
  const plan = requestPlan(inputs);
  if (!Number.isSafeInteger(options.maxRequests) || options.maxRequests < plan.requests) {
    throw new Error(`Request plan needs ${plan.requests} requests; raise --max-requests before counting`);
  }
  let requests = 0;
  const request = async (text: string): Promise<number> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (requests >= options.maxRequests) throw new Error('Request cap reached, including retries');
      requests++;
      let response: Response;
      try { response = await countRequest(options, textBody(options.model, text)); }
      catch { throw new Error('Token count request failed; no response received'); }
      if (response.ok) {
        try { return ResponseSchema.parse(await response.json()).input_tokens; }
        catch { throw new Error('Token count endpoint returned an invalid input_tokens response'); }
      }
      // Never print provider bodies: they may echo request headers or credentials.
      await response.body?.cancel();
      if ((response.status === 429 || (response.status >= 500 && response.status < 600)) && attempt < 2) {
        if (requests >= options.maxRequests) throw new Error('Request cap reached, including retries');
        await options.sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`Token count endpoint returned HTTP ${response.status}`);
    }
    throw new Error('Token count retry limit reached');
  };
  const baselineTokens = await request('a');
  const count = async (text: string): Promise<number> => adjustedCount(await request(text), baselineTokens);
  const rows: ClaudeRow[] = [];
  for (const { input, texts } of plan.rows) {
    const json = await count(texts.json);
    const jsonPretty = await count(texts.jsonPretty);
    const yaml = await count(texts.yaml);
    const toonDefault = await count(texts.toonDefault);
    const toonTab = await count(texts.toonTab);
    const csv = texts.csv === null ? null : await count(texts.csv);
    const terset = await count(texts.terset);
    rows.push({
      id: input.id, source: input.source, name: input.name, json, jsonPretty, yaml,
      toon: Math.min(toonDefault, toonTab), csv, csvExact: texts.csvExact, terset,
      o200kJson: o200kTokens(texts.json).length,
    });
  }
  return ClaudeReadySchema.parse({
    status: 'ready', model: options.model, countedAt: options.utcDate(), endpoint: ENDPOINT,
    baseline: { text: 'a', assumedTextTokens: 1, inputTokens: baselineTokens, overheadTokens: baselineTokens - 1 },
    method: METHOD, rulesMode: 'fitted', requests, rows,
  });
}

interface CountFiles {
  readonly read: (path: string) => string;
  readonly write: (text: string) => void;
}

function utcNow(): string {
  return execFileSync('date', ['-u', '+%Y-%m-%dT%H:%M:%SZ'], { encoding: 'utf8' }).trim();
}

export async function main(args: readonly string[], env: NodeJS.ProcessEnv, files: CountFiles = {
  read: (path) => readFileSync(path, 'utf8'),
  write: (text) => { writeFileSync(OUTPUT, text); },
}): Promise<void> {
  const flags = parseArgs(args);
  const inputs = publicInputs();
  if (flags.inputsPath !== undefined) {
    let text: string;
    try { text = files.read(flags.inputsPath); }
    catch { throw new Error('Unable to read --inputs file'); }
    inputs.push(...parseNeutralInputs(text));
  }
  const plan = requestPlan(inputs);
  if (flags.dryRun) {
    console.log(`${plan.rows.length} rows; ${plan.requests} requests without retries; hard cap ${flags.maxRequests} including retries. No requests made.`);
    if (plan.requests > flags.maxRequests) throw new Error('Request plan exceeds --max-requests');
    return;
  }
  const settings = settingsFromEnv(env);
  const file = await countClaude(inputs, {
    ...settings, ...flags, fetch: globalThis.fetch,
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    utcDate: utcNow,
  });
  files.write(`${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${file.rows.length} rows using ${file.requests} requests.`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(process.argv.slice(2), process.env); }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Claude counting failed');
    process.exitCode = 1;
  }
}
