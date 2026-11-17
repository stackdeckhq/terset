# Terset format

TERse SETs. Terset writes a JSON object or array as short lines. Any list of
two or more objects becomes one tab-separated table when that is smaller
than compact JSON.

## Data

The encoder accepts a root JSON object or array. Its values are plain
objects, dense arrays, strings, booleans, null and finite numbers.
Undefined, cycles, symbol keys, non-plain objects and depth above 500 are
errors. Numeric `-0` is an explicit error. Text `"-0"` round-trips. An empty
root object is `{}`. Key order is JavaScript own enumerable key order,
including the integer-key ordering JSON uses.

## Lines and cells

Each root field is `key: value`, `key[N]:` followed by a list table, or
`key{N}:` followed by a keyed table. A root array starts with `[N]` on its
own line when it is a table. Otherwise it is compact JSON. N counts data
rows, excluding the header. Compact JSON lists carry no count. Lines use
LF. There is no added final LF. An absent final one-column cell is an empty
row, so that text ends with LF. Simple keys match
`[A-Za-z_$][A-Za-z0-9_$.-]*`. Other keys are JSON strings.

A table has one tab-separated header, with any first field. Each row has
exactly that many tab-separated cells, including trailing empty cells.
An empty cell means the field is absent. Empty text is `""`. Null is `null`.
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

No legend is written into the data. The package exports one rules line,
`RULES`, to put once in the system prompt, outside the data:

> Tables use tab-separated headers and rows. Empty cells mean absent. JSON quotes distinguish numeric, boolean or null text from scalars. Nested cells use JSON. A leading bare id header marks string IDs. name{N} has N entries; the @key column holds each entry's key and is not a field. Header a.b is field b in object a.

`rulesFor(text)` in JavaScript and `rules_for(text)` in Python return the
shortest valid rules sentence for canonical encoded text. The five base
sentences above always appear. The remaining sentences appear only when
their construct is used, in this order, joined by single spaces:

| Order | Construct | Sentence |
| --- | --- | --- |
| 1 | Keyed table with its `@key` header | name{N} has N entries; the @key column holds each entry's key and is not a field. |
| 2 | Unquoted dotted header path in either table kind | Header a.b is field b in object a. |

Cells, quoted field names and JSON values do not select extra sentences.
Text with no tables gets only the base sentences. Invalid text raises the
same error as `decode`. A sender may send the full `RULES` line or the fitted
line returned for the encoded text. List tables keep their `[N]` counts in
the data. The decoder rejects missing or extra rows.

## Table selection and fallback

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

Tables are chosen only at the root or for direct fields of a root object.
Nested lists stay compact JSON cells. Terset does no sorting, no column
reordering beyond the header rule above, and no constant hoisting.

A direct root field whose value is a map of at least two objects may use
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
Root field lines hold no raw tabs. Read exactly N rows after the header.
Every row must have the exact header width.

## Grammar

The following describes the line framing. Cell and selection rules above
also apply. A count is a base-10 integer from 2 through 9007199254740991,
with no leading zero. `LF` is a line feed and `TAB` is a tab.

```text
document    = "{}" | compact-array | root-table | fields
root-table  = "[" count "]" LF header (LF row){count}
fields      = field (LF field)*
field       = key ": " cell
            | key "[" count "]:" LF header (LF row){count}
            | key "{" count "}:" LF "@key" TAB header (LF keyed-row){count}
header      = column (TAB column)*
column      = quoted-key | segment ("." segment)*
row         = optional-cell (TAB optional-cell)*
keyed-row   = entry-key TAB row
```

`key` is a simple key or JSON string. `segment` is a simple key without
a dot. A quoted column always names one literal field. There is no format
switch or reader for uncounted tables.

## Decoder

In JavaScript, rejected text raises `SyntaxError`. Invalid values passed to
the encoder raise `TypeError`.

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

## Limits

Header paths have at most 8 segments. Deeper object values stay JSON cells
at the eighth segment. Decoders reject longer paths before reading rows.

Numeric negative zero is rejected. Depth above 500 is rejected. Text
`"-0"`, lone surrogates, 100 kB strings and 5,000 rows round-trip. Large
finite numbers keep their IEEE-754 value. Precision lost before encoding
cannot come back. NFC and NFD text stay different code units, in values and
in keys. Available memory and runtime stack limits also constrain input size.
