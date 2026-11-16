import { createFileRoute } from '@tanstack/react-router';
import text from '../../generated/skill.md?raw';
import { rawResponse } from '../../lib/raw.ts';

export const Route = createFileRoute('/skill/SKILL.md')({
  server: { handlers: { GET: () => rawResponse('/skill/SKILL.md', text) } },
});
