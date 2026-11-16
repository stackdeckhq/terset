// What a production build gets in place of bench-fixture.dev.ts: no fixture.
import type { BenchReady } from './bench-schema.ts';

export const FIXTURE_MARKER = '';

export const BENCH_FIXTURE: BenchReady | null = null;
