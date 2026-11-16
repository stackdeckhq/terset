/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in dev shows the fake chart fixture. Ignored by production builds. */
  readonly VITE_BENCH_FIXTURE?: string;
}
