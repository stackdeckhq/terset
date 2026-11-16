// The step rail beside the journey on wide screens. It follows the step in view.
import { useLayoutEffect, useRef } from 'react';
import { STEPS } from '../../data/steps.ts';
import { useJourney } from '../../lib/journey.ts';

export function JourneyRail() {
  const { active } = useJourney();
  const list = useRef<HTMLOListElement>(null);
  const index = STEPS.findIndex((step) => step.id === active);

  // The progress line ends at the middle of the active link.
  useLayoutEffect(() => {
    const ol = list.current;
    const link = ol?.querySelector<HTMLAnchorElement>('a[aria-current="step"]');
    if (ol === null || link === null || link === undefined) return;
    ol.style.setProperty('--prog', `${String(link.offsetTop + link.offsetHeight / 2)}px`);
  }, [active]);

  return (
    <div className="rail-lane">
      <nav className="rail" aria-labelledby="rail-h">
        <h2 className="rail-h" id="rail-h">
          Eight steps
        </h2>
        <ol ref={list}>
          {STEPS.map((step, i) => (
            <li key={step.id}>
              <a href={`#${step.id}`} aria-current={step.id === active ? 'step' : undefined} className={i < index ? 'done' : undefined}>
                <b>{i + 1}</b>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
