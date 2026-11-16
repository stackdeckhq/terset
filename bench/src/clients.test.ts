import { describe, expect, it, vi } from 'vitest';
import fakeModel from '../fixtures/fake-model.json' with { type: 'json' };
import { fakeClient, httpClient } from './clients.ts';
import { estimateInputTokens } from './formats.ts';
import { modelSchema } from './schema.ts';

const prompt = { system: 'Read data.', user: 'Question: count records' };
const model = modelSchema.parse({ ...fakeModel, id: 'test-model' });
const options = { baseUrl: 'https://bench.invalid', apiKey: 'test-only-placeholder', maxOutputTokens: 16 };

function body(request: RequestInit | undefined): unknown {
  if (typeof request?.body !== 'string') throw new Error('Expected a string request body');
  return JSON.parse(request.body) as unknown;
}

describe('model client contract', () => {
  it('uses only a local fake response', async () => {
    const client = fakeClient(() => '42');
    expect(await client.ask(model, prompt)).toEqual({ text: '42', inputTokens: estimateInputTokens(prompt), outputTokens: 1 });
    await expect(fakeClient(() => 'one two three', 1).ask(model, prompt)).rejects.toThrow('per-call output limit');
  });
  it('sends Chat Completions with explicit output cap and usage', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: '42' } }], usage: { prompt_tokens: 19, completion_tokens: 1 } }));
    const client = httpClient({ ...options, fetch: fetcher });
    expect(await client.ask(model, prompt)).toEqual({ text: '42', inputTokens: 19, outputTokens: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://bench.invalid/v1/chat/completions');
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.method).toBe('POST');
    expect(request?.redirect).toBe('error');
    expect(body(request)).toEqual({
      model: 'test-model', temperature: 0, max_completion_tokens: 16,
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
    });
  });
  it('supports APIs that require max_tokens or omit temperature', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: '42' } }], usage: { prompt_tokens: 19, completion_tokens: 1 } }));
    const configured = modelSchema.parse({ ...model, temperature: 'omit', outputTokenParameter: 'max_tokens' });
    await httpClient({ ...options, fetch: fetcher }).ask(configured, prompt);
    const payload = body(fetcher.mock.calls[0]?.[1]);
    expect(payload).toHaveProperty('max_tokens', 16);
    expect(payload).not.toHaveProperty('temperature');
    expect(payload).not.toHaveProperty('max_completion_tokens');
  });
  it('sends Messages and includes cache input usage', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      content: [{ type: 'text', text: '4' }, { type: 'text', text: '2' }],
      usage: { input_tokens: 19, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 5 },
    }));
    const client = httpClient({ ...options, fetch: fetcher });
    expect(await client.ask({ ...model, api: 'anthropic' }, prompt)).toEqual({ text: '42', inputTokens: 27, outputTokens: 2 });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://bench.invalid/v1/messages');
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).toHaveProperty('anthropic-version', '2023-06-01');
    expect(body(request)).toEqual({ model: 'test-model', system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }], max_tokens: 16, temperature: 0 });
  });
  it('rejects absent credentials and unsafe base URLs without a request', () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(() => httpClient({ ...options, apiKey: '', fetch: fetcher })).toThrow('TERSET_BENCH_API_KEY');
    expect(() => httpClient({ ...options, baseUrl: '', fetch: fetcher })).toThrow('TERSET_BENCH_BASE_URL');
    for (const baseUrl of [
      'http://bench.invalid',
      'http://127.0.0.1.bench.invalid',
      'http://user:password@127.0.0.1:8317',
      'https://user:password@bench.invalid',
      'https://bench.invalid?key=value',
    ]) {
      expect(() => httpClient({ ...options, baseUrl, fetch: fetcher })).toThrow('HTTPS');
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts plain HTTP only on loopback', () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const baseUrl of ['http://127.0.0.1:8317', 'http://localhost:8317', 'http://[::1]:8317']) {
      expect(() => httpClient({ ...options, baseUrl, fetch: fetcher })).not.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects missing token usage rather than inventing it', async () => {
    for (const api of ['anthropic', 'openai'] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: '42' } }] }));
      await expect(httpClient({ ...options, fetch: fetcher }).ask({ ...model, api }, prompt)).rejects.toThrow('missing usage');
    }
  });
  it('withholds provider response bodies and transport error details', async () => {
    const failed = vi.fn<typeof fetch>().mockResolvedValue(new Response('private provider detail', { status: 429 }));
    await expect(httpClient({ ...options, fetch: failed }).ask(model, prompt)).rejects.toThrow('status 429; response body withheld');
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('private transport detail'));
    await expect(httpClient({ ...options, fetch: transport }).ask(model, prompt)).rejects.toThrow('request details withheld');
  });
});
