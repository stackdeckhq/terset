import { createFileRoute } from '@tanstack/react-router';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { PACKAGE_VERSION } from '../data/site.ts';
import spec from '../generated/spec.md?raw';
import { parseMarkdown } from '../lib/markdown.ts';

const DOC = parseMarkdown(spec);
const DESCRIPTION = 'Every rule of the Terset format: the root object or array, counted and keyed tables, dotted columns, cells, quoting, nested values and decoding.';

export const Route = createFileRoute('/format')({
  head: () => docHead('/format', 'Format', DESCRIPTION),
  component: FormatPage,
});

function FormatPage() {
  return (
    <DocPage
      kicker={`Spec for ${PACKAGE_VERSION}`}
      title="The Terset format"
      lead="One table for a set of records. Every rule is here. The raw file is at /spec.md."
      headings={DOC.headings}
      actions={
        <a className="btn btn-line" href="/spec.md">
          Raw spec.md
        </a>
      }
    >
      <Markdown blocks={DOC.blocks} />
    </DocPage>
  );
}
