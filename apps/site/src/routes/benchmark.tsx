import { createFileRoute } from '@tanstack/react-router';
import { PublishedRunsTable } from '../components/AccuracyTables.tsx';
import { BenchChart } from '../components/BenchChart.tsx';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { FullTables } from '../components/FullTables.tsx';
import { HistoryTable } from '../components/HistoryTable.tsx';
import { RealTable } from '../components/RealTable.tsx';
import { SweepTable } from '../components/SweepTable.tsx';
import { BigNumbers, CostBars, DatasetChart } from '../components/Proof.tsx';
import { ACCURACY, accuracyIntro, accuracyMethod } from '../data/accuracy.ts';
import { BYTES, bytesLine } from '../data/bytes.ts';
import { benchmarkCostMethod, benchmarkKeepElse, benchmarkLimits, benchmarkMethod, benchmarkPageLines } from '../data/benchmark-doc.ts';
import { HISTORY_NOTE } from '../data/history.ts';
import { BENCH, BENCH_FILE, CLAUDE, COUNTERS, countersHeadline, countersNote } from '../data/numbers.ts';
import { smallerThanToon } from '../data/proof.ts';
import { REAL, realIntro, realLines, realMethod } from '../data/real.ts';
import { SWEEP, sweepIntro, sweepLines, sweepTitle } from '../data/sweep.ts';
import { inline } from '../lib/markdown.ts';

const DESCRIPTION = 'Token counts for Terset, compact and pretty JSON, YAML, TOON and CSV on two counters, input cost at list price, answer accuracy on two models, the method and the limits.';

export const Route = createFileRoute('/benchmark')({
  head: () => docHead('/benchmark', 'Benchmark', DESCRIPTION),
  component: BenchmarkPage,
});

function Lines({ lines }: { readonly lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="steps-list">
      {lines.map((line) => (
        <li key={line} dangerouslySetInnerHTML={{ __html: inline(line) }} />
      ))}
    </ul>
  );
}

function BenchmarkPage() {
  const keepElse = benchmarkKeepElse(BENCH, COUNTERS);
  const costMethod = benchmarkCostMethod(COUNTERS);
  const toon = smallerThanToon(ACCURACY, COUNTERS);
  return (
    <DocPage
      kicker={BENCH.status === 'pending' ? 'Benchmark, numbers pending' : 'Benchmark'}
      title="Tokens on every case"
      lead={`${countersHeadline(BENCH, COUNTERS)} ${countersNote(BENCH, COUNTERS)}`}
      actions={
        <a className="btn btn-line" href="/benchmark.md">
          Raw benchmark.md
        </a>
      }
    >
      <section className="doc-section proof-first" id="accuracy" aria-labelledby="acc-h">
        <h2 id="acc-h">Fewer tokens. Accuracy is a tie.</h2>
        <p>{accuracyIntro(ACCURACY)}</p>
        <BigNumbers file={ACCURACY} />
      </section>
      <section className="doc-section" aria-labelledby="cost-bars-h">
        <h2 id="cost-bars-h">Cost per format</h2>
        <CostBars file={ACCURACY} headingId="cost-bars-h" />
      </section>
      <section className="doc-section" aria-labelledby="ds-h">
        <h2 id="ds-h" className="with-tag">
          {toon === null ? 'Tokens per data set' : toon.text}
          {toon === null ? null : <span className="tok">{toon.tokenizer}</span>}
        </h2>
        {toon === null ? null : <p>{toon.note}</p>}
        <DatasetChart file={ACCURACY} headingId="ds-h" />
      </section>
      <section className="doc-section" aria-labelledby="sum-h">
        <h2 id="sum-h">Sample cases</h2>
        <BenchChart bench={BENCH} counters={COUNTERS} headingId="bench-h" flat table={false} />
        <Lines lines={benchmarkPageLines(BENCH, COUNTERS)} />
        <p className="bytes-line" dangerouslySetInnerHTML={{ __html: inline(bytesLine(BYTES)) }} />
      </section>
      <section className="doc-section follow" aria-label="Full tables">
        <FullTables file={ACCURACY} counters={COUNTERS} />
      </section>
      {BENCH.status === 'ready' && (
        <section className="doc-section" id="sweep" aria-labelledby="sweep-h">
          <h2 id="sweep-h" className="with-tag">
            {sweepTitle(SWEEP)}
            <span className="tok">{SWEEP.tokenizer}</span>
          </h2>
          <p>{sweepIntro(SWEEP)}</p>
          {/* The sample seed check reads the committed file, never the dev fixture. */}
          <Lines lines={sweepLines(SWEEP, BENCH_FILE)} />
          <SweepTable sweep={SWEEP} />
        </section>
      )}
      <section className="doc-section" id="real-data" aria-labelledby="real-h">
        <h2 id="real-h" className="with-tag">
          Real data
          <span className="tok">{REAL.tokenizer}</span>
        </h2>
        <p>{realIntro(REAL)}</p>
        <Lines lines={realLines(REAL)} />
        <RealTable data={REAL} />
        <p className="tbl-note" dangerouslySetInnerHTML={{ __html: inline(realMethod(REAL)) }} />
      </section>
      {keepElse.length > 0 && (
        <section className="doc-section" aria-labelledby="else-h">
          <h2 id="else-h">When to keep something else</h2>
          <Lines lines={keepElse} />
        </section>
      )}
      <section className="doc-section acc-method notes" aria-labelledby="acc-method-h">
        <h2 id="acc-method-h">Accuracy method</h2>
        <Lines lines={accuracyMethod(ACCURACY)} />
      </section>
      <section className="doc-section" id="published-runs" aria-labelledby="runs-h">
        <h2 id="runs-h">Published runs</h2>
        <PublishedRunsTable file={ACCURACY} />
      </section>
      <section className="doc-section notes" aria-labelledby="method-h">
        <h2 id="method-h">Method</h2>
        <Lines lines={benchmarkMethod(BENCH, CLAUDE)} />
      </section>
      {costMethod.length > 0 && (
        <section className="doc-section notes" aria-labelledby="cost-h">
          <h2 id="cost-h">Cost method</h2>
          <Lines lines={costMethod} />
        </section>
      )}
      <section className="doc-section notes" aria-labelledby="limits-h">
        <h2 id="limits-h">Limits</h2>
        <Lines lines={benchmarkLimits(COUNTERS)} />
      </section>
      {/* The history names both counters, so it shows only when both are ready. */}
      {COUNTERS !== null && COUNTERS.claude !== null && (
        <section className="doc-section" id="history" aria-labelledby="history-h">
          <h2 id="history-h">Number history</h2>
          <HistoryTable />
          <p className="tbl-note">{HISTORY_NOTE}</p>
        </section>
      )}
    </DocPage>
  );
}
