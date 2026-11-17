"""The Terset format, with JavaScript binary64 number semantics."""

from __future__ import annotations

import heapq
import json
import math
import re
from collections.abc import Mapping, Sequence
from typing import TypeAlias, cast

JsonValue: TypeAlias = "None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]"
JsonObject: TypeAlias = dict[str, JsonValue]
JsonRoot: TypeAlias = "JsonObject | list[JsonValue]"
JsonInputValue: TypeAlias = "None | bool | int | float | str | Sequence[JsonInputValue] | Mapping[str, JsonInputValue]"
JsonInputRoot: TypeAlias = "Mapping[str, JsonInputValue] | Sequence[JsonInputValue]"

_MAX_JSON_DEPTH = 500
_MAX_HEADER_SEGMENTS = 8
_DEPTH_ERROR = "Maximum JSON depth is 500."
_HeaderTrie: TypeAlias = "dict[str, _HeaderTrie | None]"

RULES = "Tables use tab-separated headers and rows. Empty cells mean absent. JSON quotes distinguish numeric, boolean or null text from scalars. Nested cells use JSON. A leading bare id header marks string IDs. name{N} has N entries; the @key column holds each entry's key and is not a field. Header a.b is field b in object a."

_SENTENCES = RULES.split(". ")
_BASE_RULES = ". ".join(_SENTENCES[:5]) + "."


def rules_for(text: str) -> str:
    """Return the rules needed by canonical text, with decode's validation."""
    features: set[str] = set()
    _read_document(text, features)
    sentences = [_BASE_RULES]
    if "keyed" in features:
        sentences.append(_SENTENCES[5] + ".")
    if "nested" in features:
        sentences.append(_SENTENCES[6])
    return " ".join(sentences)

_KEY = re.compile(r"[A-Za-z_$][A-Za-z0-9_$.-]*\Z")
_NUMBER = re.compile(r"[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?\Z")
_ENTRY = re.compile(r'^("(?:[^"\\]|\\.)*"|[A-Za-z_$][A-Za-z0-9_$.-]*)(?:\[([0-9]+)\]|\{([0-9]+)\})?:([\s\S]*)\Z')
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


def _table(value: list[JsonObject], keyed: bool, entry_keys: list[str] | None = None, max_bytes: int | float = math.inf) -> str | None:
    if len(value) < 2:
        return None
    rows = [{_unicode(key): child for key, child in row.items()} for row in value]
    fields = _header(rows)
    if fields is None:
        return None
    if len(rows) * (len(fields) - 1) >= max_bytes:
        return None
    columns: list[_Column] = []
    for field in fields:
        columns.extend(_flatten([field], [row.get(field, _MISSING) for row in rows]))
    ids = not keyed and len(columns[0][0]) == 1 and fields[0] == "id" and all(
        _keys(row)[:1] == ["id"] and isinstance(row.get("id"), str)
        and _safe_id(cast(str, row["id"]))
        and (len(columns) != 1 or not _ENTRY.fullmatch(cast(str, row["id"]))) for row in rows
    )
    headings = []
    for index, (path, _) in enumerate(columns):
        field = path[0]
        headings.append(".".join(path) if len(path) > 1 else _quote(field)
                        if "." in field or (index == 0 and field == "id" and not ids and not keyed) else _key(field))
    if keyed:
        headings.insert(0, "@key")
    lines = ["\t".join(headings)]
    for row_index in range(len(rows)):
        cells: list[str] = []
        for index, (_, values) in enumerate(columns):
            entry = values[row_index]
            if entry is _MISSING:
                cells.append("")
            elif index == 0 and ids:
                cells.append(_unicode(cast(str, entry)))
            elif not keyed and len(columns) == 1 and isinstance(entry, str) and _ENTRY.fullmatch(entry):
                cells.append(_quote(entry))
            else:
                cells.append(_cell(cast(JsonValue, entry)))
        if keyed:
            if entry_keys is None:
                raise TypeError("Missing entry keys.")
            cells.insert(0, _unicode(entry_keys[row_index]))
        lines.append("\t".join(cells))
    return "\n".join(lines)


def _list_table(value: JsonValue) -> str | None:
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        return None
    size = len(_json(value).encode("utf-8"))
    text = _table(cast(list[JsonObject], value), False, max_bytes=size)
    return text if text is not None and len(text.encode("utf-8")) < size else None


def encode(value: JsonInputRoot) -> str:
    """Encode a JSON object or list. Invalid data raises TypeError.

    Numbers use JavaScript binary64 semantics. Integers must be exactly
    representable as binary64; negative zero and non-finite values fail.
    """
    _validate(value)
    # Validation restricts the read-only input interface to JSON's concrete
    # built-in containers. The decoder always returns those concrete types.
    root = cast(JsonRoot, value)
    if isinstance(root, list):
        table = _list_table(root)
        return f"[{len(root)}]\n{table}" if table is not None else _json(root)
    if not isinstance(root, dict):
        raise TypeError("Terset requires a root object or array.")
    if not root:
        return "{}"
    lines = []
    for key in _keys(root):
        entry = root[key]
        name = _key(key)
        table = _list_table(entry)
        if table is not None and isinstance(entry, list):
            lines.append(f"{name}[{len(entry)}]:\n{table}")
            continue
        fallback = name + ": " + _cell(entry)
        if isinstance(entry, dict):
            keys = _keys(entry)
            rows = [entry[entry_key] for entry_key in keys]
            if len(keys) >= 2 and all(_safe_id(entry_key) and not _ENTRY.fullmatch(entry_key) for entry_key in keys) and all(isinstance(row, dict) for row in rows):
                body = _table(cast(list[JsonObject], rows), True, keys, len(fallback.encode("utf-8")))
                if body is not None:
                    candidate = f"{name}{{{len(keys)}}}:\n{body}"
                    if len(candidate.encode("utf-8")) < len(fallback.encode("utf-8")):
                        lines.append(candidate)
                        continue
        lines.append(fallback)
    return "\n".join(lines)


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


def _parse(text: str) -> JsonValue:
    try:
        value = cast(JsonValue, json.loads(text, parse_int=_parse_integer, parse_float=float, parse_constant=_reject_constant, object_pairs_hook=_pairs))
        _validate(value)
    except (ValueError, TypeError, RecursionError) as error:
        raise ValueError("Invalid JSON cell: " + str(error)) from error
    return value


def _read_cell(text: str) -> JsonValue:
    if not text:
        raise ValueError("Empty values are allowed only as absent table cells.")
    if text[0] in '\"{[' or text in {"true", "false", "null"} or _NUMBER.fullmatch(text):
        return _parse(text)
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


def _read_table(lines: list[str], start: int, count: int, keyed: bool, row_depth: int, features: set[str] | None = None) -> JsonRoot:
    if start >= len(lines):
        raise ValueError("Missing table header.")
    fields = lines[start].split("\t")
    if keyed and fields.pop(0) != "@key":
        raise ValueError("Missing @key marker.")
    if not fields:
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
    ids = not keyed and fields[0] == "id"
    result: JsonRoot = {} if keyed else []
    for index in range(count):
        if start + 1 + index >= len(lines):
            raise ValueError("Row count mismatch.")
        line = lines[start + 1 + index]
        cells = line.split("\t")
        if len(cells) != len(fields) + int(keyed):
            raise ValueError("Wrong cell count.")
        entry_key = cells.pop(0) if keyed else None
        row: JsonObject = {}
        for column, (path, raw) in enumerate(zip(paths, cells)):
            if column == 0 and ids and not raw:
                raise ValueError("Missing string id.")
            if raw:
                _set_path(row, path, raw if column == 0 and ids else _read_cell(raw))
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
        index = 0
        while index < len(lines):
            match = _ENTRY.fullmatch(lines[index])
            index += 1
            if match is None:
                raise ValueError("Expected root field.")
            key = _read_key(match[1])
            rest = match[4]
            if match[2] is not None or match[3] is not None:
                if rest != "":
                    raise ValueError("Expected a table header.")
                count = _read_count(match[2] if match[2] is not None else match[3])
                _set(result, key, _read_table(lines, index, count, match[3] is not None, 2, features))
                index += count + 1
            else:
                if not rest.startswith(" "):
                    raise ValueError("Expected scalar field.")
                _set(result, key, _read_cell(rest[1:]))
    try:
        canonical = encode(result)
    except (TypeError, RecursionError) as error:
        raise ValueError(str(error)) from error
    if canonical != text:
        raise ValueError("Noncanonical Terset text.")
    return result
