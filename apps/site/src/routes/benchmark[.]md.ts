import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/benchmark.md?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/benchmark.md')({
  server: { handlers: { GET: () => rawResponse('/benchmark.md', text) } },
});
