# Terset conformance

This is the language-neutral suite for the [Terset format](../packages/terset/SPEC.md).
This folder holds the Format 1.0 suite. The `1.1/` and `1.2/` folders hold
the suites for [Format 1.1](#format-11) and [Format 1.2](#format-12).
JavaScript and Python are two separate implementations, each with its own
encoder and decoder. Both run every encode, decode and rejection case here
in CI. The tests use only their language's standard library.

## Files and JSON shapes

All files are UTF-8 JSON. Their exact shapes are:

| File | Shape | Meaning |
| --- | --- | --- |
| `manifest.json` | `{ "formatVersion": "1.0" }` | The format version of this suite. A test matches it to SPEC.md. |
| `cases.json` | Array of `{ "name": string, "input": object or array, "encoded": string }` or `{ "name": string, "recipe": recipe }` | Every entry tests exact encoding, decoding and round trips. The three recipes expand into the same input and expected-text pair. |
| `rejections.json` | Array of strings | Every string must be refused by a decoder, including noncanonical spellings. |
| `rejection-errors.json` | Array of `{ "name": string, "text": string, "error": string }` | Every `text` must be refused. `error` is the current exact exception message shared by the two packages. |

The format freezes acceptance, rejection and decoded values. The two package
test runners additionally check `rejection-errors.json` messages word for
word. JavaScript checks `SyntaxError`; Python checks `ValueError`. Those
language-specific checks preserve existing regressions. The format defines
no portable error codes or kinds, and error wording is outside the freeze.
An independent implementation can use its own exceptions and messages.

`packages/terset/tests/rules-cases.json` is separate. Its shape is an array of
`{ "name": string, "text": string, "rules": string, "features": string[] }`.
It checks prompt guidance, not the frozen data format. `RULES`, `rulesFor`
and `rules_for` remain tunable and versioned by date, currently 2026-11-28.

## Values, numbers and order

JSON can spell lone UTF-16 surrogate code units with escapes such as
`"\ud800"`. Preserve those units when loading inputs. Do not replace them
with U+FFFD. In expected Terset text, a literal JSON escape has its backslash
escaped by the fixture's outer JSON string. Thus `"x: \"\\ud800\""` describes
the Terset text `x: "\ud800"`. Valid surrogate pairs represent one astral
character. They appear literally in encoded text. Keep NFC and NFD distinct.

All input numbers describe IEEE-754 binary64 values. Parse decimal tokens
as binary64, including tokens that look like large integers. For example,
the fixture token `1000000000000000100` represents the same binary64 value
as the exactly representable integer `1000000000000000128`. The expected
text uses the first spelling. A JSON loader that preserves arbitrary-size
integers needs an explicit conversion. The Python runner also tests native
integers when converting them to binary64 loses no precision. Numbers have
no tagged or string-based replacement representation in the fixtures.

Keep object member order when loading fixtures and comparing decoded values.
Canonical array-index keys, from `0` through `4294967294`, come first in
numeric order. Other string keys keep insertion order. `01` and `4294967295`
are ordinary keys. Apply this rule recursively. An unordered object
comparison alone does not prove a round trip preserves order. Keys have no
separate order array in the fixtures.

## Recipes

Recipes keep stress cases small without calling an encoder to invent the
expected text. `compactJSON` below means the exact JSON spelling defined
in SPEC.md, not a platform's default JSON serializer. Every count and depth
in a recipe is a nonnegative integer.

- `{ "kind": "repeat-text", "text": string, "count": integer }`:
  repeat `text` exactly `count` times to get `s`. Set
  `items = [{ "id": "1", "name": s, "summary": s }]` and
  `input = { "items": items, "text": s }` in that order. Expected text is
  `"items: " + compactJSON(items) + LF + "text: " + s`.
- `{ "kind": "rows", "count": integer, "prefix": string, "suffix": string }`:
  for `i` from 0 through `count - 1`, create
  `{ "id": decimalString(i + 1), "name": prefix + decimalString(i) + suffix }`
  in that order. Set `input = { "items": rows }`. Expected text is
  `"items[" + decimalString(count) + "]:" + LF + "id" + TAB + "name" + LF`,
  followed by each raw `id + TAB + name` row joined with LF. Add no final LF.
- `{ "kind": "depth", "depth": integer, "leaf": string }`:
  start with `v = leaf` and wrap it as `{ "next": v }` exactly `depth` times.
  Set `input = { "nested": v }`. Expected text is `"nested: "`, followed by
  `'{"next":'` repeated `depth` times, `compactJSON(leaf)`, then `"}"`
  repeated `depth` times.

The committed recipes use 50,000 repetitions of `ñ` for 100 kB of UTF-8
text, 5,000 rows, and 499 wrappers around the leaf `底`. These exact shapes
make the formulas above canonical. They are fixture instructions, not a
general alternate encoding algorithm.

The reference expansion helpers are
`packages/terset/tests/shared-recipes.ts` and
`packages/terset-py/tests/test_terset.py`. The JavaScript fixture generator
is `packages/terset/tests/generate-cases.ts`. The committed JSON is the
expected result for independent implementations. Running that generator
is not a substitute for passing the frozen suite.

## Requirements and limits

A conforming encoder, writing Format 1.0, writes exactly the expected text
for every positive case. This includes key order, quotes, numeric spelling, table selection
and JSON fallback. A conforming decoder accepts every positive case and
returns its value with key order intact. It rejects every entry in both
rejection files. It accepts only canonical text, even when another spelling
would parse into the same value. Re-encoding each decoded value as Format 1.0
must produce the original text.

The suite samples the format. Passing it does not replace the specification.
Implement these limits too:

- The root is an object or array. Its depth is 0. Each object field or array
  element adds one, even when the child is a scalar. Depth 500 is valid;
  depth 501 is rejected. Table framing never resets depth.
- Header paths have at most 8 segments. Objects at the eighth segment stay
  in JSON cells. Longer paths are rejected.
- Table counts run from 2 through 9007199254740991 with no leading zero.
  Counts exclude the header. Every row has exactly the header width.
- Numeric negative zero, nonfinite numbers and cycles are rejected.
  Text `"-0"` remains a string. Strings retain their Unicode code units.
- The 100 kB and 5,000-row cases are valid inputs, not maximum sizes.
  Available memory and runtime stack limits can also constrain input size.

## Test your own implementation

Load the fixtures directly from this folder. Expand all three recipes and
keep the normal entries too. Do not generate expected text with the encoder
under test.

```text
assert loadJSON("manifest.json").formatVersion == "1.0"
for case in loadJSON("cases.json", numbers=binary64, keepObjectOrder=true):
    input, text = expandRecipeOrReadPair(case)
    assert utf8(encode(input, format="1.0")) == utf8(text)
    decoded = decode(text)
    assert sameValuesAndKeyOrder(decoded, input)
    assert utf8(encode(decoded, format="1.0")) == utf8(text)
for text in loadJSON("rejections.json"):
    assert decodeRefuses(text)
for case in loadJSON("rejection-errors.json"):
    assert decodeRefuses(case.text)
```

## Format 1.1

Format 1.1 adds named cells for sparse fields. `1.1/manifest.json` is
`{ "formatVersion": "1.1" }`. `1.1/cases.json` and `1.1/rejections.json`
have the same shapes as the 1.0 files above, with no recipes. A 1.1 encoder
writes each `encoded` text exactly, and a 1.1 decoder rejects each rejection.
A 1.1 decoder still accepts every 1.0 case. It rejects a document that mixes
1.0 empty cells with 1.1 named cells.

```text
assert loadJSON("1.1/manifest.json").formatVersion == "1.1"
for case in loadJSON("1.1/cases.json", numbers=binary64, keepObjectOrder=true):
    assert utf8(encode(case.input, format="1.1")) == utf8(case.encoded)
    decoded = decode(case.encoded)
    assert sameValuesAndKeyOrder(decoded, case.input)
for text in loadJSON("1.1/rejections.json"):
    assert decodeRefuses(text)
```

## Format 1.2

Format 1.2 adds slash-separated entry paths. It uses the path candidate only
if the entire document saves at least 256 UTF-8 bytes over format 1.1.
The cases cover both sides of the margin. A path has at most eight
segments. A slash inside a quoted key is literal.

The files in `1.2/` have the same shapes as those in `1.1/`. Run the
same checks with format `"1.2"`. A 1.2 decoder must also keep accepting
the canonical 1.0 and 1.1 texts with their original key order. It rejects
documents that match none of the three versions.

## Run the package tests

From the repository root, run the existing implementations with:

```sh
pnpm --dir packages/terset test
```

```sh
pnpm test:py
```

These are source-checkout tests. npm tarballs and Python wheels do not ship
or require this folder. Keep each format version's fixtures separate and
retain the older suites.

## License

MIT. See [LICENSE](../LICENSE).
