// Small text helpers shared by the highlighters and the pages.

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Escapes text for HTML. Every string the highlighters emit passes through here. */
export function esc(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

const ENCODER = new TextEncoder();

/** UTF-8 size in bytes. */
export function bytes(text: string): number {
  return ENCODER.encode(text).length;
}

/** A URL-safe id for a heading. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
