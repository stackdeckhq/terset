// One response shape for every raw agent file: its own content type and a short cache.
import { RAW_FILES } from '../data/site.ts';
import type { RawPath } from '../data/site.ts';

export function rawResponse(path: RawPath, text: string): Response {
  const file = RAW_FILES.find((item) => item.path === path);
  if (file === undefined) throw new Error(`No raw file is declared for ${path}`);
  return new Response(text, {
    headers: {
      'content-type': file.contentType,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  });
}
