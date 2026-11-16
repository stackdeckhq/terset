// Step 8: one prompt for a coding agent, and the raw files it reads.
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { rawUrl } from '../../data/site.ts';
import type { RawPath } from '../../data/site.ts';
import { CopyButton } from '../CopyButton.tsx';
import { ArrowIcon, FileIcon } from '../Icons.tsx';
import { PromptCard } from '../PromptCard.tsx';
import { Reveal, Step } from './Step.tsx';

interface HomeFile {
  readonly path: RawPath;
  readonly name: string;
  readonly about: string;
}

// One line each at desktop width: the card's description row is short on purpose.
const HOME_FILES: readonly HomeFile[] = [
  { path: '/agents.md', name: 'agents.md', about: 'The agent guide' },
  { path: '/llms.txt', name: 'llms.txt', about: 'An index for models' },
  { path: '/skill/SKILL.md', name: 'SKILL.md', about: 'A skill for any agent' },
];

/** One file card: the name links to the file and covers the card; the copy button sits above that link. */
function FileCard({ file }: { readonly file: HomeFile }) {
  const id = useId();
  return (
    <li>
      <FileIcon />
      <a href={file.path} id={id}>
        {file.name}
      </a>
      <CopyButton getText={() => rawUrl(file.path)} label="Copy URL" describedBy={id} />
      <p>{file.about}</p>
    </li>
  );
}

export function StepAgent() {
  return (
    <Step id="b8" title="One prompt teaches your agent.">
      <Reveal className="vis">
        <PromptCard />
        <ul className="files" aria-label="Agent files">
          {HOME_FILES.map((file) => (
            <FileCard key={file.path} file={file} />
          ))}
        </ul>
        <p className="files-more">
          <Link to="/agents">
            All agent files <ArrowIcon />
          </Link>
        </p>
      </Reveal>
    </Step>
  );
}
