// The shared footer: lockup, tagline, the StackDeck attribution and two link columns.
import { Link } from '@tanstack/react-router';
import { NPM_URL, PACKAGE_LICENSE, REPO_URL, TAGLINE } from '../data/site.ts';
import type { RawPath } from '../data/site.ts';
import { BrandLockup } from './BrandMark.tsx';

const PROJECT_LINKS: readonly { readonly label: string; readonly href: string }[] = [
  { label: 'npm package', href: NPM_URL },
  { label: 'GitHub repository', href: REPO_URL },
  { label: 'Spec (spec.md)', href: '/spec.md' satisfies RawPath },
];

export function SiteFooter() {
  return (
    <footer className="wrap footer">
      <div className="foot">
        <div>
          <Link to="/" className="brand" aria-label="Terset home">
            <BrandLockup size={26} />
          </Link>
          <p>{TAGLINE}</p>
          <a href="https://stackdeck.dev" className="pwr group mt-5 inline-flex items-center gap-2 text-faint" aria-label="Powered by StackDeck">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em]">Powered by</span>
            <img src="/stackdeck-mark.png" alt="" width="15" height="15" loading="lazy" decoding="async" className="size-[15px] opacity-85 group-hover:opacity-100" />
            <span className="text-[12.5px] font-medium text-muted group-hover:text-fg">StackDeck</span>
          </a>
        </div>
        <div>
          <h2>Pages</h2>
          <ul>
            <li>
              <Link to="/" hash="b2">
                Converter
              </Link>
            </li>
            <li>
              <Link to="/docs">Docs</Link>
            </li>
            <li>
              <Link to="/format">Format</Link>
            </li>
            <li>
              <Link to="/benchmark">Benchmark</Link>
            </li>
            <li>
              <Link to="/agents">Agents</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2>Project</h2>
          <ul>
            {PROJECT_LINKS.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="bottom">
        <span>© 2026 TrueWear, LLC. {PACKAGE_LICENSE} license.</span>
      </div>
    </footer>
  );
}
