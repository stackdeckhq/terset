import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/spec.md?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/spec.md')({
  server: { handlers: { GET: () => rawResponse('/spec.md', text) } },
});
