"""Conformance and rejection tests, using only the standard library."""

import json
import math
from pathlib import Path
import re
import random
import sys
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from terset import RULES, decode, encode  # noqa: E402


def fixture_integer(text: str) -> int | float:
    value = int(text)
    # Keep integral Python inputs wherever binary64 represents them exactly.
    # Other decimal spellings in the fixture describe already-rounded JS values.
    return value if int(float(value)) == value else float(text)


def expand_case(case):
    if "recipe" not in case:
        return case["input"], case["encoded"]
    recipe = case["recipe"]
    if recipe["kind"] == "repeat-text":
        text = recipe["text"] * int(recipe["count"])
        items = [{"id": "1", "name": text, "summary": text}]
        return {"items": items, "text": text}, "items: " + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + "\ntext: " + text
    if recipe["kind"] == "rows":
        rows = [{"id": str(index + 1), "name": recipe["prefix"] + str(index) + recipe["suffix"]} for index in range(int(recipe["count"]))]
        return {"items": rows}, f"items[{len(rows)}]:\nid\tname\n" + "\n".join(row["id"] + "\t" + row["name"] for row in rows)
    if recipe["kind"] == "depth":
        depth = int(recipe["depth"])
        value = recipe["leaf"]
        for _ in range(depth):
            value = {"next": value}
        return {"nested": value}, 'nested: ' + '{"next":' * depth + json.dumps(recipe["leaf"], ensure_ascii=False) + "}" * depth
    raise AssertionError("Unknown shared recipe")


class ConformanceTests(unittest.TestCase):
    def test_counted_tables(self):
        value = {"people": [{"name": "Ada"}, {"name": "Lin"}]}
        text = "people[2]:\nname\nAda\nLin"
        self.assertEqual(encode(value), text)
        self.assertEqual(decode(text), value)
        with self.assertRaises(ValueError):
            decode("people[3]:\nname\nAda\nLin")

    def test_typing_smoke_runs(self):
        import typing_smoke

        self.assertEqual(typing_smoke.decoded, typing_smoke.data)
        self.assertEqual(decode(typing_smoke.nested_text), typing_smoke.nested)

    def test_shared_cases(self):
        # Fixture numbers describe JavaScript values. Parse them as binary64,
        # including integral decimal tokens outside Python's exact-int range.
        cases = json.loads((PACKAGE.parent / "terset/tests/cases.json").read_text(encoding="utf-8"), parse_int=float)
        for case in cases:
            with self.subTest(case=case["name"]):
                value, encoded = expand_case(case)
                self.assertEqual(encode(value), encoded)
                self.assertEqual(decode(encoded), value)
                self.assertEqual(encode(decode(encoded)), encoded)

    def test_shared_integer_inputs(self):
        cases = json.loads((PACKAGE.parent / "terset/tests/cases.json").read_text(encoding="utf-8"), parse_int=fixture_integer)
        boundary = next(case for case in cases if case["name"] == "number formatting boundaries")
        self.assertIs(type(boundary["input"]["values"][0]), int)
        self.assertIs(type(boundary["input"]["values"][3]), int)
        for case in cases:
            with self.subTest(case=case["name"]):
                value, encoded = expand_case(case)
                self.assertEqual(encode(value), encoded)
                self.assertEqual(decode(encoded), value)

    def test_equal_size_fallback(self):
        rows = [{"a": 1}, {"b": 1}, {"c": 1}, {"d": 1}, {"e": 1}, {}]
        fields = list("abcde")
        candidate = "\t".join(fields) + "\n" + "\n".join("\t".join(str(row[key]) if key in row else "" for key in fields) for row in rows)
        compact = json.dumps(rows, separators=(",", ":"))
        self.assertEqual(len(candidate.encode("utf-8")), len(compact.encode("utf-8")))
        self.assertEqual(encode(rows), compact)

    def test_rules_match_typescript(self):
        source = (PACKAGE.parent / "terset/src/terset.ts").read_text(encoding="utf-8")
        match = re.search(r'export const RULES =(".*");', source)
        self.assertIsNotNone(match)
        self.assertEqual(RULES, json.loads(match[1]))

    def test_types_and_number_rendering(self):
        self.assertEqual(encode({"a": True, "b": False, "c": None, "d": 1.0}),
                         "a: true\nb: false\nc: null\nd: 1")
        self.assertEqual(encode({"values": [1e-6, 1e-7, 1e20, 1e21]}),
                         "values: [0.000001,1e-7,100000000000000000000,1e+21]")
        self.assertEqual(encode({"n": 1000000000000000128}), "n: 1000000000000000100")

    def test_decoded_number_types(self):
        result = decode('values: [1,-1,0,9007199254740992,-9007199254740992,100000000000000000000,0.5,1e-7,1e+21]')
        self.assertEqual([type(value) for value in result["values"]], [int] * 5 + [float] * 4)
        self.assertEqual(json.dumps(decode("value: 1")), '{"value": 1}')
        rows = decode('[2]\nvalue\n1\n-2')
        self.assertIs(type(rows[0]["value"]), int)
        self.assertEqual(decode(encode({"value": 1.0})), {"value": 1.0})

    def test_key_order(self):
        value = {"10": 10, "2": 2, "z": {"b": 1, "a": 2}, "01": 3}
        self.assertEqual(encode(value), '"2": 2\n"10": 10\nz: {"b":1,"a":2}\n"01": 3')
        self.assertEqual(list(decode(encode(value))), ["2", "10", "z", "01"])
        self.assertEqual(list(decode(encode(value))["z"]), ["b", "a"])

    def test_header_fits_every_row_order(self):
        skipped = [{"key": "a", "text": "A", "maxLength": 30}, {"key": "b", "text": "B", "description": "D", "maxLength": 61}]
        self.assertEqual(encode(skipped), "[2]\nkey\ttext\tdescription\tmaxLength\na\tA\t\t30\nb\tB\tD\t61")
        self.assertEqual(encode([{"a": 1, "b": 2}, {"c": 3, "a": 4}]), "[2]\nc\ta\tb\n\t1\t2\n3\t4\t")
        self.assertEqual(encode([{"a": 1, "c": 2}, {"b": 3, "c": 4}]), "[2]\na\tb\tc\n1\t\t2\n\t3\t4")
        self.assertEqual(encode({"people": {"ada": {"a": 1, "c": 2}, "lin": {"b": 3, "c": 4}}}), "people{2}:\n@key\ta\tb\tc\nada\t1\t\t2\nlin\t\t3\t4")
        for value in (skipped, [{"a": 1, "b": 2}, {"c": 3, "a": 4}]):
            self.assertEqual(json.dumps(decode(encode(value))), json.dumps(value))
        conflict = [{"a": 1, "b": 2}, {"b": 3, "a": 4}]
        self.assertEqual(encode(conflict), json.dumps(conflict, separators=(",", ":")))

    def test_shared_references_are_not_cycles(self):
        child = {"a": 1}
        self.assertEqual(decode(encode({"left": child, "right": child})), {"left": child, "right": child})

    def test_explicit_utf16_pairs(self):
        self.assertEqual(encode({"text": "\ud83d\ude00"}), "text: 😀")
        self.assertEqual(encode([{ "id": "\ud83d\ude00" }, { "id": "ok" }]), "[2]\nid\n😀\nok")
        self.assertEqual(encode({"\ud83d\ude00": ["\ud83d\ude00"]}), '"😀": ["😀"]')
        rows = [{"😀": "one"}, {"\ud83d\ude00": "two"}]
        self.assertEqual(encode(rows), '[2]\n"😀"\none\ntwo')
        with self.assertRaises(TypeError):
            encode({"😀": 1, "\ud83d\ude00": 2})

    def test_depth_boundary(self):
        allowed = "[" * 500 + "]" * 500
        self.assertEqual(encode(decode("x: " + allowed)), "x: " + allowed)
        for text in ["x: " + "[" * 501 + "]" * 501, "[" * 502 + "]" * 502]:
            with self.subTest(text_length=len(text)), self.assertRaisesRegex(ValueError, "depth"):
                decode(text)
        nested = []
        for _ in range(501):
            nested = [nested]
        with self.assertRaisesRegex(TypeError, "depth"):
            encode(nested)

    def test_long_digit_runs_and_sparse_rows(self):
        digits = "9" * 200_000
        for text in [digits + "x", "-" + digits + "x", digits + "." + digits + "x", "1e" + digits + "x"]:
            self.assertEqual(decode("x: " + text), {"x": text})
        wide = [{"field_" + str(index): index} for index in range(20_000)]
        text = encode(wide)
        self.assertTrue(text.startswith("["))
        self.assertEqual(decode(text), wide)

    def test_noncanonical_and_malformed_text(self):
        invalid = [
            "", "x: 1\n", "x: 01", "x: +5", "x: undefined", "x: 1\nx: 2",
            'x: {"a":1,"a":2}', 'x: { "a":1}', "rows:\nid\tx\n1\ta\textra",
            "rows:\nid\tid\n1\t2", "rows:\nid\tx", "rows:\nid\tx\n\ta",
            "7", "true", "null", '"text"', "text", "value\ntrue",
            "a\ta\n1\t2\n3\t4", '"id"\n01\n2', "x\n-0\n1",
            "a\tb\n1\t2\textra\n3\t4", "rows:\nvalue\nnext: end\nx: 1",
            "x: -0", "x: NaN", "x: Infinity", "x: 1e999", "[]\n",
            'x: {"a":{"b":1,"b":2}}', 'x: "\\ud83d\\ude00"',
        ]
        for text in invalid:
            with self.subTest(text=text), self.assertRaises(ValueError):
                decode(text)
        self.assertEqual(decode("x: (()=>7)()"), {"x": "(()=>7)()"})

    def test_shared_rejections(self):
        texts = json.loads((PACKAGE.parent / "terset/tests/rejections.json").read_text(encoding="utf-8"))
        for text in texts:
            with self.subTest(text=text), self.assertRaises(ValueError):
                decode(text)

    def test_seeded_keyed_and_nested_roots(self):
        rng = random.Random(0x5EED1234)
        texts = ["Ada", "", "007", "true", "name[2]:", "name{2}:", " edge ", "\ud800", "😀", "\t", "\n"]
        for index in range(2500):
            rows = [{"id": rng.choice(texts), "a.b": rng.randrange(100),
                     "address": {"city": rng.choice(texts), "stats": {"n": rng.randrange(100)}}}
                    for _ in range(rng.randrange(2, 8))]
            if index % 5 == 0:
                rows[-1].pop("address")
            if index % 7 == 0:
                rows[-1]["address"] = {"stats": {"n": 1}, "city": "Rome"}
            value = rows if index % 2 else {"rows": {f"entry{i}": row for i, row in enumerate(rows)}}
            with self.subTest(case=index):
                text = encode(value)
                self.assertEqual(decode(text), value)
                self.assertEqual(encode(decode(text)), text)

    def test_rejected_text_always_raises_value_error(self):
        for text in ["1e999", "-0", "[NaN]", "Infinity\r", "[Infinity]", "[-Infinity]", "x: -0", "x: 1e999"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                decode(text)

    def test_invalid_python_values(self):
        class CustomDict(dict):
            pass

        cyclic = {}
        cyclic["self"] = cyclic
        cyclic_list = []
        cyclic_list.append(cyclic_list)
        bad = [
            "text", 7, True, None, {"a": lambda: 1}, {"a": object()}, {"a": set()},
            {"a": (1, 2)}, {1: "key"}, {"a": complex(1)}, {"a": math.nan},
            {"a": math.inf}, {"a": -math.inf}, {"a": -0.0}, {"a": 10**400},
            {"a": 2**53 + 1}, CustomDict(a=1), cyclic, cyclic_list,
        ]
        for index, value in enumerate(bad):
            with self.subTest(index=index), self.assertRaises(TypeError):
                encode(value)
        with self.assertRaises(TypeError):
            decode(7)


if __name__ == "__main__":
    unittest.main()
