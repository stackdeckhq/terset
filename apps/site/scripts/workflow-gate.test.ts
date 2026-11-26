// In CI the gate type checks the Python quick start with mypy and fails when mypy is missing.
// So every workflow job that runs the gate must install the pinned mypy first.
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const WORKFLOWS = new URL('../../../.github/workflows/', import.meta.url);
const GATE_STEP = /^\s+run: pnpm gate$/u;
const JOB_START = /^ {2}[\w-]+:$/u;
const MYPY_INSTALL = /^\s+run: python -m pip install --disable-pip-version-check mypy==[\d.]+$/u;

interface GateRun {
  /** The workflow file and the line of its gate step. */
  readonly where: string;
  readonly installsMypy: boolean;
  readonly setsUpPython: boolean;
}

function gateRuns(): readonly GateRun[] {
  const runs: GateRun[] = [];
  for (const file of readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'))) {
    const lines = readFileSync(new URL(file, WORKFLOWS), 'utf8').split('\n');
    let jobStart = 0;
    lines.forEach((line, index) => {
      if (JOB_START.test(line)) jobStart = index;
      if (!GATE_STEP.test(line)) return;
      const before = lines.slice(jobStart, index);
      runs.push({
        where: `${file}:${String(index + 1)}`,
        installsMypy: before.some((earlier) => MYPY_INSTALL.test(earlier)),
        setsUpPython: before.some((earlier) => earlier.includes('uses: actions/setup-python@')),
      });
    });
  }
  return runs;
}

it('installs mypy, on a Python the workflow set up, before every gate run', () => {
  const runs = gateRuns();
  expect(runs.length).toBeGreaterThanOrEqual(4);
  expect(runs.filter((run) => !run.installsMypy || !run.setsUpPython).map((run) => run.where)).toEqual([]);
});
