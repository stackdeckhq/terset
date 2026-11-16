// FAKE numbers for building the chart in dev only. They are not measurements.
// Used only when `VITE_BENCH_FIXTURE=1 pnpm dev`. A production build swaps
// this module for bench-fixture.ship.ts (see vite.config.ts), and
// scripts/check-build.ts fails the build if the marker below reaches dist.
import type { BenchReady } from './bench-schema.ts';

export const FIXTURE_MARKER = 'FAKE-DEV-FIXTURE';

export const BENCH_FIXTURE: BenchReady | null = {
  status: 'ready',
  tokenizer: FIXTURE_MARKER,
  rulesTokens: 40,
  yamlVersion: '0.0.0',
  cases: [
    { name: 'Fake case 1, wide', json: 9000, jsonPretty: 14000, yaml: 10500, toon: 7000, csv: 4950, csvExact: true, terset: 5000 },
    { name: 'Fake case 2, close', json: 1000, jsonPretty: 1600, yaml: 1150, toon: 980, csv: null, csvExact: null, terset: 1010 },
    { name: 'Fake case 3, tiny', json: 60, jsonPretty: 110, yaml: 75, toon: 80, csv: null, csvExact: null, terset: 100 },
    { name: 'Fake case 4, long text', json: 4000, jsonPretty: 4800, yaml: 4400, toon: 3900, csv: 3700, csvExact: false, terset: 3600 },
    { name: 'Fake case 5, nested', json: 400, jsonPretty: 700, yaml: 480, toon: 450, csv: null, csvExact: null, terset: 440 },
  ],
  samples: {
    orders: { json: 500, toon: 400, terset: 300 },
    servers: { json: 700, toon: 450, terset: 420 },
    config: { json: 120, toon: 130, terset: 160 },
  },
};
