import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { PAGE_PATHS } from './src/data/site.ts';

const SHIP_FIXTURE = fileURLToPath(new URL('./src/data/bench-fixture.ship.ts', import.meta.url));

// The build writes each page to dist/client as static HTML, so Workers serves it without
// running the worker. Only the listed pages: no link crawl and no route discovery, so the
// raw agent files stay with the worker and keep their own headers. A page goes to
// docs.html, not docs/index.html, so the default html_handling serves it at /docs.
const PRERENDER = {
  pages: PAGE_PATHS.map((path) => ({ path })),
  prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false, autoSubfolderIndex: false, failOnError: true },
};

export default defineConfig(({ command }) => ({
  server: { host: '127.0.0.1', port: 4880, strictPort: true },
  preview: { host: '127.0.0.1', port: 4881, strictPort: true },
  // A production build swaps the dev-only bench fixture for the empty ship stub.
  resolve: command === 'build' ? { alias: [{ find: /^\.\/bench-fixture\.dev\.ts$/u, replacement: SHIP_FIXTURE }] } : {},
  // The Cloudflare plugin runs the SSR environment in workerd and must come before tanstackStart.
  // tanstackStart must come before the React plugin.
  plugins: [tailwindcss(), cloudflare({ viteEnvironment: { name: 'ssr' } }), tanstackStart(PRERENDER), viteReact()],
}));
