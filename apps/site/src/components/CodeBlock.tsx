// A code window: a header with a name and a copy button, then colored code.
import { useId } from 'react';
import { highlight } from '../lib/format.ts';
import { hlJson } from '../lib/highlight.ts';
import { esc } from '../lib/text.ts';
import { CopyButton } from './CopyButton.tsx';

/** Colors code by its fence language. Unknown languages stay plain. Terset tables line up. */
export function colorize(lang: string, text: string): string {
  if (lang === 'terset') return highlight(text, { align: true });
  if (lang === 'json') return hlJson(text);
  return esc(text);
}

export interface CodeBlockProps {
  readonly label: string;
  readonly text: string;
  /** Escaped HTML for the code. Defaults to plain escaped text. */
  readonly html?: string;
  readonly className?: string;
  /** Wrap long lines. Off keeps a table's columns and scrolls inside the window. */
  readonly wrap?: boolean;
}

export function CodeBlock({ label, text, html, className, wrap = true }: CodeBlockProps) {
  const id = useId();
  return (
    <div className={className === undefined ? 'code' : `code ${className}`}>
      <div className="code-h">
        <span className="fn" id={id}>
          {label}
        </span>
        <CopyButton getText={() => text} describedBy={id} />
      </div>
      <pre className={wrap ? 'wrap-pre' : 'scroll-x'} tabIndex={wrap ? undefined : 0} aria-labelledby={wrap ? undefined : id} dangerouslySetInnerHTML={{ __html: html ?? esc(text) }} />
    </div>
  );
}
