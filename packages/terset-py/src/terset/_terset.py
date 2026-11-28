"""The Terset format, with JavaScript binary64 number semantics."""

from __future__ import annotations

import heapq
import json
import math
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Literal, TypeAlias, cast

JsonValue: TypeAlias = "None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]"
JsonObject: TypeAlias = dict[str, JsonValue]
JsonRoot: TypeAlias = "JsonObject | list[JsonValue]"
JsonInputValue: TypeAlias = "None | bool | int | float | str | Sequence[JsonInputValue] | Mapping[str, JsonInputValue]"
JsonInputRoot: TypeAlias = "Mapping[str, JsonInputValue] | Sequence[JsonInputValue]"

_MAX_JSON_DEPTH = 500
_MAX_HEADER_SEGMENTS = 8
_MAX_ENTRY_SEGMENTS = 8
_MIN_PATH_SAVINGS_BYTES = 256
_DEPTH_ERROR = "Maximum JSON depth is 500."
_HeaderTrie: TypeAlias = "dict[str, _HeaderTrie | None]"

FormatVersion: TypeAlias = Literal["1.0", "1.1", "1.2"]

_FITTED_RULES = [
    ("table", "Tables use tab-separated headers and rows."),
    ("empty", "Empty cells mean absent."),
    ("named", "After the header columns, a row lists its other fields as name=value. A field a row does not list is absent."),
    ("quoted", "JSON quotes distinguish numeric, boolean or null text from scalars."),
    ("json", "Nested cells use JSON."),
    ("id", "A leading bare id header marks string IDs."),
    ("keyed", "name{N} has N entries; the @key column holds each entry's key and is not a field."),
    ("nested", "Header a.b is field b in object a."),
    ("path", "Key a/b is field b in object a."),
]

RULES = " ".join(sentence for _, sentence in _FITTED_RULES)

# Ends the header of a table whose rows carry name=value cells.
_NAMED_MARKER = "name=value"


def rules_for(text: str) -> str:
    """Return the rules needed by canonical text, with decode's validation."""
    features: set[str] = set()
    _read_document(text, features)
    return " ".join(sentence for feature, sentence in _FITTED_RULES if feature in features)

_KEY = re.compile(r"[A-Za-z_$][A-Za-z0-9_$.-]*\Z")
_NUMBER = re.compile(r"[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?\Z")
_ENTRY = re.compile(r'^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$.-]*)(?:\[([0-9]+)\]|\{([0-9]+)\})?:([\s\S]*)\Z')
_ENTRY_KEY = re.compile(r"[A-Za-z_$][A-Za-z0-9_$.-]*")
_ENTRY_TAIL = re.compile(r"(?:\[([0-9]+)\]|\{([0-9]+)\})?:([\s\S]*)\Z")
_TROUBLE = re.compile(r"[\x00-\x1f\x7f\x85\u2028\u2029\ud800-\udfff]")
_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_WORDS = {"true", "false", "null", "undefined", "NaN", "Infinity", "-Infinity"}


def _unicode(text: str) -> str:
    # Python normally stores astral characters as one code point. Accept
    # explicit UTF-16 pairs too, keeping unpaired surrogates unchanged.
    return re.sub(r"[\ud800-\udbff][\udc00-\udfff]", lambda match: chr(0x10000 + ((ord(match[0][0]) - 0xD800) << 10) + ord(match[0][1]) - 0xDC00), text)


def _bare(text: str) -> bool:
    text = _unicode(text)
    return bool(text) and text.strip(_WHITESPACE) == text and not _TROUBLE.search(text) and text[0] not in '\"{[' and not _NUMBER.fullmatch(text) and text not in _WORDS


def _quote(text: str) -> str:
    # ensure_ascii=False keeps astral and non-ASCII text, like JSON.stringify.
    # Only lone surrogate code units must be escaped for UTF-8 transport.
    quoted = json.dumps(_unicode(text), ensure_ascii=False)
    return re.sub(r"[\ud800-\udfff]", lambda match: "\\u%04x" % ord(match[0]), quoted)


def _keys(value: JsonObject) -> list[str]:
    # Object.keys puts canonical array-index keys before other keys.
    indices = [key for key in value if key.isascii() and key.isdigit() and (key == "0" or not key.startswith("0")) and len(key) <= 10 and int(key) < 4294967295]
    index_set = set(indices)
    return sorted(indices, key=int) + [key for key in value if key not in index_set]


def _number(value: int | float) -> str:
    number = float(value)
    if number == 0:
        return "0"
    sign = "-" if number < 0 else ""
    text = repr(abs(number)).lower()
    mantissa, _, exponent = text.partition("e")
    before, _, after = mantissa.partition(".")
    digits = (before + after).lstrip("0")
    power = (int(exponent) if exponent else 0) - len(after)
    digits = digits.rstrip("0")
    # repr provides the shortest round-tripping significant digits. Both
    # runtimes choose the nearest decimal, with even ties. Only placement
    # of the decimal point and exponent notation differ.
    decimal_position = len((before + after).lstrip("0")) + power
    if 0 < decimal_position <= 21:
        body = digits[:decimal_position] + ("." + digits[decimal_position:] if decimal_position < len(digits) else "0" * (decimal_position - len(digits)))
    elif -6 < decimal_position <= 0:
        body = "0." + "0" * -decimal_position + digits
    else:
        exp = decimal_position - 1
        body = digits[0] + ("." + digits[1:] if len(digits) > 1 else "") + "e" + ("+" if exp >= 0 else "-") + str(abs(exp))
    return sign + body


def _validate(value: object) -> None:
    ancestors: set[int] = set()
    stack: list[tuple[object, int, bool]] = [(value, 0, False)]
    while stack:
        item, depth, leaving = stack.pop()
        if leaving:
            ancestors.remove(id(item))
            continue
        if depth > _MAX_JSON_DEPTH:
            raise TypeError(_DEPTH_ERROR)
        if item is None or type(item) in (str, bool):
            continue
        if type(item) is int or type(item) is float:
            try:
                number = float(item)
            except OverflowError as error:
                raise TypeError("Numbers must be finite.") from error
            if not math.isfinite(number) or (number == 0 and math.copysign(1, number) < 0):
                raise TypeError("Numbers must be finite and must not be negative zero.")
            if type(item) is int and int(number) != item:
                raise TypeError("Integers must be exactly representable as binary64 numbers.")
            continue
        if type(item) not in (list, dict):
            raise TypeError("Expected plain JSON data.")
        if id(item) in ancestors:
            raise TypeError("Cyclic JSON data.")
        ancestors.add(id(item))
        stack.append((item, depth, True))
        if isinstance(item, dict):
            if any(type(key) is not str for key in item):
                raise TypeError("JSON object keys must be strings.")
            if len({_unicode(key) for key in item}) != len(item):
                raise TypeError("Object keys must be distinct Unicode strings.")
            stack.extend((child, depth + 1, False) for child in item.values())
        else:
            stack.extend((child, depth + 1, False) for child in cast(list[object], item))


def _json(value: JsonValue) -> str:
    # Explicit stacks keep the supported depth independent of Python's
    # recursion limit. Separators are emitted as tokens, never as values.
    parts: list[str] = []
    stack: list[tuple[bool, JsonValue]] = [(False, value)]
    while stack:
        literal, item = stack.pop()
        if literal:
            parts.append(cast(str, item))
        elif item is None:
            parts.append("null")
        elif isinstance(item, bool):
            parts.append("true" if item else "false")
        elif isinstance(item, (int, float)):
            parts.append(_number(item))
        elif isinstance(item, str):
            parts.append(_quote(item))
        else:
            tokens: list[tuple[bool, JsonValue]] = []
            if isinstance(item, list):
                parts.append("[")
                for index, child in enumerate(item):
                    if index:
                        tokens.append((True, ","))
                    tokens.append((False, child))
                tokens.append((True, "]"))
            else:
                parts.append("{")
                for index, key in enumerate(_keys(item)):
                    if index:
                        tokens.append((True, ","))
                    tokens.extend([(True, _quote(key) + ":"), (False, item[key])])
                tokens.append((True, "}"))
            stack.extend(reversed(tokens))
    return "".join(parts)


def _key(text: str) -> str:
    return text if _KEY.fullmatch(text) else _quote(text)


def _cell(value: JsonValue) -> str:
    return _unicode(value) if isinstance(value, str) and _bare(value) else _json(value)


def _safe_id(text: str) -> bool:
    text = _unicode(text)
    return bool(text) and text.strip(_WHITESPACE) == text and not _TROUBLE.search(text)


def _segment(key: str) -> bool:
    return bool(_KEY.fullmatch(key)) and "." not in key


_MISSING = object()
_Column: TypeAlias = "tuple[list[str], list[JsonValue | object]]"


def _flatten(path: list[str], values: list[JsonValue | object]) -> list[_Column]:
    first = values[0]
    if len(path) >= _MAX_HEADER_SEGMENTS or not all(_segment(key) for key in path) or not isinstance(first, dict):
        return [(path, values)]
    keys = _keys(first)
    if not keys or not all(_segment(key) for key in keys) or not all(
        isinstance(value, dict) and _keys(value) == keys for value in values
    ):
        return [(path, values)]
    columns: list[_Column] = []
    for key in keys:
        columns.extend(_flatten(path + [key], [cast(JsonObject, value)[key] for value in values]))
    return columns


def _header(rows: list[JsonObject]) -> list[str] | None:
    """One header that every row's own key order fits, or None when none does.

    When several fields may come next, the one seen first wins, so a list whose
    first-seen field order already fits every row keeps exactly that order.
    """
    fields: list[str] = []
    positions: dict[str, int] = {}
    # A field's followers in some row, and how many fields must come before it.
    followers: list[list[int]] = []
    waiting: list[int] = []
    for row in rows:
        previous = -1
        for key in _keys(row):
            index = positions.get(key)
            if index is None:
                index = len(fields)
                positions[key] = index
                fields.append(key)
                followers.append([])
                waiting.append(0)
            if previous >= 0:
                followers[previous].append(index)
                waiting[index] += 1
            previous = index
    if not fields:
        return None
    ready = [index for index, count in enumerate(waiting) if count == 0]
    heapq.heapify(ready)
    order: list[str] = []
    while ready:
        index = heapq.heappop(ready)
        order.append(fields[index])
        for following in followers[index]:
            waiting[following] -= 1
            if waiting[following] == 0:
                heapq.heappush(ready, following)
    # Fields left over sit on a cycle: two rows order the same pair both ways.
    return order if len(order) == len(fields) else None


def _first_sparse(rows: list[JsonObject], fields: list[str]) -> int:
    """Index of the first header field that some row lacks, or the field count."""
    counts: dict[str, int] = {}
    for row in rows:
        for key in row:
            counts[key] = counts.get(key, 0) + 1
    return next((index for index, field in enumerate(fields) if counts.get(field) != len(rows)), len(fields))


def _table(value: list[JsonObject], keyed: bool, named: bool, entry_keys: list[str] | None = None,
           max_bytes: int | float = math.inf, write_cell: Callable[[JsonValue], str] = _cell) -> str | None:
    if len(value) < 2:
        return None
    rows = [{_unicode(key): child for key, child in row.items()} for row in value]
    fields = _header(rows)
    if fields is None:
        return None
    # Format 1.1 keeps the fields before the first sparse one as positional
    # columns and writes every later field a row has as a name=value cell.
    split = _first_sparse(rows, fields) if named else len(fields)
    has_named = split < len(fields)
    # Flattening can only add columns. Tabs alone rule out wide sparse tables.
    # Named cells write only present fields, so their size stays linear.
    if not has_named and len(rows) * (len(fields) - 1) >= max_bytes:
        return None
    columns: list[_Column] = []
    for field in fields[:split]:
        columns.extend(_flatten([field], [row.get(field, _MISSING) for row in rows]))
    lone = len(columns) == 1
    ids = not keyed and bool(columns) and len(columns[0][0]) == 1 and fields[0] == "id" and all(
        _keys(row)[:1] == ["id"] and isinstance(row.get("id"), str)
        and _safe_id(cast(str, row["id"]))
        and (not lone or not _ENTRY.fullmatch(cast(str, row["id"]))) for row in rows
    )
    headings = []
    for index, (path, _) in enumerate(columns):
        field = path[0]
        headings.append(".".join(path) if len(path) > 1 else _quote(field)
                        if "." in field or (index == 0 and field == "id" and not ids and not keyed) else _key(field))
    if has_named:
        headings.append(_NAMED_MARKER)
    if keyed:
        headings.insert(0, "@key")
    # A name is one field, never a path, so dotted names need quotes.
    names = {field: field if _segment(field) else _quote(field) for field in fields[split:]}
    lines = ["\t".join(headings)]
    for row_index in range(len(rows)):
        cells: list[str] = []
        for index, (_, values) in enumerate(columns):
            entry = values[row_index]
            if entry is _MISSING:
                cells.append("")
            elif index == 0 and ids:
                cells.append(_unicode(cast(str, entry)))
            elif not keyed and lone and isinstance(entry, str) and _ENTRY.fullmatch(entry):
                cells.append(_quote(entry))
            else:
                cells.append(write_cell(cast(JsonValue, entry)))
        if has_named:
            # Each row's own key order fits the header, so its positional
            # fields come first and its other fields follow in header order.
            row = rows[row_index]
            cells.extend(f"{names[key]}={write_cell(row[key])}" for key in _keys(row)[split:])
        if keyed:
            if entry_keys is None:
                raise TypeError("Missing entry keys.")
            cells.insert(0, _unicode(entry_keys[row_index]))
        lines.append("\t".join(cells))
    return "\n".join(lines)


def _list_table(value: JsonValue, named: bool, size: int | None = None,
                write_cell: Callable[[JsonValue], str] = _cell) -> str | None:
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        return None
    if size is None:
        size = len(_json(value).encode("utf-8"))
    text = _table(cast(list[JsonObject], value), False, named, max_bytes=size, write_cell=write_cell)
    return text if text is not None and len(text.encode("utf-8")) < size else None


@dataclass(slots=True)
class _Text:
    # Parents can count a child's JSON or path lines without serializing
    # or copying either candidate again.
    size: int
    parts: str | list[_Text]


def _measured(text: str) -> _Text:
    return _Text(len(text.encode("utf-8")), text)


def _join(parts: list[_Text], separator: _Text | None = None) -> _Text:
    size = sum(part.size for part in parts)
    if separator is None or len(parts) < 2:
        return _Text(size, parts)
    joined = [parts[0]]
    for part in parts[1:]:
        joined.extend((separator, part))
    return _Text(size + (len(parts) - 1) * separator.size, joined)


def _render(text: _Text) -> str:
    if isinstance(text.parts, str):
        return text.parts
    strings: list[str] = []

    def append(part: _Text) -> None:
        if isinstance(part.parts, str):
            strings.append(part.parts)
        else:
            for child in part.parts:
                append(child)

    append(text)
    return "".join(strings)


_SLASH = _measured("/")
_LF = _measured("\n")
_COMMA = _measured(",")
_OPEN_OBJECT = _measured("{")
_CLOSE_OBJECT = _measured("}")
_VALUE_PREFIX = _measured(": ")


def _entry_form(name: _Text, value: JsonValue, compact: _Text, named: bool,
                write_cell: Callable[[JsonValue], str]) -> _Text:
    if isinstance(value, list):
        body = _list_table(value, named, compact.size, write_cell)
        if body is not None:
            return _join([name, _measured(f"[{len(value)}]:\n{body}")])
    scalar = _measured(_unicode(value)) if isinstance(value, str) and _bare(value) else compact
    fallback = _join([name, _VALUE_PREFIX, scalar])
    if not isinstance(value, dict):
        return fallback
    keys = _keys(value)
    rows = [value[key] for key in keys]
    if len(keys) < 2 or not all(_safe_id(key) and not _ENTRY.fullmatch(key) for key in keys) or not all(isinstance(row, dict) for row in rows):
        return fallback
    body = _table(cast(list[JsonObject], rows), True, named, keys, fallback.size, write_cell)
    if body is None:
        return fallback
    keyed = _join([name, _measured(f"{{{len(keys)}}}:\n{body}")])
    return keyed if keyed.size < fallback.size else fallback


def _plan_entry(name: _Text, value: JsonValue, remaining: int, compact: dict[int, _Text],
                write_cell: Callable[[JsonValue], str]) -> tuple[_Text, _Text, _Text]:
    path = None
    if remaining > 0 and isinstance(value, dict) and value:
        fields: list[_Text] = []
        entries: list[_Text] = []
        for key in _keys(value):
            quoted = _quote(key)
            child_name = _join([name, _SLASH, _measured(key if _KEY.fullmatch(key) else quoted)])
            child_json, _, child_entry = _plan_entry(child_name, value[key], remaining - 1, compact, write_cell)
            fields.append(_join([_measured(quoted + ":"), child_json]))
            entries.append(child_entry)
        json_text = _join([_OPEN_OBJECT, _join(fields, _COMMA), _CLOSE_OBJECT])
        path = _join(entries, _LF)
    else:
        cached = compact.get(id(value)) if isinstance(value, (dict, list)) else None
        json_text = cached if cached is not None else _measured(_json(value))
    if isinstance(value, (dict, list)):
        compact[id(value)] = json_text
    base = _entry_form(name, value, json_text, True, write_cell)
    return json_text, base, path if path is not None and path.size < base.size else base


def encode(value: JsonInputRoot, *, format: FormatVersion = "1.2") -> str:
    """Encode a JSON object or list. Invalid data raises TypeError.

    Format "1.2" (default) adds path entries. Format "1.1" uses named
    cells. Format "1.0" uses empty cells. All three versions decode.

    Numbers use JavaScript binary64 semantics. Integers must be exactly
    representable as binary64; negative zero and non-finite values fail.
    """
    if not isinstance(format, str) or format not in ("1.0", "1.1", "1.2"):
        raise TypeError('format must be "1.0", "1.1" or "1.2".')
    named = format != "1.0"
    _validate(value)
    # Validation restricts the read-only input interface to JSON's concrete
    # built-in containers. The decoder always returns those concrete types.
    root = cast(JsonRoot, value)
    if isinstance(root, list):
        table = _list_table(root, named)
        return f"[{len(root)}]\n{table}" if table is not None else _json(root)
    if not isinstance(root, dict):
        raise TypeError("Terset requires a root object or array.")
    if not root:
        return "{}"
    if format != "1.2":
        return "\n".join(_render(_entry_form(_measured(_key(key)), root[key], _measured(_json(root[key])), named, _cell))
                         for key in _keys(root))
    compact: dict[int, _Text] = {}

    def write_cell(child: JsonValue) -> str:
        if not isinstance(child, (dict, list)):
            return _cell(child)
        json_text = compact.get(id(child))
        if json_text is None:
            json_text = _measured(_json(child))
            compact[id(child)] = json_text
        text = _render(json_text)
        json_text.parts = text
        return text

    plans = [_plan_entry(_measured(_key(key)), root[key], _MAX_ENTRY_SEGMENTS - 1, compact, write_cell)
             for key in _keys(root)]
    # Both candidates use the same line breaks between root entries.
    savings = sum(base.size - entry.size for _, base, entry in plans)
    use_paths = savings >= _MIN_PATH_SAVINGS_BYTES
    return "\n".join(_render(entry if use_paths else base) for _, base, entry in plans)


def _pairs(pairs: list[tuple[str, JsonValue]]) -> JsonObject:
    result: JsonObject = {}
    for key, value in pairs:
        _set(result, key, value)
    return result


def _parse_integer(text: str) -> int | float:
    if text == "-0":
        return -0.0
    # All integers through 2**53 are exactly representable by binary64.
    # Longer tokens still follow JavaScript's binary64 rounding.
    if len(text.lstrip("-")) <= 16:
        value = int(text)
        if abs(value) <= 2**53:
            return value
    return float(text)


def _reject_constant(text: str) -> JsonValue:
    raise ValueError("Invalid JSON constant: " + text)


def _parse(text: str, *, path_entry: bool = False) -> JsonValue:
    try:
        # Like JavaScript, let the whole-document comparison reject a
        # duplicate JSON key inside a path entry as noncanonical.
        value = cast(JsonValue, json.loads(text, parse_int=_parse_integer, parse_float=float,
                                        parse_constant=_reject_constant, object_pairs_hook=None if path_entry else _pairs))
        _validate(value)
    except (ValueError, TypeError, RecursionError) as error:
        raise ValueError("Invalid JSON cell: " + str(error)) from error
    return value


def _read_cell(text: str, *, path_entry: bool = False) -> JsonValue:
    if not text:
        raise ValueError("Empty values are allowed only as absent table cells.")
    if text[0] in '\"{[' or text in {"true", "false", "null"} or _NUMBER.fullmatch(text):
        return _parse(text, path_entry=path_entry)
    if not _bare(text):
        raise ValueError("Invalid bare text.")
    return text


def _read_key(text: str) -> str:
    if _KEY.fullmatch(text):
        return text
    if not text.startswith('"'):
        raise ValueError("Invalid field name.")
    value = _parse(text)
    if not isinstance(value, str):
        raise ValueError("Invalid field name.")
    return value


def _set(target: JsonObject, key: str, value: JsonValue) -> None:
    if key in target:
        raise ValueError("Duplicate key " + key + ".")
    target[key] = value


def _set_path(target: JsonObject, path: list[str], value: JsonValue) -> None:
    if not path:
        raise ValueError("Empty column path.")
    for index, key in enumerate(path):
        if index == len(path) - 1:
            _set(target, key, value)
            return
        if key not in target:
            _set(target, key, {})
        nested = target[key]
        if not isinstance(nested, dict):
            raise ValueError("Conflicting column paths.")
        target = nested


def _set_entry_path(target: JsonObject, path: list[str], value: JsonValue, parents: set[int]) -> None:
    for key in path[:-1]:
        if key not in target:
            child: JsonObject = {}
            _set(target, key, child)
            parents.add(id(child))
        nested = target[key]
        if not isinstance(nested, dict) or id(nested) not in parents:
            raise ValueError("Duplicate or conflicting entry path.")
        target = nested
    key = path[-1]
    if key in target and (len(path) > 1 or id(target[key]) in parents):
        raise ValueError("Duplicate or conflicting entry path.")
    _set(target, key, value)


def _quoted_end(text: str, start: int = 0) -> int:
    """Index just past the closing quote of a leading quoted key, or -1."""
    end = start + 1
    while end < len(text) and text[end] != '"':
        if text[end] == "\\":
            end += 1
            if end == len(text) or text[end] in "\n\r  ":
                return -1
        end += 1
    return -1 if end == len(text) else end + 1


def _read_entry(text: str) -> tuple[list[str], re.Match[str]]:
    keys: list[str] = []
    start = 0
    while True:
        if text[start:start + 1] == '"':
            end = _quoted_end(text, start)
        else:
            match = _ENTRY_KEY.match(text, start)
            end = match.end() if match is not None else -1
        if end <= start:
            raise ValueError("Expected root field.")
        keys.append(text[start:end])
        if text[end:end + 1] != "/":
            tail = _ENTRY_TAIL.match(text, end)
            if tail is None:
                raise ValueError("Expected root field.")
            return [_read_key(key) for key in keys], tail
        if len(keys) == _MAX_ENTRY_SEGMENTS:
            raise ValueError("Maximum entry path is 8 segments.")
        start = end + 1


def _note_cell(raw: str, features: set[str] | None) -> None:
    if features is None:
        return
    if not raw:
        features.add("empty")
    elif raw.startswith('"'):
        features.add("quoted")
    elif raw.startswith(("{", "[")):
        features.add("json")


def _read_named_cell(text: str) -> tuple[str, str]:
    """Split a name=value cell. The name is one field: bare, or a JSON string."""
    if text.startswith('"'):
        end = _quoted_end(text)
        if end < 0:
            raise ValueError("Invalid field name.")
    else:
        end = text.find("=")
        if end < 0:
            raise ValueError("Expected name=value cell.")
        if not _segment(text[:end]):
            raise ValueError("Invalid field name.")
    if text[end:end + 1] != "=":
        raise ValueError("Expected name=value cell.")
    return _read_key(text[:end]), text[end + 1:]


def _read_table(lines: list[str], start: int, count: int, keyed: bool, row_depth: int, features: set[str] | None = None) -> JsonRoot:
    if start >= len(lines):
        raise ValueError("Missing table header.")
    fields = lines[start].split("\t")
    if keyed and fields.pop(0) != "@key":
        raise ValueError("Missing @key marker.")
    named = bool(fields) and fields[-1] == _NAMED_MARKER
    if named:
        fields.pop()
    if not fields and not named:
        raise ValueError("Missing table fields.")
    paths: list[list[str]] = []
    for field in fields:
        path = [_read_key(field)] if field.startswith('"') else field.split(".", _MAX_HEADER_SEGMENTS)
        if len(path) > _MAX_HEADER_SEGMENTS:
            raise ValueError("Maximum header path is 8 segments.")
        if row_depth + len(path) > _MAX_JSON_DEPTH:
            raise ValueError(_DEPTH_ERROR)
        paths.append(path)
    if features is not None:
        features.add("table")
        if named:
            features.add("named")
        if keyed:
            features.add("keyed")
        if any(len(path) > 1 for path in paths):
            features.add("nested")
    trie: _HeaderTrie = {}
    for index, path in enumerate(paths):
        if not fields[index].startswith('"') and not all(_segment(part) for part in path):
            raise ValueError("Invalid header.")
        node = trie
        for position, segment in enumerate(path):
            if position == len(path) - 1:
                if segment in node:
                    raise ValueError("Duplicate or conflicting header.")
                node[segment] = None
            elif segment in node:
                child = node[segment]
                if child is None:
                    raise ValueError("Duplicate or conflicting header.")
                node = child
            else:
                child = {}
                node[segment] = child
                node = child
    ids = not keyed and bool(fields) and fields[0] == "id"
    if ids and features is not None:
        features.add("id")
    result: JsonRoot = {} if keyed else []
    path_entry = row_depth > 2
    for index in range(count):
        if start + 1 + index >= len(lines):
            raise ValueError("Row count mismatch.")
        line = lines[start + 1 + index]
        # A named list row with no positional columns and no fields is empty.
        cells = [] if named and line == "" else line.split("\t")
        expected = len(fields) + int(keyed)
        if (len(cells) < expected) if named else (len(cells) != expected):
            raise ValueError("Wrong cell count.")
        entry_key = cells.pop(0) if keyed else None
        row: JsonObject = {}
        for column, (path, raw) in enumerate(zip(paths, cells)):
            if column == 0 and ids and not raw:
                raise ValueError("Missing string id.")
            if named and not raw:
                raise ValueError("Empty values are allowed only as absent table cells.")
            if not (column == 0 and ids):
                _note_cell(raw, features)
            if raw:
                _set_path(row, path, raw if column == 0 and ids else _read_cell(raw, path_entry=path_entry))
        for raw_cell in cells[len(paths):]:
            key, raw = _read_named_cell(raw_cell)
            _note_cell(raw, features)
            _set(row, key, _read_cell(raw, path_entry=path_entry))
        if isinstance(result, list):
            result.append(row)
        else:
            if entry_key is None or not _safe_id(entry_key) or _ENTRY.fullmatch(entry_key):
                raise ValueError("Invalid entry key.")
            _set(result, entry_key, row)
    return result


def _read_count(text: str) -> int:
    # Bound the digit length before int conversion, including adversarial input.
    if len(text) > 16 or not text.isascii() or not text.isdigit():
        raise ValueError("Invalid table count.")
    count = int(text)
    if count < 2 or count > 9007199254740991:
        raise ValueError("Invalid table count.")
    return count


def decode(text: str) -> JsonRoot:
    """Decode canonical text. Invalid text raises ValueError.

    Integer tokens within [-2**53, 2**53] become ints. Other numbers are floats.
    Wrong argument types raise TypeError.
    """
    return _read_document(text)


def _read_document(text: str, features: set[str] | None = None) -> JsonRoot:
    if not isinstance(text, str):
        raise TypeError("Expected Terset text.")
    lines = text.split("\n")
    root_count = re.fullmatch(r"\[([0-9]+)\]", lines[0]) if len(lines) > 1 else None
    result: JsonRoot
    has_paths = False
    if root_count:
        count = _read_count(root_count[1])
        result = _read_table(lines, 1, count, False, 1, features)
        if len(lines) != count + 2:
            raise ValueError("Row count mismatch.")
    elif text == "{}":
        result = {}
    elif text.startswith("["):
        parsed = _parse(text)
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array.")
        result = parsed
    else:
        result = {}
        parents: set[int] = set()
        index = 0
        while index < len(lines):
            path, tail = _read_entry(lines[index])
            index += 1
            if len(path) > 1:
                has_paths = True
                if features is not None:
                    features.add("path")
            list_count, keyed_count, rest = tail.groups()
            count_text = list_count if list_count is not None else keyed_count
            entry: JsonValue
            if count_text is not None:
                if rest != "":
                    raise ValueError("Expected a table header.")
                count = _read_count(count_text)
                entry = _read_table(lines, index, count, keyed_count is not None, len(path) + 1, features)
                index += count + 1
            else:
                if not rest.startswith(" "):
                    raise ValueError("Expected scalar field.")
                if features is not None and rest[1:].startswith('"'):
                    features.add("quoted")
                entry = _read_cell(rest[1:], path_entry=len(path) > 1)
            _set_entry_path(result, path, entry, parents)
    # Whole-document comparison also detects interleaved paths and versions.
    try:
        canonical = encode(result) == text if has_paths else (
            encode(result, format="1.1") == text or encode(result, format="1.0") == text
        )
    except (TypeError, RecursionError) as error:
        raise ValueError(str(error)) from error
    if not canonical:
        raise ValueError("Noncanonical Terset text.")
    return result
