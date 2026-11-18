import { createFileRoute } from '@tanstack/react-router';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { PACKAGE_VERSION } from '../data/site.ts';
import spec from '../generated/spec.md?raw';
import { parseMarkdown, withoutTitle } from '../lib/markdown.ts';

// The page shows its own h1, so the spec's title is left out here. /spec.md keeps it.
const DOC = parseMarkdown(withoutTitle(spec));
const TITLE = 'The Terset format';

export const Route = createFileRoute('/format')({
  head: () => docHead('/format', TITLE),
  component: FormatPage,
});

function FormatPage() {
  return (
    <DocPage
      kicker={`Spec for ${PACKAGE_VERSION}`}
      title={TITLE}
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
