// The live token view in the converter. This module holds the o200k_base rank table,
// about 1 MB gzipped, so only a dynamic import() loads it, on the first "Show tokens"
// click. A static import anywhere in the page code would put the table in the main
// chunk; scripts/check-build.ts fails the build if it does.
// It counts the way the bench does (scripts/update-numbers.ts): compact JSON alone,
// and Terset text plus its fitted rules line, each counted on its own and summed.
import { decode, encode } from 'gpt-tokenizer/encoding/o200k_base';
import { rulesFor } from './format.ts';
import type { JsonRoot } from './format.ts';

export { LIVE_TOKENIZER } from './live-tokenizer.ts';

/** The most tokens one UTF-8 character can span, so a split character is joined back whole. */
const MAX_SPLIT = 4;
const REPLACEMENT = '�';

export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * The text as one string per token, in order, joining back to the text. A character
 * whose bytes span more than one token decodes only as a group, so those tokens share one piece.
 */
export function tokenPieces(text: string): readonly string[] {
  const ids = encode(text);
  const pieces: string[] = [];
  let start = 0;
  while (start < ids.length) {
    let end = start + 1;
    let piece = decode(ids.slice(start, end));
    while (piece.includes(REPLACEMENT) && end < ids.length && end - start < MAX_SPLIT) {
      end += 1;
      piece = decode(ids.slice(start, end));
    }
    pieces.push(piece);
    start = end;
  }
  return pieces;
}

/** One side of the live view: its token count and its text split into tokens. */
export interface LiveJson {
  readonly count: number;
  readonly pieces: readonly string[];
}

/** The Terset side: the fitted rules line and the text, split apart, and their summed count. */
export interface LiveTerset {
  readonly count: number;
  readonly rules: readonly string[];
  readonly text: readonly string[];
}

export interface LiveTokens {
  readonly json: LiveJson;
  readonly terset: LiveTerset;
}

/** Compact JSON of `value`, and the Terset `text` with its fitted rules line, counted and split with o200k_base. */
export function liveTokens(value: JsonRoot, text: string): LiveTokens {
  const json = JSON.stringify(value);
  const rules = rulesFor(text);
  return {
    json: { count: countTokens(json), pieces: tokenPieces(json) },
    terset: { count: countTokens(rules) + countTokens(text), rules: tokenPieces(rules), text: tokenPieces(text) },
  };
}
