import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { fakeClient, httpClient } from './clients.ts';
import { selectedDatasetsSchema, selectQuestions } from './data.ts';
import { describePlan, plan } from './plan.ts';
import { run } from './runner.ts';
import { configSchema, FORMATS, modelSchema, selectedFormatsSchema } from './schema.ts';
import type { Budgets } from './schema.ts';

function integer(value: string | undefined, fallback: number, name: string, allowZero = true): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) throw new Error(`${name} is outside the accepted range`);
  return number;
}

export async function main(args: string[], log: (text: string) => void = console.log): Promise<void> {
  const { values } = parseArgs({ args, options: {
    'dry-run': { type: 'boolean' }, fake: { type: 'boolean' }, http: { type: 'boolean' },
    config: { type: 'string' }, 'run-id': { type: 'string' }, limit: { type: 'string' },
    formats: { type: 'string' }, datasets: { type: 'string' },
    'max-calls': { type: 'string' }, 'max-input-tokens': { type: 'string' },
    'max-output-tokens': { type: 'string' }, 'per-call-max-output-tokens': { type: 'string' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    log('pnpm bench [--dry-run] [--fake | --http --config FILE] [--run-id ID] [--limit N]\n'
      + '  --formats a,b,c --datasets a,b\n'
      + '  --max-calls N --max-input-tokens N --max-output-tokens N --per-call-max-output-tokens N\n'
      + 'Fake mode is the default. HTTP mode requires explicit config and all four budget flags.');
    return;
  }
  if (values.fake && values.http) throw new Error('Choose either fake or HTTP mode');
  if (values.http && (!values.config || values['max-calls'] === undefined || values['max-input-tokens'] === undefined
    || values['max-output-tokens'] === undefined || values['per-call-max-output-tokens'] === undefined)) {
    throw new Error('HTTP mode requires --config and all four explicit budget flags');
  }
  const config = values.config
    ? configSchema.parse(JSON.parse(await readFile(values.config, 'utf8')) as unknown)
    : configSchema.parse({ models: [modelSchema.parse(fakeModel)] });
  const limit = values.limit === undefined ? undefined : integer(values.limit, 1, 'limit', false);
  const formats = values.formats === undefined ? FORMATS : selectedFormatsSchema.parse(values.formats.split(','));
  const datasets = values.datasets === undefined ? undefined : selectedDatasetsSchema.parse(values.datasets.split(','));
  const tasks = plan(config.models, selectQuestions(limit, datasets), formats);
  log(describePlan(tasks, config.inputReservation));
  if (values['dry-run']) { log('Dry run: no calls made and no results written.'); return; }
  const budgets: Budgets = {
    maxCalls: integer(values['max-calls'], 10_000, 'max calls'),
    maxInputTokens: integer(values['max-input-tokens'], 1_000_000_000, 'max input tokens'),
    maxOutputTokens: integer(values['max-output-tokens'], 1_000_000, 'max output tokens'),
    perCallMaxOutputTokens: integer(values['per-call-max-output-tokens'], 128, 'per-call max output tokens', false),
  };
  const answers = new Map(tasks.map(t => [t.prompt.user, t.question.groundTruth]));
  const mode = values.http ? 'http' : 'fake';
  const client = mode === 'http' ? httpClient({ maxOutputTokens: budgets.perCallMaxOutputTokens })
    : fakeClient(prompt => answers.get(prompt.user) ?? 'FAKE', budgets.perCallMaxOutputTokens);
  const runId = values['run-id'] ?? `${mode}-${new Date().toISOString().replaceAll(/[^a-zA-Z0-9]/g, '')}`;
  const directory = fileURLToPath(new URL('../results/', import.meta.url));
  const result = await run({ runId, directory, tasks, client, mode, budgets, inputReservation: config.inputReservation });
  log(`${result.status}: ${result.rows.length}/${result.plannedCalls} recorded; reason: ${result.reason ?? 'none'}`);
  log(`Results: ${directory}${runId}.json\nSummary: ${directory}${runId}.md`);
  if (result.reason?.startsWith('request failed')) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    // Config and provider errors may contain user-controlled or secret text.
    // Never print raw exceptions or response bodies.
    console.error('Benchmark failed. Check arguments, config, required TERSET_BENCH_BASE_URL / TERSET_BENCH_API_KEY, and any saved partial report. Details withheld.');
    process.exitCode = 1;
  });
}
