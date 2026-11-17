// Writes src/data/bench-results.json, the one file every site number comes from.
//
//   pnpm numbers                 counts the committed inputs in src/data/count-cases.json
//   pnpm numbers --cases <file>  counts another inputs file
//   pnpm numbers --pending       writes the pending state (no numbers shown)
//
// <file> is a neutral JSON file:
//   { "cases": [{ "name", "data" }] }
// Raw data is encoded, round-tripped and counted locally. Private values
// never enter the output file. Pre-counted inputs are also accepted:
//   { "rulesTokens", "yamlVersion",
//     "cases": [{ "name", "json", "jsonPretty", "yaml", "toon", "csv", "csvExact", "terset" }] },
// counted with o200k_base, Terset counts including rulesFor(text). json is
// compact JSON, jsonPretty is JSON.stringify(value, null, 2), and yaml is the
// yaml package's stringify with default options. csv and csvExact are null
// when the data is not one list of records.
// The run stops if the RULES count differs from what the cases were counted
// with, if the yaml version differs from the one installed here, or if pretty
// JSON is ever smaller than compact JSON.
// The three sample counts are measured here, with the same tokenizer and the
// real encoder, so the hero and the converter match what the page shows.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { z } from 'zod';
import { BenchFileSchema, CaseRowSchema } from '../src/data/bench-schema.ts';
import type { BenchFile, Trio } from '../src/data/bench-schema.ts';
import { SAMPLE_IDS, SAMPLES } from '../src/data/samples.ts';
import { RULES, decode, encode, rulesFor } from '../src/lib/format.ts';
import type { JsonObject } from '../src/lib/format.ts';
import { parseNeutralInputs } from './claude-inputs.ts';
import { formatTexts } from './count-claude.ts';
import { OUTPUT as CASES_FILE } from './update-cases.ts';

export const OUTPUT = fileURLToPath(new URL('../src/data/bench-results.json', import.meta.url));
const TOKENIZER = 'o200k_base';
const PENDING_REASON = 'The encoder is still a draft, so its token counts are not published yet.';

const Version = z.string().regex(/^\d+\.\d+\.\d+$/u);
const CasesFile = z.strictObject({ rulesTokens: z.number().int().positive(), yamlVersion: Version, cases: z.array(CaseRowSchema).min(1) });
const PackageFile = z.object({ version: Version });

const count = (text: string): number => tokens(text).length;
const RULES_TOKENS = count(RULES);
const YAML_VERSION = PackageFile.parse(JSON.parse(readFileSync(createRequire(import.meta.url).resolve('yaml/package.json'), 'utf8'))).version;

function trio(value: JsonObject): Trio {
  const toon = Math.min(count(toonEncode(value)), count(toonEncode(value, { delimiter: '\t' })));
  const text = encode(value);
  return { json: count(JSON.stringify(value)), toon, terset: count(text) + count(rulesFor(text)) };
}

export function buildNumbers(casesText: string | undefined): BenchFile {
  if (casesText === undefined) return { status: 'pending', reason: PENDING_REASON };
  const measured = CasesFile.safeParse(JSON.parse(casesText));
  const { rulesTokens, yamlVersion, cases } = measured.success ? measured.data : {
    rulesTokens: RULES_TOKENS,
    yamlVersion: YAML_VERSION,
    cases: parseNeutralInputs(casesText).map(({ name, value }) => {
      const text = formatTexts(value);
      const encoded = encode(value);
      if (JSON.stringify(decode(Buffer.from(encoded, 'utf8').toString('utf8'))) !== text.json) {
        throw new Error('Terset round trip failed after UTF-8 transport');
      }
      return {
        name, json: count(text.json), jsonPretty: count(text.jsonPretty), yaml: count(text.yaml),
        toon: Math.min(count(text.toonDefault), count(text.toonTab)),
        csv: text.csv === null ? null : count(text.csv), csvExact: text.csvExact,
        terset: count(encoded) + count(rulesFor(encoded)),
      };
    }),
  };
  if (rulesTokens !== RULES_TOKENS) throw new Error(`The cases were counted with a ${String(rulesTokens)}-token RULES line; this RULES line is ${String(RULES_TOKENS)} tokens`);
  if (yamlVersion !== YAML_VERSION) throw new Error(`The cases were counted with yaml ${yamlVersion}; this site installs yaml ${YAML_VERSION}`);
  const smaller = cases.filter((row) => row.jsonPretty < row.json).map((row) => row.name);
  if (smaller.length > 0) throw new Error(`Pretty JSON is smaller than compact JSON on: ${smaller.join(', ')}`);
  const samples = Object.fromEntries(SAMPLE_IDS.map((id) => [id, trio(SAMPLES[id])])) as Record<(typeof SAMPLE_IDS)[number], Trio>;
  return { status: 'ready', tokenizer: TOKENIZER, rulesTokens: RULES_TOKENS, yamlVersion: YAML_VERSION, cases, samples };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const pending = args.includes('--pending');
  const flag = args.indexOf('--cases');
  const casesPath = flag === -1 ? CASES_FILE : args[flag + 1];
  if (casesPath === undefined) throw new Error('--cases needs a file path');
  if (pending && flag !== -1) throw new Error('--pending takes no --cases');

  const file = BenchFileSchema.parse(buildNumbers(pending ? undefined : readFileSync(resolve(casesPath), 'utf8')));
  writeFileSync(OUTPUT, `${JSON.stringify(file, null, 2)}\n`);
  console.log(file.status === 'pending' ? `Wrote ${OUTPUT}: pending.` : `Wrote ${OUTPUT}: ${String(file.cases.length)} cases, ready.`);
}
