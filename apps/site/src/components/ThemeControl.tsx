// The header theme control: System, Light or Dark, as one radio group.
// The selected look comes from CSS on <html data-theme>, which the boot script sets
// before first paint, so the control is right from the first frame. The radios read
// that attribute as an external store: the server and hydration render System, then
// the radios catch up, which never changes the markup, so hydration stays clean.
import { useEffect, useId, useSyncExternalStore } from 'react';
import { THEMES, applyTheme, isTheme, readTheme, syncThemeColor } from '../theme.ts';
import type { Theme } from '../theme.ts';

const LABELS: Readonly<Record<Theme, string>> = { system: 'System', light: 'Light', dark: 'Dark' };

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    observer.disconnect();
  };
}

/** The applied choice: the data-theme attribute, or System when it is absent. */
function currentTheme(): Theme {
  const value = document.documentElement.getAttribute('data-theme');
  return isTheme(value) ? value : 'system';
}

const serverTheme = (): Theme => 'system';

export function ThemeControl() {
  const id = useId();
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);
  useEffect(() => {
    syncThemeColor(readTheme());
  }, []);
  return (
    <fieldset className="theme">
      <legend className="sr">Color theme</legend>
      {THEMES.map((value) => (
        <span key={value} className="theme-opt" data-v={value}>
          <input
            type="radio"
            id={`${id}-${value}`}
            name={`${id}-theme`}
            value={value}
            checked={theme === value}
            onChange={() => {
              applyTheme(value);
            }}
          />
          <label htmlFor={`${id}-${value}`} title={LABELS[value]}>
            <ThemeIcon theme={value} />
            <span className="sr">{LABELS[value]}</span>
          </label>
        </span>
      ))}
    </fieldset>
  );
}

function ThemeIcon({ theme }: { readonly theme: Theme }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {theme === 'system' ? (
        <g {...common}>
          <rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.5" />
          <path d="M5.5 13.5h5M8 11v2.5" />
        </g>
      ) : theme === 'light' ? (
        <g {...common}>
          <circle cx="8" cy="8" r="2.8" />
          <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
        </g>
      ) : (
        <path {...common} d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
      )}
    </svg>
  );
}
