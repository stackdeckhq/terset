import { isReal400Suite } from './schema.ts';
import type { Result, Row } from './schema.ts';
import type { Task } from './plan.ts';
import { wilson } from './scoring.ts';

export function summarize(rows: Row[]): {
  correct: number; total: number; accuracy: number | null; wilson95: ReturnType<typeof wilson>; inputTokens: number; outputTokens: number;
} {
  const correct = rows.filter(r => r.correct).length;
  return { correct, total: rows.length, accuracy: rows.length ? correct / rows.length : null,
    wilson95: wilson(correct, rows.length), inputTokens: rows.reduce((n, r) => n + r.inputTokens, 0), outputTokens: rows.reduce((n, r) => n + r.outputTokens, 0) };
}

interface CostMetrics {
  inputCost: number; outputCost: number; totalCost: number; savingVsCompactJson: number | null;
}
function questionKey(row: Row): string {
  return JSON.stringify([row.model, row.dataset, row.questionId]);
}

function completeQuestions(rows: Row[], formats: Row['format'][]): Map<string, Map<Row['format'], Row>> {
  const coverage = new Map<string, Map<Row['format'], Row>>();
  for (const row of rows) {
    const id = questionKey(row);
    const answers = coverage.get(id) ?? new Map<Row['format'], Row>();
    answers.set(row.format, row);
    coverage.set(id, answers);
  }
  return new Map([...coverage].filter(([, answers]) => formats.every(format => answers.has(format))));
}

export function summaries(rows: Row[], tasks: Task[]): { model: string; format: string; dataset: string; metrics: ReturnType<typeof summarize> & CostMetrics & { droppedIncompleteQuestions: number } }[] {
  const complete = completeQuestions(rows, [...new Set(tasks.map(task => task.format))]);
  const groups = new Map<string, { model: string; format: string; dataset: string; rows: Row[] }>();
  for (const task of tasks) {
    for (const dataset of ['ALL', task.question.dataset]) {
      const key = JSON.stringify([task.model.id, task.format, dataset]);
      if (!groups.has(key)) groups.set(key, { model: task.model.id, format: task.format, dataset, rows: [] });
    }
  }
  for (const row of rows) {
    if (!complete.has(questionKey(row))) continue;
    for (const dataset of ['ALL', row.dataset]) {
      const key = JSON.stringify([row.model, row.format, dataset]);
      const group = groups.get(key) ?? { model: row.model, format: row.format, dataset, rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    }
  }
  const priced = [...groups.values()].map(({ rows: groupedRows, ...labels }) => {
    const price = tasks.find(t => t.model.id === labels.model)?.model.price;
    if (!price) throw new Error('Missing model price');
    const metrics = summarize(groupedRows);
    const droppedIncompleteQuestions = new Set(rows.filter(row => row.model === labels.model
      && (labels.dataset === 'ALL' || row.dataset === labels.dataset)
      && !complete.has(questionKey(row))).map(questionKey)).size;
    const inputCost = metrics.inputTokens * price.inputPerMillion / 1_000_000;
    const outputCost = metrics.outputTokens * price.outputPerMillion / 1_000_000;
    return { ...labels, metrics: { ...metrics, droppedIncompleteQuestions, inputCost, outputCost, totalCost: inputCost + outputCost } };
  });
  return priced.map(group => {
    const baseline = priced.find(g => g.model === group.model && g.dataset === group.dataset && g.format === 'json-compact');
    return { ...group, metrics: { ...group.metrics,
      savingVsCompactJson: baseline ? baseline.metrics.totalCost - group.metrics.totalCost : null } };
  });
}

function binomialLowerTail(cutoff: number, total: number, probability: number): number {
  if (cutoff >= total || probability === 0) return 1;
  if (probability === 1) return 0;
  if (cutoff > total / 2) return 1 - binomialLowerTail(total - cutoff - 1, total, 1 - probability);
  const logSuccess = Math.log(probability);
  const logFailure = Math.log1p(-probability);
  let logChoose = 0;
  let tail = 0;
  for (let count = 0; count <= cutoff; count++) {
    tail += Math.exp(logChoose + count * logSuccess + (total - count) * logFailure);
    if (count < cutoff) logChoose += Math.log((total - count) / (count + 1));
  }
  return Math.min(1, tail);
}

function discordanceBounds(count: number, total: number): { lower: number; upper: number } {
  // Invert the binomial tail for a two-sided 97.5% exact interval.
  const tail = 0.0125;
  const upperBound = (successes: number): number => {
    if (successes === total) return 1;
    if (successes === 0) return 1 - tail ** (1 / total);
    let lower = 0;
    let upper = 1;
    for (let i = 0; i < 52; i++) {
      const middle = (lower + upper) / 2;
      if (binomialLowerTail(successes, total, middle) > tail) lower = middle;
      else upper = middle;
    }
    return upper;
  };
  return { lower: 1 - upperBound(total - count), upper: upperBound(count) };
}

export function pairedAccuracy(tersetOnly: number, otherOnly: number, total: number): {
  gap: number | null; interval95: { lower: number; upper: number } | null; pValue: number;
} {
  const discordant = tersetOnly + otherOnly;
  if (![tersetOnly, otherOnly, total].every(value => Number.isSafeInteger(value) && value >= 0) || discordant > total) {
    throw new Error('Invalid paired score counts');
  }
  if (total === 0) return { gap: null, interval95: null, pValue: 1 };
  const pValue = Math.min(1, 2 * binomialLowerTail(Math.min(tersetOnly, otherOnly), discordant, 0.5));
  const first = discordanceBounds(tersetOnly, total);
  const second = discordanceBounds(otherOnly, total);
  // The gap is the difference of the two discordance rates. The two bounds
  // cover jointly with at least 95% confidence by the union bound.
  return { gap: (tersetOnly - otherOnly) / total, pValue,
    interval95: { lower: first.lower - second.upper, upper: first.upper - second.lower } };
}

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const dollars = (value: number): string => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(6)}`;
const cell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const points = (value: number): string => (value * 100).toFixed(2);

function pairedMarkdown(rows: Row[], tasks: Task[]): string[] {
  const formats = [...new Set(tasks.map(task => task.format))];
  const others = formats.filter(format => format !== 'terset');
  if (!formats.includes('terset') || others.length === 0) return [];
  const complete = [...completeQuestions(rows, formats).values()];
  const lines = ['', '## Paired accuracy', '',
    'The gap is Terset accuracy minus the comparison format accuracy. The 95% paired interval uses conservative exact bounds.',
    'McNemar p-values are exact and two-sided. Questions share datasets, so use these results descriptively.', '',
    '| Model | Comparison format | Paired questions | Only Terset correct | Only comparison correct | Gap (pp) | Paired 95% CI (pp) | McNemar p |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |'];
  for (const model of new Set(tasks.map(task => task.model.id))) {
    const matched = complete.filter(question => question.get('terset')?.model === model);
    for (const format of others) {
      let tersetOnly = 0;
      let otherOnly = 0;
      for (const question of matched) {
        const terset = question.get('terset')?.correct;
        const other = question.get(format)?.correct;
        if (terset === true && other === false) tersetOnly++;
        if (terset === false && other === true) otherOnly++;
      }
      const { gap, interval95, pValue } = pairedAccuracy(tersetOnly, otherOnly, matched.length);
      const interval = interval95 ? `${points(interval95.lower)} to ${points(interval95.upper)}` : 'N/A';
      const p = gap === null ? 'N/A' : pValue === 1 ? '1' : pValue.toPrecision(3);
      lines.push(`| ${cell(model)} | ${format} | ${matched.length} | ${tersetOnly} | ${otherOnly} | ${gap === null ? 'N/A' : points(gap)} | ${interval} | ${p} |`);
    }
  }
  return lines;
}

export function markdown(result: Result, tasks: Task[]): string {
  const summary = summaries(result.rows, tasks);
  const lines = [`# Accuracy benchmark: ${result.runId}`, '',
    `Status: ${result.status}. Mode: ${result.mode}. Recorded ${result.rows.length}/${result.plannedCalls} calls.`,
    result.mode === 'fake' ? 'Fake responses exercise the harness. These are not model measurements.' : 'Results are published as measured.',
    `Stop reason: ${result.reason ?? 'none'}.`, '',
    `Input reservation exceeded: ${result.rows.filter(row => row.reservedInputTokens !== undefined && row.inputTokens > row.reservedInputTokens).length} calls.`, '',
    'Comparisons include only questions complete in every selected format for each model. Unstarted questions are not counted as dropped.',
    ...[...new Map(summary.filter(group => group.dataset === 'ALL').map(group => [group.model, group])).values()]
      .map(group => `Dropped incomplete questions: ${group.metrics.droppedIncompleteQuestions} (model ${cell(group.model)}).`), '',
    'API-equivalent USD uses configured list prices and reported tokens for completed calls. Failed requests may have unreported charges. Reservations are budget accounting, not measured spend.', '',
    'Wilson 95% intervals describe each observed proportion. Questions share datasets, so intervals are descriptive and do not prove differences between formats.', '',
    '| Model | Format | Dataset | Correct | Total | Accuracy | Wilson 95% | Input tokens | Output tokens | Input cost (USD) | Output cost (USD) | Total cost (USD) | Saving vs compact JSON (USD) |',
    '| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const { model, format, dataset, metrics: m } of summary) {
    const interval = m.wilson95 ? `${percent(m.wilson95.lower)} to ${percent(m.wilson95.upper)}` : 'N/A';
    lines.push(`| ${cell(model)} | ${format} | ${dataset} | ${m.correct} | ${m.total} | ${m.accuracy === null ? 'N/A' : percent(m.accuracy)} | ${interval} | ${m.inputTokens} | ${m.outputTokens} | ${dollars(m.inputCost)} | ${dollars(m.outputCost)} | ${dollars(m.totalCost)} | ${m.savingVsCompactJson === null ? '' : dollars(m.savingVsCompactJson)} |`);
  }
  if (isReal400Suite(result.suite)) lines.push(...pairedMarkdown(result.rows, tasks));
  return `${lines.join('\n')}\n`;
}
