// The shared header: lockup, page nav, a small-screen menu and, on the home
// page, the step strip that follows the step in view.
import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { NAV, REPO_URL } from '../data/site.ts';
import type { NavLink } from '../data/site.ts';
import { STEPS } from '../data/steps.ts';
import { useJourney, useScrolled } from '../lib/journey.ts';
import { prefersStill } from '../lib/motion.ts';
import { BrandLockup } from './BrandMark.tsx';
import { GitHubIcon, MenuIcon } from './Icons.tsx';
import { ThemeControl } from './ThemeControl.tsx';

function NavItem({ item, pathname, onPick }: { readonly item: NavLink; readonly pathname: string; readonly onPick?: () => void }) {
  const current = item.hash === undefined && pathname === item.to;
  return (
    <Link to={item.to} {...(item.hash === undefined ? {} : { hash: item.hash })} aria-current={current ? 'page' : undefined} activeOptions={{ exact: true, includeHash: true }} activeProps={{}} onClick={onPick}>
      {item.label}
    </Link>
  );
}

function StepStrip() {
  const { active } = useJourney();
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = list.current;
    const link = ol?.querySelector<HTMLAnchorElement>(`a[href="#${active}"]`);
    if (ol === null || link === null || link === undefined || ol.clientWidth === 0) return;
    ol.scrollTo({ left: link.offsetLeft - (ol.clientWidth - link.offsetWidth) / 2, behavior: prefersStill() ? 'auto' : 'smooth' });
  }, [active]);
  return (
    <nav className="stepbar" aria-label="Steps">
      <ol ref={list}>
        {STEPS.map((step, i) => (
          <li key={step.id}>
            <a href={`#${step.id}`} aria-current={step.id === active ? 'step' : undefined}>
              <b>{i + 1}</b>
              {step.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  const { inJourney } = useJourney();
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = (): void => {
    if (menu.current !== null) menu.current.open = false;
  };
  const home = pathname === '/';
  const classes = ['hdr', scrolled ? 'scrolled' : '', home && inJourney ? 'in-journey' : ''].filter(Boolean).join(' ');
  return (
    <header className={classes}>
      <div className="wrap hdr-in">
        <Link to="/" className="brand" aria-label="Terset home">
          <BrandLockup size={28} />
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>
        <a className="gh" href={REPO_URL} aria-label="Terset on GitHub" title="Terset on GitHub">
          <GitHubIcon />
        </a>
        <ThemeControl />
        <details className="menu" ref={menu}>
          <summary aria-label="Pages">
            <MenuIcon />
          </summary>
          <nav aria-label="Pages">
            <ul>
              {NAV.map((item) => (
                <li key={item.label}>
                  <NavItem item={item} pathname={pathname} onPick={closeMenu} />
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
      {home ? <StepStrip /> : null}
    </header>
  );
}
