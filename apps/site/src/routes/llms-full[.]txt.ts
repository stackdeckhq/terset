import { createFileRoute } from '@tanstack/react-router';
import text from '../generated/llms-full.txt?raw';
import { rawResponse } from '../lib/raw.ts';

export const Route = createFileRoute('/llms-full.txt')({
  server: { handlers: { GET: () => rawResponse('/llms-full.txt', text) } },
});
