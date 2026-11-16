// The bench data the site shows. Production always reads bench-results.json
// and claude-counts.json. In dev, `VITE_BENCH_FIXTURE=1` swaps in fake numbers
// to build the chart, with o200k_base only.
// To publish real results, run `pnpm numbers --cases <results.json>`.
import raw from './bench-results.json' with { type: 'json' };
import claudeRaw from './claude-counts.json' with { type: 'json' };
import { BENCH_FIXTURE } from './bench-fixture.dev.ts';
import { selectBench } from './bench.ts';
import type { BenchFile } from './bench.ts';
import type { ClaudeCounts } from './claude-counts-schema.ts';
import { buildCounters } from './counters.ts';
import type { Counters } from './counters.ts';
import { PRICES } from './prices.ts';

export * from './bench.ts';
export * from './counters.ts';
export { PRICES } from './prices.ts';

// Both files are typed without zod, so the browser skips it.
// data-check.ts proves them against BenchFileSchema and ClaudeCountsSchema.

/** The committed file, pending or ready. */
export const BENCH_FILE = raw as BenchFile;

/** The committed Claude counts, pending or ready. */
export const CLAUDE_FILE = claudeRaw as ClaudeCounts;

const USE_FIXTURE = import.meta.env.DEV && import.meta.env.VITE_BENCH_FIXTURE === '1';

/** What every page shows. */
export const BENCH: BenchFile = selectBench(BENCH_FILE, BENCH_FIXTURE, USE_FIXTURE);

/** The Claude counts every page shows. The fake fixture has no Claude counts. */
export const CLAUDE: ClaudeCounts = BENCH === BENCH_FILE ? CLAUDE_FILE : { status: 'pending' };

/** Both counters, or null while the bench is pending. Throws when the two files disagree. */
export const COUNTERS: Counters | null = buildCounters(BENCH, CLAUDE, PRICES);
