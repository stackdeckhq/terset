// Where Terset does not help, and the limits the encoder enforces.
// Every figure comes from the bench data and reads "pending" until it is published.
import type { Trio } from '../../data/bench-schema.ts';
import { BENCH, PENDING_LABEL, csvNote, formatCount, pct } from '../../data/numbers.ts';
import { SIZE_LINE } from '../../data/size.ts';

interface KeepItem {
  readonly title: string;
  readonly why: string;
  readonly figure?: string;
}

const CONFIG = BENCH.status === 'ready' ? BENCH.samples.config : null;
const CSV_NOTE = csvNote(BENCH);

/** Why the config sample gains little. It has no table, so rulesFor gives no rules; the counts say the rest. */
export function configWhy(config: Trio | null): string {
  const head = 'Nothing to put in a table, so Terset sends no rules';
  if (config === null) return `${head} and has little to save.`;
  if (config.terset === config.json) return `${head} and ties compact JSON.`;
  if (config.terset < config.json) return `${head} and saves little over compact JSON.`;
  return `${head}, and compact JSON is still smaller.`;
}

const ITEMS: readonly KeepItem[] = [
  {
    title: 'Deep config, no lists',
    why: configWhy(CONFIG),
    figure: CONFIG === null ? `Tokens: ${PENDING_LABEL.toLowerCase()}` : `Config sample: ${formatCount(CONFIG.terset)} vs ${formatCount(CONFIG.json)} tokens, ${pct(CONFIG.terset, CONFIG.json)}`,
  },
  ...(CSV_NOTE === '' ? [] : [{ title: 'Flat lists you control', why: CSV_NOTE }]),
  { title: 'The model writes it back', why: 'Terset is for reading. Ask the model to answer in JSON.' },
  { title: 'Other parsers read it', why: 'Only the reference decoder reads Terset today.' },
];

const LIMITS: readonly string[] = [
  'A numeric -0 is an explicit error. It is never turned into 0 silently.',
  'Nesting deeper than 500 levels is an explicit error.',
  'A list of objects nested inside a record stays JSON inside its cell.',
  SIZE_LINE,
];

export function KeepJson() {
  return (
    <section className="step keep" id="when-not" aria-labelledby="h-not">
      <h2 id="h-not">When to keep something else.</h2>
      <ul className="klist">
        {ITEMS.map((item) => (
          <li key={item.title}>
            <div>
              <b>{item.title}</b>
              <span>{item.why}</span>
              {item.figure === undefined ? null : <code>{item.figure}</code>}
            </div>
          </li>
        ))}
      </ul>
      <details className="more">
        <summary>
          <h3 className="limits-h">Limits</h3>
        </summary>
        <ul className="limits">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
