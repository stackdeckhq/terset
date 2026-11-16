// Small pieces of the /docs page: inline Markdown text, headings with an
// anchor link, the language switch and plain data tables.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { DOC_LANGS, LANG_LABELS } from '../../data/docs.ts';
import { inline } from '../../lib/markdown.ts';
import { useDocLang } from '../../lib/language.ts';

/** Text from the docs source with `code`, **bold** and links. inline() escapes everything else. */
export function Inline({ text, as: Tag = 'span', className }: { readonly text: string; readonly as?: 'span' | 'p' | 'li' | 'td'; readonly className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: inline(text) }} />;
}

/** A heading with a visible "#" link to itself. The link's name says which section it points to. */
export function Anchored({ level, id, children, label }: { readonly level: 2 | 3; readonly id: string; readonly children: ReactNode; readonly label: string }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} className="anchored">
      {children}
      <a className="anchor" href={`#${id}`} aria-label={`Link to ${label}`}>
        #
      </a>
    </Tag>
  );
}

/** The JavaScript or Python switch. Every copy on the page shares one remembered choice. */
export function LangSwitch() {
  const [lang, setLang] = useDocLang();
  const id = useId();
  return (
    <fieldset className="pm lang-switch">
      <legend className="sr">Language</legend>
      {DOC_LANGS.map((name) => (
        <span key={name} className="pm-opt">
          <input
            type="radio"
            id={`${id}-${name}`}
            name={`${id}-lang`}
            value={name}
            checked={lang === name}
            onChange={() => {
              setLang(name);
            }}
          />
          <label htmlFor={`${id}-${name}`}>{LANG_LABELS[name]}</label>
        </span>
      ))}
    </fieldset>
  );
}

export interface DataTableProps {
  readonly caption: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** A plain table. The first cell of each row heads the row. Cells take inline Markdown. */
export function DataTable({ caption, head, rows }: DataTableProps) {
  return (
    <div className="tablewrap scroll-x on-light" tabIndex={0} role="region" aria-label={caption}>
      <table>
        <caption className="sr">{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, index) =>
                index === 0 ? <th key={index} scope="row" dangerouslySetInnerHTML={{ __html: inline(cell) }} /> : <Inline key={index} as="td" text={cell} />,
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
