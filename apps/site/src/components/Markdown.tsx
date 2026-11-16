// Renders a parsed doc: prose as HTML, code fences as code windows.
import type { Block } from '../lib/markdown.ts';
import { CodeBlock, colorize } from './CodeBlock.tsx';

const LABELS: Readonly<Record<string, string>> = { terset: 'Terset', json: 'JSON', js: 'JavaScript', ts: 'TypeScript', abnf: 'Grammar', text: 'Text', sh: 'Shell' };

export function Markdown({ blocks }: { readonly blocks: readonly Block[] }) {
  return (
    <div className="prose">
      {blocks.map((block, i) =>
        block.kind === 'html' ? (
          // The HTML comes from this repo's own Markdown, escaped by parseMarkdown.
          <div key={i} className="prose-part" dangerouslySetInnerHTML={{ __html: block.html }} />
        ) : (
          <CodeBlock key={i} label={LABELS[block.lang] ?? 'Code'} text={block.text} html={colorize(block.lang, block.text)} wrap={block.lang !== 'terset'} />
        ),
      )}
    </div>
  );
}
