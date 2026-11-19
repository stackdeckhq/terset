// Input list prices for the cost figures, read from each vendor's public
// pricing page on the date below. Every dollar figure on the site and in the
// READMEs comes from here. Input tokens only: no output, caching or discounts.
// Typed here; data-check.ts checks the values against PricesSchema on the server and in tests.
import type { Price, Prices } from './prices-schema.ts';

export type { Price, Prices };

export const PRICES: Prices = {
  readOn: '2026-11-17',
  o200k: {
    model: 'GPT 6.1 Sol',
    counter: 'o200k_base',
    usdPerMillionInput: 2,
    condition: 'context up to 272K',
    source: 'https://developers.openai.com/api/docs/pricing',
  },
  claude: {
    model: 'Claude Opus 5.5',
    counter: 'claude-opus-5-5',
    usdPerMillionInput: 4,
    condition: null,
    source: 'https://platform.claude.com/docs/en/about-claude/pricing',
  },
};
