import { createFileRoute } from '@tanstack/react-router';
import { useId } from 'react';
import { CopyButton } from '../components/CopyButton.tsx';
import { DocPage, docHead } from '../components/DocPage.tsx';
import { HandlesTechnique } from '../components/HandlesTechnique.tsx';
import { SkillIcon } from '../components/Icons.tsx';
import { Markdown } from '../components/Markdown.tsx';
import { PromptCard } from '../components/PromptCard.tsx';
import { formatCount } from '../data/numbers.ts';
import { RAW_FILES, rawUrl } from '../data/site.ts';
import type { RawFile, RawPath } from '../data/site.ts';
import { SIZES } from '../data/sizes.ts';
import agentsGuide from '../generated/agents.md?raw';
import { RULES_PLACEMENT } from '../lib/format.ts';
import { parseMarkdown } from '../lib/markdown.ts';

const DESCRIPTION = 'What a coding agent needs to use Terset: one prompt to paste, the agent guide, a skill file, the spec, llms.txt and the short-handles technique.';

export const Route = createFileRoute('/agents')({
  head: () => docHead('/agents', 'Agents', DESCRIPTION),
  component: AgentsPage,
});

const NEEDS: readonly (readonly [string, string])[] = [
  ['When to use it.', 'Lists of records that share keys. Keep JSON for config and tiny data.'],
  ['How to call it.', 'encode() for the data, and rulesFor(text) for the rules that text needs.'],
  ['Where the rules go.', RULES_PLACEMENT],
  ['What to ask for.', 'Answers in JSON. Terset is for reading.'],
];

const SKILL_PATH: RawPath = '/skill/SKILL.md';
const SKILL_FILE: RawFile | undefined = RAW_FILES.find((file) => file.path === SKILL_PATH);

/** The "How to read it" section of the generated agent guide, so the page and agents.md never drift. */
function readingSection(guide: string): string {
  const start = guide.indexOf('## How to read it');
  if (start < 0) throw new Error('agents.md has no "How to read it" section');
  const end = guide.indexOf('\n## ', start + 1);
  return guide.slice(start, end < 0 ? undefined : end).replace(/^## How to read it\n/u, '');
}
const READING = parseMarkdown(readingSection(agentsGuide));

function tokens(path: RawPath): string {
  return `${formatCount(SIZES.files[path])} tokens`;
}

function FileTools({ path, nameId }: { readonly path: RawPath; readonly nameId: string }) {
  return (
    <div className="card-actions raw-tools">
      <CopyButton getText={() => rawUrl(path)} label="Copy URL" describedBy={nameId} onLight />
      <a className="mini-btn on-light" href={path} aria-describedby={nameId}>
        Open
      </a>
    </div>
  );
}

function RawRow({ file }: { readonly file: RawFile }) {
  const id = useId();
  return (
    <li>
      <code className="raw-name" id={id}>
        {file.label}
      </code>
      <p className="raw-about">{file.about}</p>
      <span className="raw-size">{tokens(file.path)}</span>
      <FileTools path={file.path} nameId={id} />
    </li>
  );
}

function SkillSection() {
  const id = useId();
  if (SKILL_FILE === undefined) return null;
  return (
    <section className="doc-section" aria-labelledby="skill-h">
      <h2 id="skill-h">Skill</h2>
      <div className="skill-card">
        <span className="skill-ic" aria-hidden="true">
          <SkillIcon />
        </span>
        <div className="skill-t">
          <p>
            <code id={id}>{SKILL_FILE.label}</code> <span className="raw-size">{tokens(SKILL_PATH)}</span>
          </p>
          <p>{SKILL_FILE.about}</p>
        </div>
        <FileTools path={SKILL_PATH} nameId={id} />
      </div>
    </section>
  );
}

function AgentsPage() {
  return (
    <DocPage kicker="For agents" title="Teach your agent Terset" lead="Paste one prompt, or point the agent at the raw files.">
      <PromptCard level={2} />
      <section className="doc-section" aria-labelledby="files-h">
        <h2 id="files-h">Raw files</h2>
        <p>Every file is plain text with its own content type. Sizes are o200k_base tokens.</p>
        <div className="raw-head" aria-hidden="true">
          <span>File</span>
          <span>What it is for</span>
          <span>Size</span>
          <span />
        </div>
        <ul className="raw-list" aria-label="Raw files">
          {RAW_FILES.map((file) => (
            <RawRow key={file.path} file={file} />
          ))}
        </ul>
      </section>
      <SkillSection />
      <section className="doc-section" aria-labelledby="needs-h">
        <h2 id="needs-h">What an agent needs</h2>
        <ul className="steps-list">
          {NEEDS.map(([title, body]) => (
            <li key={title}>
              <b>{title}</b> {body}
            </li>
          ))}
        </ul>
      </section>
      <section className="doc-section" aria-labelledby="read-h">
        <h2 id="read-h">How to read a Terset table</h2>
        <Markdown blocks={READING.blocks} />
      </section>
      <HandlesTechnique />
    </DocPage>
  );
}
