// Writes src/data/count-cases.json: the eleven made-up inputs behind every
// token count on the site and in the READMEs. Every value comes from SEED
// through a small seeded random number generator, so the file is the same on
// every machine. A test keeps the committed file equal to a fresh run.
//
//   pnpm cases     rewrite the inputs
//   pnpm numbers   recount them with o200k_base
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { JsonObject, JsonRoot, JsonValue } from '../src/lib/format.ts';

export const SEED = 20261117;
export const OUTPUT = fileURLToPath(new URL('../src/data/count-cases.json', import.meta.url));

export const CASE_NAMES = [
  'UI text, uneven rows',
  'UI text, uniform rows',
  'Translation batch',
  'File list, short',
  'File list, long',
  '200 users',
  'Metrics, numbers and booleans',
  'Deep nested config',
  'Mixed-type array',
  'Reviews, long text',
  'Orders with line items',
] as const;

type CaseName = (typeof CASE_NAMES)[number];

interface Rng {
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number;
  /** A number from min to max, rounded to the given decimal places. */
  float(min: number, max: number, digits: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/** mulberry32: a 32-bit seeded generator. Integer math only, so every platform gives the same stream. */
function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    int,
    float: (min, max, digits) => {
      const scale = 10 ** digits;
      return int(Math.round(min * scale), Math.round(max * scale)) / scale;
    },
    chance: (probability) => next() < probability,
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('pick needs a nonempty list');
      return item;
    },
  };
}

/** Each case draws from its own stream, so changing one case never shifts another. */
function caseRng(name: CaseName, seed: number): Rng {
  return makeRng((seed ^ Math.imul(CASE_NAMES.indexOf(name) + 1, 0x9e3779b1)) >>> 0);
}

const FIRST = ['Ada', 'Ben', 'Chen', 'Dara', 'Eli', 'Fatima', 'Gus', 'Hana', 'Ivan', 'Jade', 'Kofi', 'Lena', 'Marco', 'Nia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tara', 'Umar', 'Vera', 'Wes', 'Xin', 'Yara', 'Zane'] as const;
const LAST = ['Silva', 'Okafor', 'Kim', 'Patel', 'Rossi', 'Garcia', 'Novak', 'Haddad', 'Larsen', 'Mendes', 'Ito', 'Brennan', 'Costa', 'Dubois', 'Ferreira', 'Nakamura', 'Osei', 'Petrov', 'Quiroga', 'Reyes'] as const;
const WORDS = [
  'account', 'add', 'after', 'again', 'all', 'allow', 'already', 'and', 'any', 'app', 'back', 'before', 'board', 'button', 'can',
  'card', 'change', 'check', 'choose', 'clear', 'close', 'copy', 'create', 'data', 'date', 'default', 'delete', 'done', 'draft', 'each',
  'edit', 'email', 'empty', 'enter', 'error', 'every', 'export', 'field', 'file', 'filter', 'find', 'first', 'folder', 'for', 'from',
  'full', 'group', 'has', 'help', 'here', 'hide', 'item', 'join', 'keep', 'last', 'later', 'link', 'list', 'load', 'lost',
  'make', 'member', 'message', 'more', 'move', 'name', 'new', 'next', 'not', 'now', 'number', 'off', 'only', 'open', 'order',
  'page', 'password', 'plan', 'please', 'project', 'recent', 'remove', 'rename', 'report', 'reset', 'retry', 'review', 'role', 'save', 'search',
  'select', 'send', 'set', 'share', 'show', 'sign', 'some', 'sort', 'start', 'still', 'team', 'the', 'this', 'time', 'try',
  'update', 'upload', 'use', 'view', 'wait', 'when', 'will', 'with', 'work', 'you', 'your',
] as const;
/** Made-up target text for the translation case, with the accented letters real translations carry. */
const TARGET_WORDS = [
  'ação', 'agora', 'ajuda', 'arquivo', 'atualizar', 'cancelar', 'conta', 'configuração', 'criar', 'dados', 'depois', 'editar', 'enviar', 'equipe', 'erro',
  'escolher', 'está', 'excluir', 'fechar', 'filtro', 'função', 'grupo', 'início', 'lista', 'mais', 'membro', 'mensagem', 'não', 'nome', 'novo',
  'número', 'página', 'pasta', 'pesquisa', 'plano', 'projeto', 'relatório', 'revisão', 'salvar', 'senha', 'sessão', 'tempo', 'todos', 'você', 'vazio',
] as const;
const CITIES = [['Lisbon', '1100-148'], ['Lagos', '101233'], ['Osaka', '530-0001'], ['Austin', '78701'], ['Lyon', '69002'], ['Accra', 'GA-183'], ['Porto', '4050-262'], ['Seoul', '04524'], ['Denver', '80202'], ['Turin', '10121']] as const;
const BASE_TIME = Date.UTC(2026, 9, 1);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function words(rng: Rng, min: number, max: number, from: readonly string[] = WORDS): string {
  return Array.from({ length: rng.int(min, max) }, () => rng.pick(from)).join(' ');
}

function sentence(rng: Rng, min: number, max: number, from: readonly string[] = WORDS): string {
  return `${capitalize(words(rng, min, max, from))}.`;
}

function paragraph(rng: Rng, sentences: number): string {
  return Array.from({ length: sentences }, () => sentence(rng, 8, 18)).join(' ');
}

function personName(rng: Rng): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

function isoTime(rng: Rng, days: number): string {
  return new Date(BASE_TIME + rng.int(0, days * 86_400) * 1000).toISOString();
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** Unique dotted UI keys such as "billing.save", in a seeded order. */
function uiKeys(rng: Rng, count: number): string[] {
  const sections = ['nav', 'settings', 'billing', 'profile', 'editor', 'search', 'alerts', 'export', 'team', 'auth'];
  const items = ['title', 'save', 'cancel', 'empty', 'error', 'hint', 'label', 'confirm', 'retry', 'help'];
  const keys = new Set<string>();
  while (keys.size < count) keys.add(`${rng.pick(sections)}.${rng.pick(items)}`);
  return [...keys];
}

function uiTextUneven(rng: Rng): JsonObject {
  return {
    strings: uiKeys(rng, 36).map((key): JsonObject => ({
      key,
      text: sentence(rng, 2, 7),
      ...(rng.chance(0.4) ? { description: sentence(rng, 5, 10) } : {}),
      ...(rng.chance(0.3) ? { maxLength: rng.int(20, 80) } : {}),
      ...(rng.chance(0.15) ? { plural: true } : {}),
    })),
  };
}

function uiTextUniform(rng: Rng): JsonObject {
  const contexts = ['button', 'label', 'title', 'tooltip', 'message'];
  return { strings: uiKeys(rng, 44).map((key): JsonObject => ({ key, text: sentence(rng, 2, 7), context: rng.pick(contexts) })) };
}

function translationBatch(rng: Rng): JsonObject {
  const statuses = ['new', 'translated', 'reviewed'];
  return {
    sourceLocale: 'en',
    targetLocale: 'pt-PT',
    strings: Array.from({ length: 49 }, (_, i): JsonObject => ({
      id: `t-${pad(i + 1, 4)}`,
      source: sentence(rng, 3, 9),
      target: sentence(rng, 3, 10, TARGET_WORDS),
      status: rng.pick(statuses),
    })),
  };
}

const DIRS = ['src', 'lib', 'docs', 'tests', 'assets', 'config', 'scripts', 'public', 'build', 'vendor'];
const SUBDIRS = ['components', 'routes', 'utils', 'models', 'hooks', 'styles', 'fixtures', 'images', 'locales', 'server', 'client', 'shared', 'legacy', 'internal'];
const STEMS = ['index', 'main', 'app', 'button', 'table', 'parser', 'router', 'store', 'theme', 'client', 'server', 'format', 'schema', 'helpers', 'types', 'logo', 'readme'];
const EXTS = ['ts', 'tsx', 'json', 'md', 'css', 'png', 'svg', 'js', 'yaml'];

function filePath(rng: Rng, depth: number): string {
  const parts = [rng.pick(DIRS), ...Array.from({ length: depth - 1 }, () => rng.pick(SUBDIRS))];
  return `${parts.join('/')}/${rng.pick(STEMS)}-${pad(rng.int(1, 999), 3)}.${rng.pick(EXTS)}`;
}

function fileListShort(rng: Rng): JsonObject {
  return {
    root: '/srv/app',
    files: Array.from({ length: 357 }, (): JsonObject => ({
      path: filePath(rng, rng.int(1, 2)),
      size: rng.int(120, 250_000),
      modified: isoTime(rng, 45),
      kind: rng.chance(0.9) ? 'file' : 'link',
    })),
  };
}

function fileListLong(rng: Rng): JsonObject {
  const owners = ['build', 'deploy', 'root', 'www-data', 'ci'];
  return {
    root: '/srv/app',
    files: Array.from({ length: 400 }, (): JsonObject => ({
      path: filePath(rng, rng.int(4, 7)),
      size: rng.int(120, 250_000),
      modified: isoTime(rng, 45),
      kind: rng.chance(0.9) ? 'file' : 'link',
      owner: rng.pick(owners),
      mode: rng.pick(['0644', '0600', '0755']),
    })),
  };
}

function users(rng: Rng): JsonObject {
  const roles = ['admin', 'editor', 'viewer', 'billing', 'support'];
  return {
    users: Array.from({ length: 200 }, (_, i): JsonObject => {
      const first = rng.pick(FIRST);
      const last = rng.pick(LAST);
      return {
        id: `u${pad(i + 1, 4)}`,
        name: `${first} ${last}`,
        email: `${first}.${last}${String(i + 1)}@example.com`.toLowerCase(),
        role: rng.pick(roles),
        active: rng.chance(0.85),
        signupDate: isoTime(rng, 365).slice(0, 10),
        logins: rng.int(0, 500),
      };
    }),
  };
}

function metrics(rng: Rng): JsonObject {
  const hosts = ['web-01', 'web-02', 'web-03', 'api-01', 'api-02', 'worker-01'];
  return {
    metrics: Array.from({ length: 86 }, (_, i): JsonObject => ({
      ts: new Date(BASE_TIME + i * 60_000).toISOString(),
      host: rng.pick(hosts),
      cpu: rng.float(0, 100, 1),
      memMb: rng.int(512, 16_384),
      p95Ms: rng.float(4, 900, 2),
      errors: rng.int(0, 5),
      healthy: rng.chance(0.92),
      cached: rng.chance(0.5),
    })),
  };
}

function deepConfig(rng: Rng): JsonObject {
  return {
    app: {
      name: 'atlas',
      version: `${String(rng.int(1, 4))}.${String(rng.int(0, 20))}.${String(rng.int(0, 9))}`,
      server: {
        http: { host: '0.0.0.0', port: rng.pick([3000, 8080, 8443]), tls: { enabled: true, cert: '/etc/tls/atlas.pem', protocols: ['TLSv1.2', 'TLSv1.3'] } },
        limits: { bodyKb: rng.pick([256, 512, 1024]), timeoutMs: rng.int(5, 60) * 1000, rate: { perMinute: rng.int(60, 600), burst: rng.int(10, 50) } },
      },
      database: {
        primary: { host: 'db-1.internal', port: 5432, pool: { min: 2, max: rng.int(10, 40), idleMs: 30_000 } },
        replicas: [{ host: 'db-2.internal', port: 5432, lagMs: rng.int(0, 200) }, { host: 'db-3.internal', port: 5432, lagMs: rng.int(0, 200) }],
      },
      features: { flags: { search: { enabled: rng.chance(0.5), rollout: { percent: rng.int(0, 100), regions: ['eu-west', 'us-east'] } }, exports: { enabled: true, formats: ['csv', 'json'] } } },
      logging: { level: rng.pick(['info', 'warn', 'debug']), sinks: [{ type: 'stdout', json: true }, { type: 'file', path: '/var/log/atlas.log', rotate: { maxMb: 100, keep: 7 } }] },
    },
  };
}

function mixedArray(rng: Rng): JsonValue[] {
  return [
    rng.int(1, 99),
    'alpha',
    true,
    null,
    rng.float(0, 10, 2),
    { id: rng.int(1, 9), tags: ['x', 'y'] },
    ['nested', rng.int(1, 9), false],
    'beta',
    { name: 'gamma', value: null },
    -rng.int(1, 9),
    '',
    [],
    { ok: rng.chance(0.5), count: rng.int(0, 20), note: words(rng, 2, 4) },
  ];
}

function reviews(rng: Rng): JsonObject {
  const products = ['Desk lamp', 'Trail shoes', 'Coffee grinder', 'Rain jacket', 'Keyboard', 'Water bottle', 'Backpack', 'Headphones'];
  return {
    reviews: Array.from({ length: 45 }, (_, i): JsonObject => ({
      id: `r-${pad(i + 1, 3)}`,
      product: rng.pick(products),
      rating: rng.int(1, 5),
      author: personName(rng),
      title: sentence(rng, 3, 6),
      body: paragraph(rng, rng.int(3, 6)),
      helpful: rng.int(0, 120),
    })),
  };
}

function orders(rng: Rng): JsonObject {
  const statuses = ['paid', 'shipped', 'delivered', 'refunded', 'pending'];
  const skus = ['A-100', 'B-220', 'C-310', 'D-400', 'E-555', 'F-610', 'G-720'];
  return {
    orders: Array.from({ length: 59 }, (_, i): JsonObject => {
      const lines = Array.from({ length: rng.int(1, 4) }, () => ({ sku: rng.pick(skus), qty: rng.int(1, 4), cents: rng.int(399, 8999) }));
      const totalCents = lines.reduce((sum, line) => sum + line.qty * line.cents, 0);
      const city = rng.pick(CITIES);
      const shipRoll = rng.int(0, 9);
      return {
        id: `ORD-${String(30001 + i)}`,
        customer: personName(rng),
        status: rng.pick(statuses),
        currency: rng.pick(['USD', 'EUR']),
        ...(shipRoll === 0 ? {} : { ship: shipRoll === 1 ? null : { city: city[0], zip: city[1] } }),
        lines: lines.map((line) => ({ sku: line.sku, qty: line.qty, price: line.cents / 100 })),
        total: totalCents / 100,
        ...(rng.chance(0.2) ? { note: sentence(rng, 2, 5) } : {}),
      };
    }),
  };
}

const BUILDERS: Record<CaseName, (rng: Rng) => JsonRoot> = {
  'UI text, uneven rows': uiTextUneven,
  'UI text, uniform rows': uiTextUniform,
  'Translation batch': translationBatch,
  'File list, short': fileListShort,
  'File list, long': fileListLong,
  '200 users': users,
  'Metrics, numbers and booleans': metrics,
  'Deep nested config': deepConfig,
  'Mixed-type array': mixedArray,
  'Reviews, long text': reviews,
  'Orders with line items': orders,
};

export interface CaseInput {
  readonly name: CaseName;
  readonly data: JsonRoot;
}

/** The eleven cases drawn from one seed. SEED gives the published inputs; the seed sweep uses others. */
export function buildCases(seed: number): readonly CaseInput[] {
  return CASE_NAMES.map((name) => ({ name, data: BUILDERS[name](caseRng(name, seed)) }));
}

/** The file text, in the `{ cases: [{ name, data }] }` shape both counters read. */
export function casesText(): string {
  return `${JSON.stringify({ cases: buildCases(SEED) }, null, 2)}\n`;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUTPUT, casesText());
  console.log(`Wrote ${OUTPUT}: ${String(CASE_NAMES.length)} cases from seed ${String(SEED)}.`);
}
