// Reduced motion and reveal on scroll.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersStill(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** True when the reader asked for reduced motion. False on the server. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersStill, () => false);
}

/**
 * True once the element has scrolled into view. Under reduced motion, or
 * without IntersectionObserver, it turns true on the first frame.
 */
export function useReveal(ref: RefObject<Element | null>, threshold = 0.12): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    if (prefersStill() || !('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => {
        setShown(true);
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref, threshold]);
  return shown;
}
