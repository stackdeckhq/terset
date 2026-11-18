// One response shape for every raw agent file: its own content type, a short cache,
// and the search header its RAW_FILES entry asks for.
import { pageUrl, RAW_FILES } from '../data/site.ts';
import type { RawPath, RawSearch } from '../data/site.ts';

function searchHeaders(search: RawSearch): Record<string, string> {
  switch (search.kind) {
    case 'canonical':
      return { link: `<${pageUrl(search.page)}>; rel="canonical"` };
    case 'noindex':
      return { 'x-robots-tag': 'noindex' };
    case 'none':
      return {};
  }
}

export function rawResponse(path: RawPath, text: string): Response {
  const file = RAW_FILES.find((item) => item.path === path);
  if (file === undefined) throw new Error(`No raw file is declared for ${path}`);
  return new Response(text, {
    headers: {
      'content-type': file.contentType,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      ...searchHeaders(file.search),
    },
  });
}
