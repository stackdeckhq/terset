# Terset format

Format version 1.2

TERse SETs. Terset writes a JSON object or array as short lines. Any list of
two or more objects becomes one tab-separated table when that is smaller
than compact JSON.

## Stability

Format 1.0 freezes every text a 1.0 encoder may write, the value each text
represents, and what a 1.0 decoder must accept and must reject. The encoder
rules below choose exactly one text for each value, including its key
order. A decoder must accept only that canonical text. A different spelling
of the same value must be rejected.

A change that makes any 1.0 text decode differently, or makes a decoder
reject valid 1.0 text, requires Format 2.0. A purely additive change that
1.0 decoders reject cleanly requires Format 1.1. Each format version keeps
its own fixtures. The language-neutral 1.0 suite lives in `conformance/`
at the repository root. Format versions are separate from package versions.

Format 1.1 adds named cells for sparse table fields (see "Named cells").
A 1.0 decoder rejects 1.1 named tables, because `name=value` is not a valid
header column. A 1.1 encoder writes 1.1 text by default and writes 1.0 text
on request. A 1.1 decoder accepts the canonical 1.1 text of a value and the
canonical 1.0 text of the same value. It rejects a document that mixes the
two. The 1.1 suite lives in `conformance/1.1/`.

Format 1.2 adds path entries for fields inside objects (see "Path entries").
A bare slash between keys is new syntax that 1.0 and 1.1 decoders reject.
A 1.2 decoder accepts the canonical text of any of the three versions.
The encoder defaults to 1.2 and offers 1.1 and 1.0 on request. The 1.2
suite lives in `conformance/1.2/`. The rules below apply to all versions
unless they name a version.

The rules line, `RULES`, `rulesFor` and `rules_for` output, and prompt text
for models are outside this freeze. They remain tunable and are versioned
by date. The current guidance below is dated 2026-11-28. Performance and
package APIs are also outside the freeze. In the current packages, use
`encode(value, { format: "1.1" })` in JavaScript or
`encode(value, format="1.1")` in Python to write 1.1 text. Use
`"1.0"` for 1.0 text.

Error message wording is outside the freeze. The current package tests pin
JavaScript `SyntaxError` and Python `ValueError` for rejected text. The
`rejection-errors.json` fixture also pins each listed message for those two
packages as a regression check. It defines no portable error code or kind.
Other implementations must refuse those texts, but may use their own error
types and messages.

## Data

The encoder accepts a root JSON object or array. Its values are plain
objects, dense arrays, strings, booleans, null and finite numbers.
Undefined, cycles, symbol keys, non-plain objects and depth above 500 are
errors. Numeric `-0` is an explicit error. Text `"-0"` round-trips. An empty
root object is `{}`. Key order is JavaScript own enumerable key order,
including the integer-key ordering JSON uses.

An array-index key is a canonical decimal integer from 0 through
4294967294, with no leading zero except `0` itself. These keys come first
in ascending numeric order. All other keys keep insertion order at every
object level. Thus `4294967295`, `01` and `-0` are ordinary string keys.
Key order is part of the value for canonical encoding and round trips.

Numbers have IEEE-754 binary64 semantics. A language with arbitrary-size
integers must supply the same binary64 value, rather than preserve extra
integer precision. An encoder must reject values outside this data model.

## Canonical encoder

The following rules are requirements, including quoting, table selection
and fallback. An encoder must write their exact result.

### Lines and cells

Each root field is `key: value`, `key[N]:` followed by a list table, or
`key{N}:` followed by a keyed table. A root array starts with `[N]` on its
own line when it is a table. Otherwise it is compact JSON. N counts data
rows, excluding the header. Compact JSON lists carry no count. Lines use
LF. There is no added final LF. An absent final one-column cell is an empty
row, so that text ends with LF. Simple keys match
`[A-Za-z_$][A-Za-z0-9_$.-]*`. Other keys are JSON strings.

A table has one tab-separated header, with any first field. In a table
without named cells, each row has exactly that many tab-separated cells,
including trailing empty cells. An empty cell means the field is absent. Empty text is `""`. Null is `null`.
Numbers, booleans and null keep their types in every ordinary column.

A leading bare `id` header marks string ids. Its cells are bare strings,
even `1`, `true` or `007`. This needs every row to start with a nonempty
string id with no edge whitespace and no troublesome characters. An
unflattened first `id` column in a list table that does not meet these rules
is written `"id"`, which selects ordinary typed cells. A uniform object in
`id` can expand into dotted columns. Keyed tables and `id` columns that are
not first use ordinary typed cells.

Other strings are written bare unless they are empty, have edge
whitespace, start with a double quote, bracket or brace, contain control
characters, DEL, U+0085, U+2028 or U+2029, or look numeric. Numeric-looking
includes `007`, `+5`, `1e3`, `.5` and `-0`. The words true, false, null,
undefined, NaN, Infinity and -Infinity are quoted as text. Other scalars and
nested values are compact JSON. Tabs and LF inside text use JSON escapes.
Lone surrogate code units are JSON-escaped, so UTF-8 transport cannot
replace them. Astral pairs are kept as they are.

Here troublesome characters mean U+0000 through U+001F, U+007F, U+0085,
U+2028, U+2029 and lone surrogate code units. Edge whitespace is exactly
U+0009 through U+000D, U+0020, U+00A0, U+1680, U+2000 through U+200A,
U+2028, U+2029, U+202F, U+205F, U+3000 and U+FEFF.

Numeric-looking text matches this whole ASCII pattern:

```text
[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?
```

Compact JSON uses the key order above and ECMAScript `JSON.stringify`
spelling, with no optional whitespace. Strings escape double quotes and
backslashes. Backspace, tab, LF, form feed and CR use `\b`, `\t`, `\n`,
`\f` and `\r`. Other U+0000 through U+001F characters and lone surrogates
use lowercase `\uXXXX` escapes. Other characters stay literal, including
astral pairs, U+0085, U+2028 and U+2029 inside JSON strings. There is no
Unicode normalization or slash escaping.

Number spelling is the shortest decimal that round-trips to the same
binary64 value, using ECMAScript's nearest-decimal and even-tie rules.
Nonzero magnitudes from 1e-6 inclusive to 1e21 exclusive use fixed notation.
Other nonzero magnitudes use lowercase `e`, an explicit `+` for a positive
exponent, and no exponent leading zeros. Zero is `0`. For example, 1e-6 is
`0.000001`, 1e-7 is `1e-7`, and 1e21 is `1e+21`.

### Table selection and fallback

An array of two or more objects becomes a table when the header and data
rows are strictly shorter than the array's compact JSON in UTF-8 bytes.
This comparison excludes the count line or named table line. The count is
added after selection.

The header holds each field once, in an order that every row's own key
order follows. Number the fields in the order they are first seen, reading
the rows in order and each row's keys in order. A field may be placed once
every field before it in any row is placed. Of the fields that may be
placed, place the lowest-numbered one next. So when first-seen order
already fits every row, the header is first-seen order. For example, rows
`{a, c}` then `{b, c}` give the header `a b c`, and rows `{a, b}` then
`{c, a}` give `c a b`. Fields may be absent, the first field included.
Empty object rows are allowed when the list has at least one field. No id
is required. Numeric ids, booleans, null and mixed-type columns are
supported.

There is one fallback. The whole list stays compact JSON if it has fewer
than two rows, a row that is not an object, no fields, key orders that no
one header can follow (such as `{a, b}` then `{b, a}`), or a table that is
not smaller. Inside a root object this is a `key: JSON` line. At the root
it is the JSON array itself.

Tables are chosen only at the root or as entries. In 1.0 and 1.1, entries
are direct fields of a root object. In 1.2 they can also be path entries.
Lists inside table cells stay compact JSON. Terset does no sorting, no
column reordering beyond the header rule above, and no constant hoisting.

An entry whose value is a map of at least two objects may use
a keyed table. Its name is `key{N}:`. Its first header cell is the bare
marker `@key`. That column holds each entry's key as bare text. It is not
a field in the entry object. All other cells use ordinary typed rules,
including an `id` field. The row header follows the same header rule as
list tables. Missing fields and empty entry objects are allowed.
Root maps do not become keyed tables.

Entry keys must be nonempty, have no edge whitespace or troublesome
characters, and must not look like a root field line. Otherwise the whole
map stays compact JSON. A keyed table is selected only when its complete
named block is strictly shorter in UTF-8 bytes than `key: JSON`. A tie
keeps compact JSON.

For either table kind, a column becomes nested columns when every row
contains an object there with the same nonempty key list in the same
order. All path segments must be simple keys without a dot. Expand those
keys in place and apply the same rule recursively, up to 8 path segments.
An object at the eighth segment stays a JSON cell. For example,
`address.city` is field `city` inside object `address`. If a nested object
is absent, empty, differently ordered or has an ineligible key, keep that
column as JSON. A literal field name containing a dot is JSON-quoted in
the header. A literal `@key` field is also JSON-quoted.

One-column strings that look like a root `key:` line are JSON-quoted. If an
id looks like such a line, the header uses the typed `"id"` mode instead.
This includes counted root lines such as `key[2]:` and `key{2}:`.
A lookalike starts with a simple key or a quoted key-shaped prefix,
optionally followed by a bracketed or braced run of ASCII digits, then a
colon and any remaining text. This check includes quoted prefixes with
invalid JSON escapes and counts that would be invalid in a real field.
This extra quoting applies only to one-column list tables. Keyed entry
keys must avoid these lookalikes regardless of table width. String ids
in wider list tables may contain them as raw text.
Root field lines hold no raw tabs. Read exactly N rows after the header.
Every row must have the exact header width, apart from named cells.

### Named cells (format 1.1)

A 1.1 table splits its header at the first header field that some row
lacks. The fields before that point are positional columns. Every rule
above applies to them, including nested columns, the `id` modes and the
one-column lookalike quoting, which counts positional columns only. A
table with no sparse field is the same in both versions.

When a field is sparse, the header ends with the literal marker cell
`name=value`, after the positional columns. The marker comes after `@key`
in a keyed table. There may be no positional columns, so the header may be
`name=value` alone. Each row writes its positional cells, then one
`name=value` cell for each later field the row has. Those cells follow
header order, which is also the row's own key order. An absent field
writes nothing. A row with no positional columns and no named cells is an
empty line.

A name is one field, never a path. It is bare when it is a simple key with
no dot. Otherwise it is a JSON string, as in `"a.b"=1`. The value follows
the ordinary typed cell rules and is never empty. Named values are never
flattened, so an object value is a JSON cell, as in `o={"x":1}`. A
positional first `id` column is the only `id` mode. A sparse `id` field is
an ordinary named cell, as in `id=1`.

Table selection and fallback are unchanged. The 1.1 table must still be
strictly shorter than compact JSON. Named cells can be longer than empty
cells, so a few lists that are tables in 1.0 stay compact JSON in 1.1, and
the reverse.

### Path entries (format 1.2)

An entry with a nonempty object value may expand into one entry per
member, in member order. Each member's name is the full parent name,
then `/`, then the member key. An entry can hold a scalar, compact JSON,
a list table or a keyed table. A member with a nonempty object value
can expand again. An empty object stays `{}`.

Write each path segment with the root key rule. Use a bare key when it
matches the simple key pattern and a JSON string otherwise. A slash
inside a JSON string belongs to that key. For example, `"a/b": 1`
writes the single key `a/b`, and `"a/b"/c: 1` writes field `c`
inside that key. A dot in a bare entry key is literal. Dots in table
headers still follow the header rules.

Compare the complete 1.1 entry with the expansion, using the entry's
full name for both. The 1.1 entry uses the ordinary 1.1 selection rules,
with the full name in place of the root key. The expansion joins the
canonical 1.2 entries of the members with LF, with no added final LF.
Measure both candidates in UTF-8 bytes, including names, counts,
headers, rows and line breaks. Choose the expansion only when it is
strictly smaller. A tie keeps the 1.1 entry. This comparison works
from the leaves up.

An entry name has at most 8 path segments, including the root key.
At the eighth segment use the 1.1 entry. Table rules inside that
entry still apply, including the separate limit on header paths.
Path entries never occur inside a table, JSON cell or root array.

## Grammar

The following describes the line framing. Cell and selection rules above
also apply. A count is a base-10 integer from 2 through 9007199254740991,
with no leading zero. `LF` is a line feed and `TAB` is a tab.

```text
document    = "{}" | compact-array | root-table | fields
root-table  = "[" count "]" LF header (LF row){count}
            | "[" count "]" LF named-header (LF named-row){count}
fields      = field (LF field)*
field       = key ": " cell
            | key "[" count "]:" LF header (LF row){count}
            | key "[" count "]:" LF named-header (LF named-row){count}
            | key "{" count "}:" LF "@key" TAB header (LF keyed-row){count}
            | key "{" count "}:" LF "@key" TAB named-header (LF keyed-named-row){count}
header      = column (TAB column)*
named-header = [header TAB] "name=value"
column      = quoted-key | segment ("." segment)*
row         = optional-cell (TAB optional-cell)*
keyed-row   = entry-key TAB row
named-row   = "" | item (TAB item)*
keyed-named-row = entry-key (TAB item)*
item        = cell | name "=" cell
name        = segment | quoted-key
```

`key` is a simple key or JSON string. `segment` is a simple key without
a dot. A quoted column always names one literal field. In a named row, the
items are one nonempty cell per positional column, then the named cells.
The empty `named-row` is allowed only when there are no positional columns.
There is no format switch or reader for uncounted tables.

In 1.2, replace the leading `key` in each `field` alternative with
`entry-name`.

```text
entry-name = key ("/" key){0,7}
```

## Decoder

Rejected text raises `SyntaxError` in JavaScript and `ValueError` in Python.
Invalid values passed to the encoder raise `TypeError` in both packages.

The decoder accepts only the encoder's canonical output. It parses JSON
with JSON.parse and never evaluates text. It rejects duplicate keys and
extra cells. It rejects missing or extra rows, invalid counts, missing
`@key` markers, duplicate entry keys, unsafe entry keys, duplicate header
paths and paths that are prefixes of another path. It rejects empty or
invalid path segments. Quoted literal dotted keys and nested paths remain
distinct. It re-encodes its result to reject noncanonical input,
duplicate nested keys included. Properties are defined as own data, so
`__proto__` and `constructor` cannot change an object's prototype. The
depth limit also applies to JSON cells. The same input always gives
byte-identical output.

In particular, a decoder must reject extra whitespace, an added final LF,
unneeded quotes or escapes, alternate number spellings, and a JSON fallback
where the encoder would choose a table. It must also reject a table where
the encoder would choose JSON. An LF that represents an absent final
one-column cell is data and must be kept. A decoder may implement canonical
validation without calling an encoder, but must accept the same texts.

A header whose last cell is `name=value` marks a named table. A decoder
must reject an empty positional cell, a named cell without `=`, a bare name
that is not a simple key without a dot, an empty value, a field named twice
in one row, named cells out of header order and a marker the encoder would
not write.

The 1.2 decoder builds objects for the parent segments of a path. The
first occurrence of a parent places it in member order, subject to the
array-index order in "Data". Reject a duplicate path and any path that
tries to enter a complete scalar, JSON or table entry. Reject assigning
a complete entry where a path already built an object. Reject paths
longer than eight segments and paths with missing or invalid keys.

All the entries under an expanded parent form one contiguous group,
including the rows of its tables. A decoder rejects interleaved groups.
It also rejects expansions that tie or lose the byte comparison. The
whole document must equal the canonical encoding of its value in 1.2,
1.1 or 1.0. For instance, a document with a path and a 1.0 empty cell
cannot mix the two versions.

## Limits

Header paths have at most 8 segments. Deeper object values stay JSON cells
at the eighth segment. Decoders reject longer paths before reading rows.

Numeric negative zero is rejected. The root is at depth 0. Each object
field or array element adds one, including scalar leaves. Depth 500 is
allowed and depth 501 is rejected. Table framing does not reset depth.
Text `"-0"`, lone surrogates, 100 kB strings and 5,000 rows round-trip. Large
finite numbers keep their IEEE-754 value. Precision lost before encoding
cannot come back. NFC and NFD text stay different code units, in values and
in keys. Available memory and runtime stack limits also constrain input size.

## Rules guidance, 2026-11-28

This section is outside the format freeze. No legend is written into the
data. The package exports one rules line, `RULES`, to put once in a shared
system prompt, outside the data:

> Tables use tab-separated headers and rows. Empty cells mean absent. After the header columns, a row lists its other fields as name=value. A field a row does not list is absent. JSON quotes distinguish numeric, boolean or null text from scalars. Nested cells use JSON. A leading bare id header marks string IDs. name{N} has N entries; the @key column holds each entry's key and is not a field. Header a.b is field b in object a. Key a/b is field b in object a.

`rulesFor(text)` in JavaScript and `rules_for(text)` in Python return only
the sentences whose constructs appear in canonical encoded text. Sentences
keep this order and join with single spaces:

| Order | Trigger | Sentence |
| --- | --- | --- |
| 1 | Any table | Tables use tab-separated headers and rows. |
| 2 | Any empty table cell, excluding the string id column | Empty cells mean absent. |
| 3 | Any table header that ends with `name=value` | After the header columns, a row lists its other fields as name=value. A field a row does not list is absent. |
| 4 | Any table cell, named value or entry value that starts with a double quote | JSON quotes distinguish numeric, boolean or null text from scalars. |
| 5 | Any table cell or named value that starts with `{` or `[` | Nested cells use JSON. |
| 6 | A list table whose first header is bare `id` | A leading bare id header marks string IDs. |
| 7 | Keyed table with its `@key` header | name{N} has N entries; the @key column holds each entry's key and is not a field. |
| 8 | Unquoted dotted header path in either table kind | Header a.b is field b in object a. |
| 9 | Slash between keys in an entry name | Key a/b is field b in object a. |

Cells in a leading bare `id` column are raw strings and do not trigger
sentences 4 or 5. Entry keys in the `@key` column are bare text and do not
trigger them either. Quoted header names and quoted names in named cells do
not trigger sentence 4. Entry names with a slash inside a quoted key do
not trigger sentence 9. JSON entries and root JSON arrays do not trigger
sentence 5. Text with no trigger returns
the empty string `""`. Invalid text raises the same error as `decode`.
A sender may send the full `RULES` line or the fitted line returned for the
encoded text. Rules fixtures stay in `packages/terset/tests/rules-cases.json`
and are separate from the frozen conformance suite.
