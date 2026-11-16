// Which home step is in view. The home page writes it; the header strip and the rail read it.
import { useEffect, useSyncExternalStore } from 'react';
import { STEP_IDS } from '../data/steps.ts';
import type { StepId } from '../data/steps.ts';

export interface JourneyState {
  readonly inJourney: boolean;
  readonly active: StepId;
}

const FIRST: StepId = 'b1';
const START: JourneyState = { inJourney: false, active: FIRST };
let state: JourneyState = START;
const listeners = new Set<() => void>();

function set(next: JourneyState): void {
  if (next.inJourney === state.inJourney && next.active === state.active) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useJourney(): JourneyState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => START,
  );
}

/** True once the page has scrolled past the top. */
export function useScrolled(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('scroll', onChange, { passive: true });
      return () => {
        window.removeEventListener('scroll', onChange);
      };
    },
    () => window.scrollY > 8,
    () => false,
  );
}

/**
 * Follows the step in view: the last step whose top has passed 40% of the
 * window height. Updates once per frame while scrolling.
 */
export function useJourneyTracker(journeyId: string): void {
  useEffect(() => {
    let queued = false;
    const update = (): void => {
      queued = false;
      const journey = document.getElementById(journeyId);
      if (journey === null) return;
      const box = journey.getBoundingClientRect();
      const line = window.innerHeight * 0.4;
      let active: StepId = FIRST;
      for (const id of STEP_IDS) {
        const step = document.getElementById(id);
        if (step !== null && step.getBoundingClientRect().top <= line) active = id;
      }
      set({ inJourney: box.top < 120 && box.bottom > 240, active });
    };
    const onScroll = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      set(START);
    };
  }, [journeyId]);
}
