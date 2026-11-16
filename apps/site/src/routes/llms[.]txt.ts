import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/llms.txt?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/llms.txt')({
  server: { handlers: { GET: () => rawResponse('/llms.txt', text) } },
});
