import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/agents.md?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/agents.md')({
  server: { handlers: { GET: () => rawResponse('/agents.md', text) } },
});
