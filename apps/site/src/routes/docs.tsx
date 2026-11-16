import { createFileRoute } from '@tanstack/react-router';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { DocsToc } from '../components/docs/DocsToc.tsx';
import { ApiSection, CheatSheetSection, ErrorsSection, InstallSection, LinksSection, QuickStartSection, RulesSection, WhenNotSection } from '../components/docs/DocsSections.tsx';
import { DOCS_DESCRIPTION, DOCS_LEAD, DOCS_TITLE } from '../data/docs.ts';
import { PACKAGE_VERSION } from '../data/site.ts';

export const Route = createFileRoute('/docs')({
  head: () => docHead('/docs', 'Docs', DOCS_DESCRIPTION),
  component: DocsPage,
});

function DocsPage() {
  return (
    <DocPage
      kicker={`Reference for ${PACKAGE_VERSION}`}
      title={DOCS_TITLE}
      lead={DOCS_LEAD}
      toc={<DocsToc />}
      actions={
        <a className="btn btn-line" href="/docs.md">
          Raw docs.md
        </a>
      }
    >
      <InstallSection />
      <QuickStartSection />
      <CheatSheetSection />
      <ApiSection />
      <RulesSection />
      <ErrorsSection />
      <WhenNotSection />
      <LinksSection />
    </DocPage>
  );
}
