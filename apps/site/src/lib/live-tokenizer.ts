// Facts about the live tokenizer that the page states before it loads it. They live apart
// from lib/tokens.ts, which holds the o200k_base rank table, so the page and
// scripts/check-build.ts can read them without loading the table.

/** The one tokenizer the live view counts with. The Claude counts are not live. tokens.test.ts holds it to the bench file. */
export const LIVE_TOKENIZER = 'o200k_base';

/**
 * The gzipped size of the o200k_base rank table, in megabytes, rounded. TokenView.test.ts
 * holds it to the table in node_modules, and check-build.ts to the chunk the build wrote.
 */
export const TOKENIZER_DOWNLOAD_MB = 1;
