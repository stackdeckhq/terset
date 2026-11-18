import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AccuracyTables, KindTable, PublishedRunsTable } from '../components/AccuracyTables.tsx';
import { BenchChart } from '../components/BenchChart.tsx';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { Fold } from '../components/Fold.tsx';
import { HistoryTable } from '../components/HistoryTable.tsx';
import { RealTable } from '../components/RealTable.tsx';
import { SampleTables } from '../components/SampleTables.tsx';
import { StressGroupTables, StressHeadline } from '../components/StressTables.tsx';
import { SweepTable } from '../components/SweepTable.tsx';
import { BigNumbers, CostBars, DatasetChart } from '../components/Proof.tsx';
import { ACCURACY, accuracyIntro, accuracyMethod, accuracyOverlapLine } from '../data/accuracy.ts';
import { BYTES, bytesLine } from '../data/bytes.ts';
import { benchmarkCostMethod, benchmarkKeepElseAll, benchmarkLimits, benchmarkMethod, benchmarkSampleTotals, sampleTotalsLine } from '../data/benchmark-doc.ts';
import { HISTORY_NOTE, TUNING_NOTE } from '../data/history.ts';
import { BENCH, BENCH_FILE, CLAUDE, COUNTERS, countersHeadline, countersPageNote } from '../data/numbers.ts';
import { datasetFoldAbout, proofHeading, smallerThanToon, smallerThanToonLine } from '../data/proof.ts';
import { REAL, realIntro, realLines, realMethod } from '../data/real.ts';
import { STRESS, STRESS_FREEZE_NOTE, stressFoldAbout, stressLimitDetail, stressPageIntro } from '../data/stress.ts';
import { SWEEP, sweepIntro, sweepLines, sweepTitle } from '../data/sweep.ts';
import { inline } from '../lib/markdown.ts';

const TITLE = 'Tokens on every case';

export const Route = createFileRoute('/benchmark')({
  head: () => docHead('/benchmark', TITLE),
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

/** Running text. On wide screens it sits in the right column, so it ends on the same edge as the blocks. */
function Text({ children }: { readonly children: ReactNode }) {
  return <div className="bench-text">{children}</div>;
}

/**
 * Results first, each with a short intro. Tables, method and the record sit in folds
 * that open by click or by anchor link. /benchmark.md keeps every section in full.
 */
function BenchmarkPage() {
  const keepElse = benchmarkKeepElseAll(BENCH, COUNTERS);
  const costMethod = benchmarkCostMethod(COUNTERS);
  const toon = smallerThanToon(ACCURACY, COUNTERS);
  const sampleLine = sampleTotalsLine(BENCH, COUNTERS);
  return (
    <DocPage
      kicker={BENCH.status === 'pending' ? 'Benchmark, numbers pending' : 'Benchmark'}
      title={TITLE}
      lead={`${countersHeadline(BENCH, COUNTERS)} ${countersPageNote(BENCH, COUNTERS)}`}
      actions={
        <a className="btn btn-line" href="/benchmark.md">
          Raw benchmark.md
        </a>
      }
    >
      <div className="bench-page">
        <section className="doc-section bench-sec proof-first" id="accuracy" aria-labelledby="acc-h">
          <h2 id="acc-h">{proofHeading(ACCURACY)}</h2>
          <Text>
            <p>{accuracyIntro(ACCURACY)}</p>
          </Text>
          <BigNumbers file={ACCURACY} />
          <Text>
            <p>{accuracyOverlapLine(ACCURACY)}</p>
            <p>{TUNING_NOTE}</p>
          </Text>
          <div className="folds">
            <Fold title="Accuracy results by format" about="Right answers, accuracy, 95% interval, input tokens and cost for each format on each model.">
              <AccuracyTables file={ACCURACY} />
            </Fold>
            <Fold title="Input tokens per accuracy data set" about={datasetFoldAbout(ACCURACY)}>
              <h3 id="ds-h" className="sr">
                Input tokens per accuracy data set
              </h3>
              <DatasetChart file={ACCURACY} headingId="ds-h" />
              <KindTable file={ACCURACY} />
            </Fold>
          </div>
        </section>
        <section className="doc-section bench-sec" aria-labelledby="cost-bars-h">
          <h2 id="cost-bars-h">Cost per format</h2>
          <Text>
            <p>What answering every question cost in each format, on each model.</p>
          </Text>
          <CostBars file={ACCURACY} headingId="cost-bars-h" />
        </section>
        <section className="doc-section bench-sec" aria-labelledby="sum-h">
          <h2 id="sum-h">Sample cases</h2>
          <Text>
            <p>Made-up data in common shapes, all drawn from one fixed seed.</p>
          </Text>
          <BenchChart bench={BENCH} counters={COUNTERS} headingId="bench-h" flat table={false} />
          {sampleLine === '' && toon === null ? null : (
            <Text>
              {sampleLine === '' ? null : <p>{sampleLine}</p>}
              {toon === null ? null : <p>{smallerThanToonLine(toon)}</p>}
            </Text>
          )}
          <div className="folds">
            {COUNTERS !== null && (
              <Fold title="Sample tables" about="Every sample case on each counter with its input cost at list price, the full totals and the byte sizes.">
                <Text>
                  <Lines lines={benchmarkSampleTotals(BENCH, COUNTERS)} />
                  <p className="bytes-line" dangerouslySetInnerHTML={{ __html: inline(bytesLine(BYTES)) }} />
                </Text>
                <SampleTables counters={COUNTERS} />
              </Fold>
            )}
            {BENCH.status === 'ready' && (
              <Fold title={sweepTitle(SWEEP)} tag={SWEEP.tokenizer} about="How often each sample result holds when the same case shapes get new data." bodyId="sweep">
                <Text>
                  <p>{sweepIntro(SWEEP)}</p>
                  {/* The sample seed check reads the committed file, never the dev fixture. */}
                  <Lines lines={sweepLines(SWEEP, BENCH_FILE)} />
                </Text>
                <SweepTable sweep={SWEEP} />
              </Fold>
            )}
          </div>
        </section>
        <section className="doc-section bench-sec" id="stress" aria-labelledby="stress-h">
          <h2 id="stress-h">Stress test</h2>
          <Text>
            <p>{stressPageIntro(STRESS)}</p>
          </Text>
          <StressHeadline file={STRESS} />
          <div className="folds">
            <Fold title="Results by group" about={stressFoldAbout(STRESS)}>
              <Text>
                <p>{stressLimitDetail(STRESS)}</p>
                <p dangerouslySetInnerHTML={{ __html: inline(STRESS_FREEZE_NOTE) }} />
              </Text>
              <StressGroupTables file={STRESS} />
            </Fold>
          </div>
        </section>
        <section className="doc-section bench-sec" id="real-data" aria-labelledby="real-h">
          <h2 id="real-h" className="with-tag">
            Real data
            <span className="tok">{REAL.tokenizer}</span>
          </h2>
          <Text>
            <p>{realIntro(REAL)}</p>
          </Text>
          <RealTable data={REAL} />
          <div className="folds">
            <Fold title="Files and sources" about="Each file's result in words, where the files came from, and how they were frozen.">
              <Text>
                <Lines lines={realLines(REAL)} />
                <p className="tbl-note" dangerouslySetInnerHTML={{ __html: inline(realMethod(REAL)) }} />
              </Text>
            </Fold>
          </div>
        </section>
        {keepElse.length > 0 && (
          <section className="doc-section bench-sec" aria-labelledby="else-h">
            <h2 id="else-h">When to keep something else</h2>
            <Text>
              <Lines lines={keepElse} />
            </Text>
          </section>
        )}
        <section className="doc-section bench-sec" aria-labelledby="record-h">
          <h2 id="record-h">Method and record</h2>
          <Text>
            <p>How each number was made, the runs behind it, its limits and every change to it.</p>
          </Text>
          <div className="folds">
            <Fold title="Accuracy method" about="Where the questions come from, how answers were scored and priced, and every answer on file.">
              <Text>
                <Lines lines={accuracyMethod(ACCURACY)} />
                <p>{HISTORY_NOTE}</p>
              </Text>
            </Fold>
            <Fold title="Published runs" about="Every accuracy run, with what the tables take from it." bodyId="published-runs">
              <PublishedRunsTable file={ACCURACY} />
            </Fold>
            <Fold title="Method" about="How each token count was made, how each format was written, and how the seed sweep ran.">
              <Text>
                <Lines lines={benchmarkMethod(BENCH, CLAUDE)} />
              </Text>
            </Fold>
            {costMethod.length > 0 && (
              <Fold title="Cost method" about="How the input cost of each case was worked out, and the prices used.">
                <Text>
                  <Lines lines={costMethod} />
                </Text>
              </Fold>
            )}
            <Fold title="Limits" about="What these numbers do not show.">
              <Text>
                <Lines lines={benchmarkLimits(COUNTERS)} />
              </Text>
            </Fold>
            {/* The history names both counters, so it shows only when both are ready. */}
            {COUNTERS !== null && COUNTERS.claude !== null && (
              <Fold title="Number history" about="Every published number that moved, why, and the pull request that moved it." bodyId="history">
                <HistoryTable />
              </Fold>
            )}
          </div>
        </section>
      </div>
    </DocPage>
  );
}
