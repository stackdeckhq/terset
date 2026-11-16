// "On this page" for /docs. Wide screens get a sticky list that marks the
// section in view. Narrow screens get a contents block that opens and closes.
import { useEffect, useRef, useState } from 'react';
import { DOCS_SECTIONS } from '../../data/docs.ts';
import type { DocsSectionId } from '../../data/docs.ts';

/** The section whose heading last passed the top of the screen, below the sticky header. */
function useCurrentSection(): DocsSectionId {
  const [current, setCurrent] = useState<DocsSectionId>(DOCS_SECTIONS[0].id);
  useEffect(() => {
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const top = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 80;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let next: DocsSectionId = DOCS_SECTIONS[0].id;
      for (const section of DOCS_SECTIONS) {
        const heading = document.getElementById(section.id);
        if (heading !== null && heading.getBoundingClientRect().top <= top + 24) next = section.id;
      }
      if (atEnd) next = DOCS_SECTIONS[DOCS_SECTIONS.length - 1]?.id ?? next;
      setCurrent(next);
    };
    const schedule = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return current;
}

function Links({ current, onPick }: { readonly current?: DocsSectionId; readonly onPick?: () => void }) {
  return (
    <ol>
      {DOCS_SECTIONS.map((section) => (
        <li key={section.id}>
          <a href={`#${section.id}`} aria-current={section.id === current ? 'location' : undefined} onClick={onPick}>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function DocsToc() {
  const current = useCurrentSection();
  const phone = useRef<HTMLDetailsElement>(null);
  return (
    <div className="docs-toc">
      <nav className="toc" aria-labelledby="toc-h">
        <h2 id="toc-h">On this page</h2>
        <Links current={current} />
      </nav>
      <details className="toc-phone" ref={phone}>
        <summary>On this page</summary>
        <nav aria-label="On this page">
          <Links
            onPick={() => {
              if (phone.current !== null) phone.current.open = false;
            }}
          />
        </nav>
      </details>
    </div>
  );
}
