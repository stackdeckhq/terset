// The color theme: System (the default), Light or Dark.
// System sets nothing: color-scheme "light dark" in tokens.css follows the
// operating system live. Light and Dark set data-theme on <html>, which pins one scheme.
// The boot script applies a saved choice before first paint, so there is no flash.

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export type Scheme = Exclude<Theme, 'system'>;

export const THEME_STORAGE_KEY = 'terset-theme';

/** The page ground of each scheme, the same values as --bg in tokens.css. A test checks that. */
export const THEME_COLORS: Readonly<Record<Scheme, string>> = {
  light: '#f7f8fa',
  dark: '#0b0c0f',
};

/**
 * Runs in <head> before first paint. It marks the page as scripted, so reveal
 * states never flash, and applies a saved Light or Dark choice. If a script
 * policy is ever added, it must allow this exact script by its hash; a test checks that.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')d.setAttribute('data-theme',t)}catch(e){}})();`;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** The saved choice, or System when nothing is saved or storage is blocked. */
export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

/** Applies a choice to the page and saves it. Storage errors are ignored: the choice still applies. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  syncThemeColor(theme);
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private windows can block storage. The page still shows the choice.
  }
}

/** The browser bar color. With System, each meta keeps its own media query. */
export function syncThemeColor(theme: Theme): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme: Scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[theme === 'system' ? scheme : theme];
  }
}
