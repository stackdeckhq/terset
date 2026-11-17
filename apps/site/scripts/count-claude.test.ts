import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeCountsSchema, ClaudeReadySchema } from '../src/data/claude-counts-schema.ts';
import { anthropicInput, requestBody } from '../../../bench/src/clients.ts';
import {
  adjustedCount, countClaude, countPublished, csvText, ENDPOINT, formatTexts, main, METHOD,
  parseArgs, publicInputs, publishedRequests, requestPlan, settingsFromEnv,
} from './count-claude.ts';
import { PUBLISHED_RUNS } from './update-accuracy.ts';
import { NeutralInputsSchema, parseNeutralInputs } from './claude-inputs.ts';
import { encode as o200kTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { encode as toonEncode } from '@toon-format/toon';
import { stringify as yamlStringify } from 'yaml';
import type { CountInput, CountOptions } from './count-claude.ts';
import { rulesFor, encode } from '../src/lib/format.ts';

const INPUT: CountInput = { id: 'example:test', source: 'example', name: 'test', value: { hello: 'world' } };
const KEY = 'test-key-never-log';
const response = (input_tokens: number): Response => Response.json({ input_tokens });

function options(fetch: typeof globalThis.fetch, maxRequests = 400): CountOptions {
  return {
    baseUrl: 'https://count.invalid', apiKey: KEY, model: 'claude-test', maxRequests, fetch,
    sleep: vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(),
    utcDate: () => '2026-11-12T12:00:00Z',
  };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('public count inputs and formats', () => {
  it('includes every site sample and public documentation example with stable ids', () => {
    const inputs = publicInputs();
    expect(inputs.map((input) => input.id)).toEqual([
      'sample:orders', 'sample:servers', 'sample:config',
      'example:users', 'example:shipments', 'example:rows',
    ]);
    expect(requestPlan(inputs).requests).toBe(41);
    expect(formatTexts(INPUT.value)).toMatchObject({
      json: '{"hello":"world"}', jsonPretty: '{\n  "hello": "world"\n}',
      // Empty rules, so no rules line and no newline before the data.
      yaml: 'hello: world\n', csv: null, terset: 'hello: world',
    });
  });

  it('writes CSV only for one list of records, escaping quotes and line breaks', () => {
    expect(csvText({ rows: [{ a: '"hi"', b: null }, { a: 'x,y\nz', c: { x: 1 } }] }))
      .toBe('a,b,c\n"""hi""",,\n"x,y\nz",,"{""x"":1}"');
    expect(csvText([{ id: 1 }, { id: 2 }])).toBe('id\n1\n2');
    for (const value of [{ a: [], b: [] }, [], [1, 2], [{}, {}]]) expect(csvText(value)).toBeNull();
  });

  it('dry-runs without a key, a request or a file write', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Network forbidden'));
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const path = new URL('../src/data/claude-counts.json', import.meta.url);
    const before = readFileSync(path, 'utf8');
    await main(['--dry-run'], {});
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('6 rows; 41 requests without retries; hard cap 400 including retries. No requests made.');
    expect(readFileSync(path, 'utf8')).toBe(before);
    await expect(main(['--dry-run', '--max-requests', '1'], {})).rejects.toThrow('exceeds');
  });
});

describe('counting and framing', () => {
  it('subtracts the measured framing and records the one-token assumption', async () => {
    expect(adjustedCount(25, 10)).toBe(16);
    expect(adjustedCount(9, 10)).toBe(0);
    expect(() => adjustedCount(8, 10)).toThrow('baseline');
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response(10))
      .mockResolvedValueOnce(response(21))
      .mockResolvedValueOnce(response(25))
      .mockResolvedValueOnce(response(22))
      .mockResolvedValueOnce(response(30))
      .mockResolvedValueOnce(response(20))
      .mockResolvedValueOnce(response(40));
    const result = await countClaude([INPUT], options(fetch));
    expect(result).toMatchObject({
      status: 'ready', model: 'claude-test', endpoint: ENDPOINT, countedAt: '2026-11-12T12:00:00Z',
      baseline: { text: 'a', assumedTextTokens: 1, inputTokens: 10, overheadTokens: 9 },
      method: METHOD, rulesMode: 'fitted', requests: 7,
      rows: [{ id: INPUT.id, json: 12, jsonPretty: 16, yaml: 13, toon: 11, csv: null, terset: 31 }],
    });
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(fetch.mock.calls[0]).toEqual(['https://count.invalid/v1/messages/count_tokens', {
      method: 'POST', redirect: 'error', signal: fetch.mock.calls[0]?.[1]?.signal,
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-test', messages: [{ role: 'user', content: 'a' }] }),
    }]);
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('awaits each request before sending the next', async () => {
    let inFlight = false;
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      expect(inFlight).toBe(false);
      inFlight = true;
      await Promise.resolve();
      inFlight = false;
      return response(10);
    });
    await countClaude([INPUT], options(fetch));
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it('rejects an insufficient cap before making any request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(countClaude([INPUT], options(fetch, 6))).rejects.toThrow('needs 7 requests');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('includes retries in the hard cap', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(10)))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(countClaude([INPUT], options(fetch, 7))).rejects.toThrow('cap reached');
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it.each([429, 500, 503])('retries HTTP %s at most twice with backoff', async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(new Response(null, { status })));
    const config = options(fetch);
    await expect(countClaude([INPUT], config)).rejects.toThrow(`HTTP ${status}`);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(config.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(config.sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it('can recover from two retryable errors', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(10)))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 502 }));
    expect((await countClaude([INPUT], options(fetch))).requests).toBe(9);
  });

  it.each([400, 401, 403, 404])('stops on HTTP %s without printing response bodies', async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(KEY, { status }));
    await expect(countClaude([INPUT], options(fetch))).rejects.toThrow(`HTTP ${status}`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('hides transport and malformed-response details', async () => {
    const failed = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(KEY));
    await expect(countClaude([INPUT], options(failed))).rejects.toThrow('no response received');
    expect(failed).toHaveBeenCalledTimes(1);
    const malformed = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ input_tokens: KEY }));
    await expect(countClaude([INPUT], options(malformed))).rejects.toThrow('invalid input_tokens');
    expect(malformed).toHaveBeenCalledTimes(1);
  });
});

describe('configuration and data schema', () => {
  it('fails clearly for a missing key without exposing any configuration values', async () => {
    const env = { TERSET_COUNT_MODEL: KEY, TERSET_COUNT_BASE_URL: KEY };
    expect(() => settingsFromEnv(env)).toThrow(/^TERSET_COUNT_API_KEY is required$/u);
    await expect(main([], env)).rejects.toThrow(/^TERSET_COUNT_API_KEY is required$/u);
    try { settingsFromEnv(env); }
    catch (error) { expect(String(error)).not.toContain(KEY); }
  });

  it('requires explicit base URL and model and rejects unsafe URL components', () => {
    expect(() => settingsFromEnv({ TERSET_COUNT_API_KEY: KEY })).toThrow('TERSET_COUNT_BASE_URL is required');
    expect(() => settingsFromEnv({ TERSET_COUNT_API_KEY: KEY, TERSET_COUNT_BASE_URL: 'https://count.invalid' })).toThrow('TERSET_COUNT_MODEL is required');
    for (const baseUrl of ['bad', 'file:///tmp/count', 'https://name:password@count.invalid', 'https://count.invalid?q=1', 'https://count.invalid/#fragment']) {
      expect(() => settingsFromEnv({ TERSET_COUNT_API_KEY: KEY, TERSET_COUNT_BASE_URL: baseUrl, TERSET_COUNT_MODEL: 'claude-test' })).toThrow('TERSET_COUNT_BASE_URL');
    }
    expect(settingsFromEnv({ TERSET_COUNT_API_KEY: KEY, TERSET_COUNT_BASE_URL: 'https://count.invalid/', TERSET_COUNT_MODEL: 'claude-test' }).baseUrl).toBe('https://count.invalid');
  });

  it('validates the cap and refuses unknown flags', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, maxRequests: 400 });
    expect(parseArgs(['--dry-run', '--max-requests', '20'])).toEqual({ dryRun: true, maxRequests: 20 });
    for (const value of ['0', '-1', '1.2', 'Infinity', '9007199254740992', 'secret']) {
      expect(() => parseArgs(['--max-requests', value])).toThrow('positive safe integer');
    }
    expect(() => parseArgs(['--max-requests'])).toThrow();
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument');
  });

  it('accepts only the strict pending state or fully described measured data', async () => {
    const raw: unknown = JSON.parse(readFileSync(new URL('../src/data/claude-counts.json', import.meta.url), 'utf8'));
    expect(ClaudeCountsSchema.safeParse(raw).success).toBe(true);
    expect(ClaudeCountsSchema.parse({ status: 'pending' })).toEqual({ status: 'pending' });
    expect(ClaudeCountsSchema.safeParse({ status: 'pending', rows: [] }).success).toBe(false);
    const ready = await countClaude([INPUT], options(vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(10)))));
    expect(ClaudeReadySchema.parse(ready)).toEqual(ready);
    for (const patch of [
      { countedAt: '2026-11-12' }, { countedAt: '2026-11-12T12:00:00+01:00' }, { model: '' },
      { endpoint: '/other' }, { rows: [] }, { rows: [ready.rows[0], ready.rows[0]] },
      { baseline: { ...ready.baseline, overheadTokens: 100 } }, { extra: true },
      { rows: [{ ...ready.rows[0], json: -1 }] }, { rows: [{ ...ready.rows[0], json: 1.5 }] },
      { rows: [{ ...ready.rows[0], csv: null, csvExact: true }] },
      { rows: [{ ...ready.rows[0], csv: 2, csvExact: null }] },
      { rows: [{ ...ready.rows[0], o200kJson: -1 }] },
    ]) expect(ClaudeCountsSchema.safeParse({ ...ready, ...patch }).success).toBe(false);
  });
});

describe('private benchmark inputs', () => {
  const path = '/private/neutral-inputs.json';
  const privateText = 'private-text-must-never-be-published';
  const raw = JSON.stringify({ cases: [{ name: 'Metrics, uniform', data: { rows: [{ cpu: 1, healthy: true }, { cpu: 2, healthy: false }] } }] });

  it('parses a strict neutral file into stable benchmark ids', () => {
    expect(parseNeutralInputs(raw)).toEqual([{
      id: 'benchmark:metrics-uniform', source: 'benchmark', name: 'Metrics, uniform',
      value: { rows: [{ cpu: 1, healthy: true }, { cpu: 2, healthy: false }] },
    }]);
    expect(parseArgs(['--inputs', path, '--dry-run'])).toEqual({ dryRun: true, maxRequests: 400, inputsPath: path });
    expect(() => parseArgs(['--inputs'])).toThrow('--inputs needs a file path');
    expect(() => parseArgs(['--inputs', '--dry-run'])).toThrow('--inputs needs a file path');
    expect(() => parseArgs(['--inputs', path, '--inputs', path])).toThrow('only once');
  });

  it('rejects invalid JSON, schema errors, duplicate names and slug collisions', () => {
    for (const value of [
      {}, { cases: [] }, { cases: [{ name: '', data: {} }] },
      { cases: [{ name: 'a', data: null }] }, { cases: [{ name: 'a', data: 1 }] },
      { cases: [{ name: 'a', data: {}, secret: privateText }] }, { cases: [{ name: 'a', data: {} }], path },
      { cases: [{ name: 'a', data: {} }, { name: 'a', data: {} }] },
      { cases: [{ name: 'A B', data: {} }, { name: 'a-b', data: {} }] },
      { cases: [{ name: '!!!', data: {} }] },
    ]) {
      expect(NeutralInputsSchema.safeParse(value).success).toBe(false);
      expect(() => parseNeutralInputs(JSON.stringify(value))).toThrow(/^Invalid --inputs file/u);
    }
    expect(() => parseNeutralInputs(privateText)).toThrow(/^Invalid --inputs file/u);
    try { parseNeutralInputs(privateText); }
    catch (error) { expect(String(error)).not.toContain(privateText); }
  });

  it('includes benchmark requests in dry-run without reading configuration or touching the network', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Network forbidden'));
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const read = vi.fn<(path: string) => string>().mockReturnValue(raw);
    const write = vi.fn<(text: string) => void>();
    await main(['--inputs', path, '--dry-run'], {}, { read, write });
    expect(read).toHaveBeenCalledWith(path);
    expect(log).toHaveBeenCalledWith('7 rows; 48 requests without retries; hard cap 400 including retries. No requests made.');
    expect(fetch).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('writes only names and counts, including local o200k verification counts and CSV fidelity', async () => {
    const privateRaw = JSON.stringify({ cases: [{ name: 'Private case', data: { rows: [{ note: privateText }, { note: 'public' }] } }] });
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(10)));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const write = vi.fn<(text: string) => void>();
    await main(['--inputs', path], {
      TERSET_COUNT_BASE_URL: 'https://count.invalid', TERSET_COUNT_API_KEY: KEY, TERSET_COUNT_MODEL: 'claude-test',
    }, { read: () => privateRaw, write });
    expect(fetch).toHaveBeenCalledTimes(48);
    const output = write.mock.calls[0]?.[0] ?? '';
    expect(output).not.toContain(privateText);
    expect(output).not.toContain(path);
    expect(output).not.toContain(KEY);
    const file = ClaudeReadySchema.parse(JSON.parse(output));
    expect(file.rows.at(-1)).toMatchObject({ source: 'benchmark', id: 'benchmark:private-case', name: 'Private case', csvExact: true });
    const inputs = [...publicInputs(), ...parseNeutralInputs(privateRaw)];
    for (const [index, input] of inputs.entries()) {
      expect(file.rows[index]?.o200kJson).toBe(o200kTokens(JSON.stringify(input.value)).length);
    }
  });

  it('marks CSV as exact only when inferred typed cells preserve the record list', () => {
    for (const value of [
      [{ x: 1, ok: true }, { x: 2, ok: false }], [{ x: 'hello' }, { x: '' }],
    ]) expect(formatTexts(value).csvExact).toBe(true);
    for (const value of [
      [{ x: null }], [{ x: '42' }], [{ x: 'true' }], [{ x: 1 }, {}], [{ x: { a: 1 } }], [{ x: [] }],
    ]) expect(formatTexts(value).csvExact).toBe(false);
    expect(formatTexts({ x: 1 }).csvExact).toBeNull();
  });

  it('stops on private file errors before requesting or writing anything', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);
    const write = vi.fn<(text: string) => void>();
    await expect(main(['--inputs', path], {}, { read: () => { throw new Error(path); }, write }))
      .rejects.toThrow(/^Unable to read --inputs file$/u);
    await expect(main(['--inputs', path], {}, { read: () => privateText, write }))
      .rejects.toThrow(/^Invalid --inputs file/u);
    expect(fetch).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('counts every format from an array root directly, without an object wrapper', async () => {
    const data = [{ long_field: 1, active: true }, { long_field: 2, active: false }];
    const [input] = parseNeutralInputs(JSON.stringify({ cases: [{ name: 'Array records', data }] }));
    expect(input?.value).toEqual(data);
    if (input === undefined) throw new Error('Array input missing');
    const texts = formatTexts(input.value);
    expect(texts).toEqual({
      json: JSON.stringify(data), jsonPretty: JSON.stringify(data, null, 2),
      yaml: yamlStringify(data), toonDefault: toonEncode(data), toonTab: toonEncode(data, { delimiter: '\t' }),
      csv: 'long_field,active\n1,true\n2,false', csvExact: true,
      terset: `${rulesFor(encode(data))}\n${encode(data)}`,
    });
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(10)));
    const result = await countClaude([input], options(fetch));
    expect(fetch.mock.calls.map((call) => {
      const body = call[1]?.body;
      if (typeof body !== 'string') throw new Error('Expected a JSON request body');
      const request: unknown = JSON.parse(body);
      return request;
    })).toEqual(['a', texts.json, texts.jsonPretty, texts.yaml, texts.toonDefault, texts.toonTab, texts.csv, texts.terset]
      .map((content) => ({ model: 'claude-test', messages: [{ role: 'user', content }] })));
    expect(result.rows[0]).toMatchObject({
      id: 'benchmark:array-records', source: 'benchmark', csvExact: true,
      o200kJson: o200kTokens(JSON.stringify(data)).length,
    });
    expect(result.requests).toBe(8);
    expect(parseNeutralInputs('{"cases":[{"name":"Empty array","data":[]}]}')[0]?.value).toEqual([]);
    expect(parseNeutralInputs('{"cases":[{"name":"Mixed array","data":[1,null,{"x":true}]}]}')[0]?.value).toEqual([1, null, { x: true }]);
  });
});

describe('published Claude requests', () => {
  const runs = PUBLISHED_RUNS.map((source) => ({
    source, raw: JSON.parse(readFileSync(new URL(`../../../${source.path}`, import.meta.url), 'utf8')) as unknown,
  }));
  const requests = publishedRequests(runs.filter(({ source }) => !source.formats.some(format => format === 'terset')));
  const claude = (count: number) => ({ ...options(vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(response(count))), 2000), model: 'claude-opus-5-5' });

  it('rebuilds all 976 published requests, fitted Terset primers included, and refuses the older full-rules Terset run', () => {
    expect(requests).toHaveLength(732);
    const all = publishedRequests(runs);
    expect(all).toHaveLength(976);
    const tally = Object.fromEntries(['terset', 'json-compact', 'json-pretty', 'toon'].map((format) => [format, all.filter((request) => request.format === format).length]));
    expect(tally).toEqual({ terset: 244, 'json-compact': 244, 'json-pretty': 244, toon: 244 });
    expect(new Set(all.map((request) => request.body.model))).toEqual(new Set(['claude-opus-5-5']));
    // The 2026-11-13 run sent the full rules text, so today's fitted primers no longer match it.
    const terset = runs.find(({ source }) => source.formats.some((format) => format === 'terset'));
    if (terset === undefined) throw new Error('no Terset run');
    const older = JSON.parse(readFileSync(new URL('../../../bench/published/2026-11-13/v2-final-2026-11-13.json', import.meta.url), 'utf8')) as unknown;
    expect(() => publishedRequests([{ source: terset.source, raw: older }])).toThrow('a rebuilt prompt differs from the one the run reserved for');
  });

  it('counts the exact body the benchmark sent, built by the same function (no drift)', async () => {
    const config = claude(500);
    const sample = requests.slice(0, 3);
    const result = await countPublished(sample, config);
    const sent = vi.mocked(config.fetch).mock.calls.map((call) => call[1]?.body);
    expect(sent[0]).toBe(JSON.stringify({ model: 'claude-opus-5-5', messages: [{ role: 'user', content: 'a' }] }));
    sample.forEach((request, index) => {
      const model = {
        id: 'claude-opus-5-5', api: 'anthropic', temperature: 'zero', outputTokenParameter: 'max_completion_tokens',
        price: { inputPerMillion: 4, outputPerMillion: 20, sourceUrl: 'https://price.invalid', dateRead: '2026-11-12' },
      } as const;
      const benchBody = JSON.stringify(requestBody(model, { system: request.body.system, user: request.body.messages[0]?.content ?? '' }, 2048));
      const counted = sent[index + 1];
      if (typeof counted !== 'string') throw new Error('Expected a JSON request body');
      expect(counted).toBe(JSON.stringify(anthropicInput(model, { system: request.body.system, user: request.body.messages[0]?.content ?? '' })));
      // The benchmark body is the counted body plus the output cap and temperature, byte for byte.
      expect(benchBody).toBe(`${counted.slice(0, -1)},"max_tokens":2048,"temperature":0}`);
    });
    expect(result).toMatchObject({ model: 'claude-opus-5-5', endpoint: ENDPOINT, baseline: { text: 'a', inputTokens: 500 }, requests: 4 });
    expect(result.rows.map((row) => row.inputTokens)).toEqual([500, 500, 500]);
  });

  it('stops before counting requests when the baseline is not the expected one', async () => {
    const config = claude(10);
    await expect(countPublished(requests.slice(0, 2), { ...config, expectedBaseline: 9 })).rejects.toThrow('Baseline "a" counted 10, expected 9');
    expect(config.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once on a network error only, and never on an HTTP error', async () => {
    const network = claude(9);
    vi.mocked(network.fetch).mockRejectedValueOnce(new Error(KEY));
    expect((await countPublished(requests.slice(0, 1), network)).requests).toBe(3);
    const twice = claude(9);
    vi.mocked(twice.fetch).mockResolvedValueOnce(response(9)).mockRejectedValueOnce(new Error(KEY)).mockRejectedValueOnce(new Error(KEY));
    await expect(countPublished(requests.slice(0, 1), twice)).rejects.toThrow('no response received');
    expect(twice.fetch).toHaveBeenCalledTimes(3);
    const http = claude(9);
    vi.mocked(http.fetch).mockResolvedValueOnce(response(9)).mockResolvedValueOnce(new Response(KEY, { status: 503 }));
    await expect(countPublished(requests.slice(0, 1), http)).rejects.toThrow('HTTP 503');
    expect(http.fetch).toHaveBeenCalledTimes(2);
  });

  it('refuses a model that differs from the requests before any request', async () => {
    const config = { ...claude(9), model: 'claude-other' };
    await expect(countPublished(requests.slice(0, 1), config)).rejects.toThrow('model');
    expect(config.fetch).not.toHaveBeenCalled();
  });
});
