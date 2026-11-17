// The proof charts: three big numbers, the cost bars per model and Terset against TOON
// and compact JSON on every benchmark data set. Every figure comes from proof.ts.
// Bars start at zero. Wins are in the accent; losses stay plain and visible.
// Each chart carries real text for screen readers; the drawn bars are hidden from them.
import type { CSSProperties } from 'react';
import type { AccuracyFile, AccuracyModel } from '../data/accuracy.ts';
import { formatCount } from '../data/bench.ts';
import { DATASET_NOTE, bigNumbers, bigNumbersNote, costBars, costNote, datasetRows, datasetScale, datasetSummary, modelTokenizer } from '../data/proof.ts';
import type { Comparison, DatasetRow } from '../data/proof.ts';

/** "fewer input tokens" as a caption: "Fewer input tokens". */
function caption(label: string): string {
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

/**
 * Three big numbers: fewer input tokens and lower cost than compact JSON, and right answers.
 * Each card names its metric first, then one column per model with the model before its number,
 * so a screen reader hears "Fewer input tokens than compact JSON, Opus 32.7%, Sol 27.3%".
 * The spaces keep the words apart when the text is read or copied as one run.
 */
export function BigNumbers({ file }: { readonly file: AccuracyFile }) {
  return (
    <div className="big">
      <ul className="big-row">
        {bigNumbers(file).map((item) => (
          <li key={item.id} className={item.win ? 'big-n win' : 'big-n'}>
            <span className="big-l">{caption(item.label)}</span>{' '}
            <span className="big-v">
              {item.values.map((value) => (
                <span key={value.model} className="big-c">
                  <small>{value.model}</small>{' '}
                  <b>
                    {value.figure}
                    {value.tail === '' ? null : <span className="big-t">{value.tail}</span>}
                  </b>{' '}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="tbl-note">{bigNumbersNote(file)}</p>
    </div>
  );
}

function CostModel({ model }: { readonly model: AccuracyModel }) {
  const bars = costBars(model);
  return (
    <div className="cost-model">
      <h3>{model.name}</h3>
      <ul className="cost-bars">
        {bars.map((bar) => (
          <li key={bar.format} className={['cost-bar', bar.terset ? 'terset' : '', bar.cheapest ? 'min' : ''].filter(Boolean).join(' ')}>
            <span className="cost-l">{bar.label}</span>
            <span className="cost-t" aria-hidden="true">
              <i style={{ '--f': bar.fraction.toFixed(4) } as CSSProperties} />
            </span>
            <span className="cost-v">
              <b>{bar.costText}</b>
              {bar.runs.map((line) => (
                <small key={line}>{line}</small>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cost at API list price of each format, one group per model, Terset first. */
export function CostBars({ file, headingId, title }: { readonly file: AccuracyFile; readonly headingId: string; readonly title?: string }) {
  return (
    <figure className="cost" aria-labelledby={headingId}>
      {title === undefined ? null : (
        <h3 id={headingId} className="cost-h">
          {title}
        </h3>
      )}
      <div className="cost-grid">
        {file.models.map((model) => (
          <CostModel key={model.id} model={model} />
        ))}
      </div>
      <figcaption className="tbl-note">{costNote(file)}</figcaption>
    </figure>
  );
}

interface Scale {
  readonly save: number;
  readonly lose: number;
}

function scaleStyle(scale: Scale): CSSProperties {
  return { '--z': (scale.save / (scale.save + scale.lose)).toFixed(4) } as CSSProperties;
}

/** One thin bar from the zero line: left for fewer tokens, right for more. A tie draws none. */
function Diverge({ base, comparison, scale }: { readonly base: string; readonly comparison: Comparison; readonly scale: Scale }) {
  const width = comparison.verdict === 'tie' ? 0 : Math.min(1, Math.abs(comparison.change) / (scale.save + scale.lose));
  return (
    <span className={`dv ${comparison.verdict}`}>
      <span className="dv-n">{base}</span>
      <span className="dv-t">
        <i style={{ '--w': width.toFixed(4) } as CSSProperties} />
      </span>
      <b className="dv-v">{comparison.text}</b>
    </span>
  );
}

function spokenComparison(base: string, tokens: number, comparison: Comparison): string {
  return comparison.verdict === 'tie' ? `${base} ${formatCount(tokens)}, a tie` : `${base} ${formatCount(tokens)}, ${comparison.text}`;
}

function spoken(row: DatasetRow): string {
  return `${row.label}: Terset ${formatCount(row.terset)} input tokens. ${spokenComparison('TOON', row.toon, row.vsToon)}. ${spokenComparison('compact JSON', row.json, row.vsJson)}.`;
}

function DatasetModel({ file, model, scale }: { readonly file: AccuracyFile; readonly model: AccuracyModel; readonly scale: Scale }) {
  const rows = datasetRows(file, model);
  const percent = (share: number): string => `${String(Math.round(share * 100))}%`;
  return (
    <div className="ds-model">
      <h3>
        {model.name} <span className="tok">{modelTokenizer(model)}</span>
      </h3>
      <p className="ds-sum">{datasetSummary(rows)}</p>
      <div className="ds-axis" aria-hidden="true" style={scaleStyle(scale)}>
        <span className="ds-axis-t">
          <span className="lo">−{percent(scale.save)}</span>
          <span className="zero">0</span>
          <span className="hi">+{percent(scale.lose)}</span>
        </span>
      </div>
      <ul className="ds-rows" style={scaleStyle(scale)}>
        {rows.map((row) => (
          <li key={row.kind} className={row.vsToon.verdict === 'more' || row.vsJson.verdict === 'more' ? 'ds-row has-more' : 'ds-row'}>
            <span className="ds-l" aria-hidden="true">
              {row.label}
            </span>
            <span className="ds-b" aria-hidden="true">
              <Diverge base="TOON" comparison={row.vsToon} scale={scale} />
              <Diverge base="JSON" comparison={row.vsJson} scale={scale} />
            </span>
            <span className="sr">{spoken(row)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Terset input tokens against TOON and compact JSON on every data set, one column per model, on one shared scale. */
export function DatasetChart({ file, headingId }: { readonly file: AccuracyFile; readonly headingId: string }) {
  const scale = datasetScale(file);
  return (
    <figure className="ds" aria-labelledby={headingId}>
      <div className="ds-grid">
        {file.models.map((model) => (
          <DatasetModel key={model.id} file={file} model={model} scale={scale} />
        ))}
      </div>
      <figcaption className="tbl-note">{DATASET_NOTE}</figcaption>
    </figure>
  );
}
