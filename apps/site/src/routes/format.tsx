import { createFileRoute } from '@tanstack/react-router';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { formatDoc } from '../data/versions.ts';
import spec from '../generated/spec.md?raw';

// The page shows its own h1, so the spec's title is left out here. /spec.md keeps it.
// The versions table and the worked example go between the spec's opening and its first section.
const DOC = formatDoc(spec);
const TITLE = 'The Terset format';

export const Route = createFileRoute('/format')({
  head: () => docHead('/format', TITLE),
  component: FormatPage,
});

function FormatPage() {
  return (
    <DocPage
      kicker="The format spec"
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
