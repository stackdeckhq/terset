import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/docs.md?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/docs.md')({
  server: { handlers: { GET: () => rawResponse('/docs.md', text) } },
});
