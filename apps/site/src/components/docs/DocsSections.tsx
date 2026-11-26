// The sections of /docs, in page order. All text comes from src/data/docs.ts
// and docs-api.ts, so the page, /docs.md and the READMEs say the same thing.
import { useId } from 'react';
import type { ReactNode } from 'react';
import { API } from '../../data/docs-api.ts';
import {
  API_INTRO,
  CHEAT_INTRO,
  CHEAT_SHEET,
  DEPTH_NOTE,
  DOC_LINKS,
  ERROR_KINDS,
  ERROR_MESSAGES,
  EXPORTS_LINE,
  IMPLEMENTATIONS_CAPTION,
  IMPLEMENTATIONS_HEAD,
  IMPLEMENTATIONS_NOTE,
  IMPLEMENTATIONS_ROWS,
  INSTALL,
  LANG_LABELS,
  LANG_NOTES,
  LIMITS,
  NEVER_BY_HAND,
  QUICK_START,
  QUICK_START_INTRO,
  RULES_INTRO,
  RULES_PARTS,
  VERSION_LINE,
  WHEN_NOT,
  quickStartCommand,
  quickStartSteps,
  sectionTitle,
} from '../../data/docs.ts';
import type { DocsSectionId } from '../../data/docs.ts';
import { GENERATED } from '../../data/generated.ts';
import { RULES, highlight } from '../../lib/format.ts';
import { useDocLang } from '../../lib/language.ts';
import { CodeBlock, colorize } from '../CodeBlock.tsx';
import { CopyButton } from '../CopyButton.tsx';
import { InstallLine } from '../InstallLine.tsx';
import { ApiEntry } from './ApiEntry.tsx';
import { Anchored, DataTable, Inline, LangSwitch } from './parts.tsx';

function Section({ id, children }: { readonly id: DocsSectionId; readonly children: ReactNode }) {
  const title = sectionTitle(id);
  return (
    <section className="doc-section docs-section" aria-labelledby={id}>
      <Anchored level={2} id={id} label={title}>
        {title}
      </Anchored>
      {children}
    </section>
  );
}

function PipLine() {
  const id = useId();
  const command = INSTALL.py.commands[0]?.command ?? '';
  return (
    <div className="install">
      <span className="install-cmd">
        <code id={id}>{command}</code>
        <CopyButton getText={() => command} describedBy={id} onLight />
      </span>
    </div>
  );
}

export function InstallSection() {
  const [lang] = useDocLang();
  return (
    <Section id="install">
      <Inline as="p" text={VERSION_LINE} />
      <DataTable caption={IMPLEMENTATIONS_CAPTION} head={IMPLEMENTATIONS_HEAD} rows={IMPLEMENTATIONS_ROWS} />
      <Inline as="p" className="docs-note-line" text={IMPLEMENTATIONS_NOTE} />
      <LangSwitch />
      {lang === 'js' ? <InstallLine /> : <PipLine />}
      <p className="docs-note-line">{INSTALL[lang].note}</p>
    </Section>
  );
}

export function QuickStartSection() {
  const [lang] = useDocLang();
  const sample = QUICK_START[lang];
  return (
    <Section id="quick-start">
      <p>{QUICK_START_INTRO}</p>
      <CodeBlock label={sample.filename} text={sample.code} />
      <CodeBlock label="Run it" text={quickStartCommand(lang)} />
      <CodeBlock label="Output (the gaps are tabs)" text={sample.output} html={highlight(sample.output, { align: true })} wrap={false} className="code-out" />
      <ol className="steps-list">
        {quickStartSteps(lang).map((step) => (
          <Inline key={step} as="li" text={step} />
        ))}
      </ol>
      <Inline as="p" className="note" text={NEVER_BY_HAND} />
      <h3>{LANG_LABELS[lang]} details</h3>
      <ul className="steps-list">
        {LANG_NOTES[lang].map((note) => (
          <Inline key={note} as="li" text={note} />
        ))}
      </ul>
    </Section>
  );
}

export function CheatSheetSection() {
  return (
    <Section id="cheat-sheet">
      <Inline as="p" text={CHEAT_INTRO} />
      {CHEAT_SHEET.map((input) => {
        const row = GENERATED.cheatSheet.find((item) => item.id === input.id);
        if (row === undefined) return null;
        const id = `cheat-${input.id}`;
        return (
          <div key={input.id} className="cheat">
            <Anchored level={3} id={id} label={input.title}>
              {input.title}
            </Anchored>
            <Inline as="p" text={input.about} />
            <div className="cheat-pair">
              <CodeBlock label="JSON" text={row.json} html={colorize('json', row.json)} wrap={false} />
              <CodeBlock label="Terset" text={row.terset} html={highlight(row.terset, { align: true })} wrap={false} />
            </div>
          </div>
        );
      })}
    </Section>
  );
}

export function ApiSection() {
  const [lang] = useDocLang();
  return (
    <Section id="api">
      <p>{API_INTRO}</p>
      <LangSwitch />
      <Inline as="p" text={EXPORTS_LINE[lang]} />
      {API.map((entry) => (
        <ApiEntry key={entry.id} entry={entry} lang={lang} />
      ))}
    </Section>
  );
}

export function RulesSection() {
  return (
    <Section id="rules">
      {RULES_INTRO.map((line) => (
        <Inline key={line} as="p" text={line} />
      ))}
      <DataTable caption="What the fitted rules add" head={['When', 'The rules add']} rows={RULES_PARTS.map((part) => [part.when, part.adds])} />
      <CodeBlock label="RULES" text={RULES} />
    </Section>
  );
}

export function ErrorsSection() {
  return (
    <Section id="errors">
      <DataTable caption="Error types by call" head={['Call', 'JavaScript', 'Python']} rows={ERROR_KINDS.map((kind) => [kind.call, kind.js, kind.py])} />
      <h3>Messages</h3>
      <DataTable caption="Error messages" head={['Message', 'Cause']} rows={ERROR_MESSAGES.map((item) => [item.message, item.cause])} />
      <h3>Limits</h3>
      <DataTable caption="Limits" head={['Limit', 'Value']} rows={LIMITS.map((item) => [item.limit, item.value])} />
      <Inline as="p" className="note" text={DEPTH_NOTE} />
    </Section>
  );
}

export function WhenNotSection() {
  return (
    <Section id="when-not">
      <ul className="steps-list">
        {WHEN_NOT.map((item) => (
          <li key={item.title}>
            <b>{item.title}</b> <Inline text={item.text} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function LinksSection() {
  return (
    <Section id="links">
      <ul className="steps-list">
        {DOC_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>: {link.about}
          </li>
        ))}
      </ul>
    </Section>
  );
}
