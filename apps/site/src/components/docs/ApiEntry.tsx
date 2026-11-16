// One API reference entry on /docs, in the chosen language: summary,
// signature, parameters, return value, errors, an example and its output,
// then one line on how this language differs.
import type { ApiEntry as Entry } from '../../data/docs-api.ts';
import { exampleFence } from '../../data/docs-api.ts';
import { LANG_LABELS } from '../../data/docs.ts';
import type { DocLang } from '../../data/docs.ts';
import { highlight, tables } from '../../lib/format.ts';
import { esc } from '../../lib/text.ts';
import { CodeBlock } from '../CodeBlock.tsx';
import { Anchored, DataTable, Inline } from './parts.tsx';

const FENCE_LABELS: Readonly<Record<string, string>> = { js: 'JavaScript', ts: 'TypeScript', python: 'Python' };

/** An output that holds a Terset table is colored with its columns lined up. Any other output stays plain. */
export function outputHtml(output: string): string {
  return tables(output).length > 0 ? highlight(output, { align: true }) : esc(output);
}

export function ApiEntry({ entry, lang }: { readonly entry: Entry; readonly lang: DocLang }) {
  const name = entry.name[lang];
  const params = entry.params[lang];
  const errors = entry.errors[lang];
  const example = entry.example[lang];
  return (
    <section className="api-entry" aria-labelledby={entry.id}>
      <Anchored level={3} id={entry.id} label={name}>
        <code>{name}</code>
      </Anchored>
      <Inline as="p" text={entry.summary} />
      <CodeBlock label="Signature" text={entry.signature[lang]} wrap={false} />
      {params.length === 0 ? null : (
        <>
          <h4>Parameters</h4>
          <DataTable caption={`${name} parameters`} head={['Name', 'Type', 'About']} rows={params.map((param) => [`\`${param.name}\``, `\`${param.type}\``, param.about])} />
        </>
      )}
      <h4>Returns</h4>
      <Inline as="p" text={entry.returns[lang]} />
      <h4>Errors</h4>
      {errors.length === 0 ? (
        <p>None.</p>
      ) : (
        <DataTable caption={`${name} errors`} head={['Error', 'When']} rows={errors.map((error) => [`\`${error.type}\``, error.when])} />
      )}
      <h4>Example</h4>
      <CodeBlock label={FENCE_LABELS[exampleFence(entry, lang)] ?? 'Code'} text={example.code} />
      <CodeBlock label="Output" text={example.output} html={outputHtml(example.output)} wrap={false} className="code-out" />
      <p className="lang-diff">
        <b>In {LANG_LABELS[lang]}:</b> <Inline text={entry.differs[lang]} />
      </p>
    </section>
  );
}
