// Copies text: the Clipboard API in a secure context, else a hidden textarea.

function fallbackCopy(text: string): boolean {
  const active = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    // execCommand is deprecated but it is the only fallback outside a secure
    // context. eslint.config.mjs allows it in this file only.
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (active instanceof HTMLElement) active.focus();
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  if (text === '') return false;
  if (window.isSecureContext && 'clipboard' in navigator) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }
  return fallbackCopy(text);
}
