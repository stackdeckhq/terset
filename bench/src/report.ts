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

export function summaries(rows: Row[], tasks: Task[]): { model: string; format: string; dataset: string; metrics: ReturnType<typeof summarize> & CostMetrics & { droppedIncompleteQuestions: number } }[] {
  const coverage = new Map<string, Set<Row['format']>>();
  for (const row of rows) {
    const id = questionKey(row);
    const formats = coverage.get(id) ?? new Set<Row['format']>();
    formats.add(row.format);
    coverage.set(id, formats);
  }
  const selectedFormats = [...new Set(tasks.map(task => task.format))];
  const complete = new Set([...coverage].filter(([, formats]) => selectedFormats.every(format => formats.has(format))).map(([id]) => id));
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

const percent = (value: number): string => `${(value * 100).toFixed(2)}%`;
const dollars = (value: number): string => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(6)}`;
const cell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
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
  return `${lines.join('\n')}\n`;
}
