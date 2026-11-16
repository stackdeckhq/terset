import { z } from 'zod';
import { encode as tokenize } from 'gpt-tokenizer/encoding/o200k_base';
import { estimateInputTokens } from './formats.ts';
import type { Prompt } from './formats.ts';
import type { Model, Response } from './schema.ts';

export interface Client {
  readonly maxOutputTokens: number;
  ask(model: Model, prompt: Prompt): Promise<Response>;
}

export function fakeClient(answer: (prompt: Prompt) => string = () => 'FAKE', maxOutputTokens = 128,
  usage: { inputTokenOffset?: number } = {}): Client {
  z.number().int().positive().parse(maxOutputTokens);
  const inputTokenOffset = z.number().int().parse(usage.inputTokenOffset ?? 0);
  return {
    maxOutputTokens,
    ask: (_model, prompt) => {
      const text = answer(prompt);
      const outputTokens = tokenize(text).length;
      if (outputTokens > maxOutputTokens) return Promise.reject(new Error('Fake response exceeds per-call output limit'));
      return Promise.resolve({ text, inputTokens: Math.max(0, estimateInputTokens(prompt) + inputTokenOffset), outputTokens });
    },
  };
}

const tokens = z.number().int().nonnegative();
const anthropicSchema = z.object({
  content: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({ type: z.literal('thinking'), thinking: z.string() }),
    z.object({ type: z.literal('redacted_thinking'), data: z.string() }),
  ])),
  usage: z.object({
    input_tokens: tokens, output_tokens: tokens,
    cache_creation_input_tokens: tokens.optional(), cache_read_input_tokens: tokens.optional(),
  }),
});
const openaiSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z.object({ prompt_tokens: tokens, completion_tokens: tokens }),
});

/**
 * The input part of an Anthropic Messages request: model, system text and the one user
 * message. The benchmark sends it, and the token counter counts exactly the same object.
 */
export function anthropicInput(model: Pick<Model, 'id'>, prompt: Prompt): { model: string; system: string; messages: { role: 'user'; content: string }[] } {
  return { model: model.id, system: prompt.system, messages: [{ role: 'user', content: prompt.user }] };
}

export function requestBody(model: Model, prompt: Prompt, maxOutputTokens: number): object {
  const temperature = model.temperature === 'zero' ? { temperature: 0 } : {};
  if (model.api === 'anthropic') return { ...anthropicInput(model, prompt), max_tokens: maxOutputTokens, ...temperature };
  return {
    model: model.id, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
    [model.outputTokenParameter]: maxOutputTokens, ...temperature,
  };
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function httpClient(options: {
  maxOutputTokens: number;
  baseUrl?: string;
  apiKey?: string;
  fetch?: typeof fetch;
}): Client {
  z.number().int().positive().parse(options.maxOutputTokens);
  const base = options.baseUrl ?? process.env.TERSET_BENCH_BASE_URL;
  const apiKey = options.apiKey ?? process.env.TERSET_BENCH_API_KEY;
  if (!base || !apiKey) throw new Error('HTTP mode requires TERSET_BENCH_BASE_URL and TERSET_BENCH_API_KEY');
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('Invalid benchmark base URL'); }
  // Plain HTTP is allowed only for a server on this machine, where the key never leaves the host.
  const loopback = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
  if ((url.protocol !== 'https:' && !loopback) || url.username || url.password || url.search || url.hash) {
    throw new Error('Benchmark base URL must use HTTPS (or HTTP on loopback) without credentials, query or fragment');
  }
  const baseUrl = url.href.replace(/\/$/, '');
  const fetcher = options.fetch ?? fetch;
  return {
    maxOutputTokens: options.maxOutputTokens,
    async ask(model, prompt) {
      const headers = model.api === 'anthropic'
        ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
        : { Authorization: `Bearer ${apiKey}` };
      let response: globalThis.Response;
      try {
        response = await fetcher(`${baseUrl}/v1/${model.api === 'anthropic' ? 'messages' : 'chat/completions'}`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(requestBody(model, prompt, options.maxOutputTokens)),
        });
      } catch { throw new Error('Benchmark HTTP request failed; request details withheld'); }
      if (!response.ok) throw new Error(`Benchmark HTTP status ${response.status}; response body withheld`);
      let value: unknown;
      try { value = await response.json(); } catch { throw new Error('Benchmark API returned invalid JSON'); }
      if (model.api === 'anthropic') {
        const parsed = anthropicSchema.safeParse(value);
        if (!parsed.success) throw new Error('Invalid Anthropic Messages response or missing usage');
        const { content, usage } = parsed.data;
        const text = content.filter(c => c.type === 'text').map(c => c.text).join('');
        return {
          text, inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
          outputTokens: usage.output_tokens,
        };
      }
      const parsed = openaiSchema.safeParse(value);
      if (!parsed.success) throw new Error('Invalid OpenAI Chat Completions response or missing usage');
      const first = parsed.data.choices[0];
      if (!first) throw new Error('Missing completion choice');
      return { text: first.message.content, inputTokens: parsed.data.usage.prompt_tokens, outputTokens: parsed.data.usage.completion_tokens };
    },
  };
}
