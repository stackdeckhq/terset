// The sample data the site shows. Plain JSON values, no Terset syntax.
// The people, orders and servers here are made up.
// scripts/generate-samples.ts encodes them with the real package into
// src/generated/samples.json, and a test fails when that file is stale.
import type { JsonObject, JsonRoot } from '../lib/format.ts';

export const SAMPLE_IDS = ['orders', 'servers', 'config'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export const SAMPLE_LABELS: Readonly<Record<SampleId, string>> = {
  orders: '6 orders',
  servers: '12 servers',
  config: 'Config',
};

const ORDERS = {
  orders: [
    { id: 'ORD-20001', customer: 'Ana Silva', status: 'paid', currency: 'USD', ship: { city: 'Lisbon', zip: '1100-148' }, lines: [{ sku: 'A-100', qty: 2, price: 9.99 }], total: 19.98 },
    { id: 'ORD-20002', customer: 'Ben Okafor', status: 'shipped', currency: 'USD', ship: { city: 'Lagos', zip: '101233' }, lines: [{ sku: 'B-220', qty: 1, price: 24.5 }, { sku: 'D-400', qty: 3, price: 7.25 }], total: 46.25 },
    { id: 'ORD-20003', customer: 'Chen Kim', status: 'delivered', currency: 'USD', ship: { city: 'Osaka' }, lines: [{ sku: 'E-555', qty: 1, price: 39.9 }], total: 39.9, note: 'Gift wrap' },
    { id: 'ORD-20004', customer: 'Dara Patel', status: 'refunded', currency: 'USD', ship: null, lines: [], total: 0 },
    { id: 'ORD-20005', customer: 'Eli Rossi', status: 'paid', currency: 'USD', lines: [{ sku: 'C-310', qty: 2, price: 15 }], total: 30 },
    { id: 'ORD-20006', customer: 'Fatima Garcia', status: 'shipped', currency: 'USD', ship: { city: 'Austin', zip: '78701' }, lines: [{ sku: 'A-100', qty: 1, price: 9.99 }, { sku: 'E-555', qty: 1, price: 39.9 }], total: 49.89 },
  ],
} satisfies JsonObject;

const SERVERS = {
  servers: [
    { id: 'web-00', region: 'eu-west', cpu: 23.88, memory_mb: 29933, healthy: true, requests: 92698 },
    { id: 'web-01', region: 'eu-west', cpu: 4.93, memory_mb: 28042, healthy: true, requests: 5310 },
    { id: 'web-02', region: 'eu-west', cpu: 6.88, memory_mb: 32241, healthy: false, requests: 53125 },
    { id: 'web-03', region: 'eu-west', cpu: 45.19, memory_mb: 17951, healthy: true, requests: 77741 },
    { id: 'web-04', region: 'eu-west', cpu: 77.98, memory_mb: 13699, healthy: true, requests: 85214, canary: true },
    { id: 'web-05', region: 'eu-west', cpu: 36.25, memory_mb: 15778, healthy: true, requests: 74913 },
    { id: 'web-06', region: 'us-east', cpu: 83.42, memory_mb: 11734, healthy: true, requests: 98176 },
    { id: 'web-07', region: 'us-east', cpu: 12.21, memory_mb: 14902, healthy: true, requests: 10800 },
    { id: 'web-08', region: 'us-east', cpu: 11.4, memory_mb: 20368, healthy: true, requests: 8454 },
    { id: 'web-09', region: 'us-east', cpu: 60.56, memory_mb: 30354, healthy: true, requests: 59051, alerts: [{ code: 'HIGH_CPU', since: '2026-11-12T07:40:00Z' }] },
    { id: 'web-10', region: 'us-east', cpu: 35.27, memory_mb: 10248, healthy: true, requests: 71168 },
    { id: 'web-11', region: 'us-east', cpu: 30.98, memory_mb: 5183, healthy: false, requests: 62557 },
  ],
} satisfies JsonObject;

const CONFIG = {
  service: { name: 'shop-api', version: '2.4.0' },
  server: { host: '0.0.0.0', port: 8080, timeouts: { read_ms: 5000, write_ms: 10000 } },
  database: { url: 'postgres://db:5432/shop', pool: { min: 2, max: 20 } },
  features: { new_checkout: { enabled: true, rollout: 0.25 } },
  logging: { level: 'info', format: 'json' },
} satisfies JsonObject;

export const SAMPLES: Readonly<Record<SampleId, JsonObject>> = { orders: ORDERS, servers: SERVERS, config: CONFIG };

/** The small examples the agent docs show. Each is encoded by the generate script. */
export const DOC_EXAMPLES = {
  users: {
    team: 'core',
    users: [
      { id: 'u1', name: 'Ada', role: null },
      { id: 'u2', role: 'ops' },
      { id: 'u3', name: '42', tags: ['new'] },
    ],
  },
  shipments: {
    shipments: [
      { id: 'A1', ship: { city: 'Oslo', zip: '0150' }, items: [{ sku: 'P1', qty: 2 }] },
      { id: 'A2', ship: { city: 'Lima' }, items: [{ sku: 'P2', qty: 1 }], note: '' },
    ],
  },
  rows: [
    { id: 7, code: '007', ok: true },
    { id: 8, code: 'B12', ok: false },
    { id: 9, code: 'true' },
  ],
} satisfies Readonly<Record<string, JsonRoot>>;

export type DocExampleId = keyof typeof DOC_EXAMPLES;
