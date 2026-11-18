// A folded part of /benchmark: detail most readers skip, one click away.
// It is a native details element, so it opens by click and by keyboard with no script,
// and its content stays in the prerendered HTML. An anchor id goes on the body, never on
// the details element: the browser opens a closed fold only when the link target is inside it.
import type { ReactNode } from 'react';

export interface FoldProps {
  /** The name of what is inside, such as "Method". */
  readonly title: string;
  /** A tokenizer or counter tag shown after the title. */
  readonly tag?: string;
  /** One plain sentence on what the fold holds. */
  readonly about: string;
  /** The anchor id that links to this fold and opens it. */
  readonly bodyId?: string;
  readonly children: ReactNode;
}

export function Fold({ title, tag, about, bodyId, children }: FoldProps) {
  return (
    <details className="fold">
      <summary>
        <span className="fold-t">
          {title}
          {tag === undefined ? null : <span className="tok">{tag}</span>}
        </span>
        <span className="fold-d">{about}</span>
      </summary>
      <div className="fold-body" id={bodyId}>
        {children}
      </div>
    </details>
  );
}
