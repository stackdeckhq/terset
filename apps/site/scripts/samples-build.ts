// Builds every sample text the site shows, with the real encoder.
// generate-samples.ts writes the result to src/generated/samples.json, and
// src/data/generated.test.ts fails when that file differs from a fresh build.
import { readFileSync } from 'node:fs';
import { encode as toonEncode } from '@toon-format/toon';
import { encode as tokens } from 'gpt-tokenizer/encoding/o200k_base';
import { z } from 'zod';
import { DOC_EXAMPLES, SAMPLE_IDS, SAMPLES } from '../src/data/samples.ts';
import { CHEAT_SHEET } from '../src/data/docs.ts';
import type { CheatInput } from '../src/data/docs.ts';
import type { CheatRow, GeneratedSamples, SampleText } from '../src/data/generated-schema.ts';
import { RULES, decode, encode, rulesFor } from '../src/lib/format.ts';
import type { JsonObject } from '../src/lib/format.ts';

const PACKAGE = new URL('../../../packages/terset/', import.meta.url);

function sampleText(value: JsonObject): SampleText {
  const terset = encode(value);
  const compact = JSON.stringify(value);
  if (JSON.stringify(decode(terset)) !== compact) throw new Error(`A sample does not round trip: ${compact.slice(0, 60)}`);
  const rules = rulesFor(terset);
  return { pretty: JSON.stringify(value, null, 2), compact, terset, rules, rulesTokens: tokens(rules).length, toon: toonEncode(value), roundTrip: true };
}

const Manifest = z.object({ dependencies: z.record(z.string(), z.string()).optional() });

/** Counts read from the package itself, so the site never restates them by hand. */
function packageFacts(): GeneratedSamples['facts'] {
  const manifest = Manifest.parse(JSON.parse(readFileSync(new URL('package.json', PACKAGE), 'utf8')));
  const fuzz = readFileSync(new URL('tests/fuzz.test.ts', PACKAGE), 'utf8');
  const loop = /index < ([\d_]+);/u.exec(fuzz)?.[1];
  if (loop === undefined) throw new Error('Could not find the fuzz loop count in tests/fuzz.test.ts');
  return { fuzzObjects: Number(loop.replace(/_/gu, '')), runtimeDependencies: Object.keys(manifest.dependencies ?? {}).length };
}

export function buildSamples(): GeneratedSamples {
  const samples = Object.fromEntries(SAMPLE_IDS.map((id) => [id, sampleText(SAMPLES[id])])) as GeneratedSamples['samples'];
  const docExamples = Object.fromEntries(
    Object.entries(DOC_EXAMPLES).map(([id, value]) => [id, { json: JSON.stringify(value), terset: encode(value) }]),
  ) as GeneratedSamples['docExamples'];
  return { rules: RULES, samples, docExamples, cheatSheet: CHEAT_SHEET.map(cheatRow), facts: packageFacts() };
}

/** One /docs cheat sheet row. A row must round trip, so the page never shows text the decoder rejects. */
function cheatRow(input: CheatInput): CheatRow {
  const terset = encode(input.value);
  const compact = JSON.stringify(input.value);
  if (JSON.stringify(decode(terset)) !== compact) throw new Error(`Cheat sheet row "${input.id}" does not round trip`);
  return { id: input.id, json: JSON.stringify(input.value, null, 2), terset };
}
