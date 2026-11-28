"""Format 1.2 path entries, using the shared 1.2 conformance suite."""

import json
from pathlib import Path
import sys
import time
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
SUITE = PACKAGE.parents[1] / "conformance" / "1.2"
sys.path.insert(0, str(PACKAGE / "src"))

from terset import decode, encode, rules_for  # noqa: E402


def key_order(value):
    if isinstance(value, dict):
        # Fixtures use the same array-index ordering as JavaScript.
        indices = [key for key in value if len(key) <= 10 and key.isascii() and key.isdigit()
                   and str(int(key)) == key and int(key) < 4294967295]
        return {key: key_order(value[key]) for key in sorted(indices, key=int) + [key for key in value if key not in indices]}
    if isinstance(value, list):
        return [key_order(child) for child in value]
    return value


class FormatOneTwoTests(unittest.TestCase):
    def assert_value_and_key_order(self, actual, expected):
        self.assertEqual(actual, expected)
        if isinstance(expected, dict):
            self.assertEqual(list(actual), list(expected))
            for key in expected:
                self.assert_value_and_key_order(actual[key], expected[key])
        if isinstance(expected, list):
            for child, expected_child in zip(actual, expected):
                self.assert_value_and_key_order(child, expected_child)

    def test_shared_cases(self):
        for case in json.loads((SUITE / "cases.json").read_text(encoding="utf-8"), parse_int=float):
            with self.subTest(case=case["name"]):
                value, text = case["input"], case["encoded"]
                self.assertEqual(encode(value), text)
                self.assertEqual(encode(value, format="1.2"), text)
                decoded = decode(text)
                self.assert_value_and_key_order(decoded, key_order(value))
                self.assertEqual(encode(decoded), text)
                legacy = encode(value, format="1.1")
                self.assertLessEqual(len(text.encode("utf-8")), len(legacy.encode("utf-8")))
                self.assert_value_and_key_order(decode(legacy), decoded)

    def test_shared_rejections(self):
        for text in json.loads((SUITE / "rejections.json").read_text(encoding="utf-8")):
            with self.subTest(text=text):
                with self.assertRaises(ValueError) as read:
                    decode(text)
                with self.assertRaises(ValueError) as rules:
                    rules_for(text)
                self.assertEqual(str(read.exception), str(rules.exception))

    def test_path_error_words(self):
        cases = [
            ("a/b: 1\na/b: 2", "Duplicate or conflicting entry path."),
            ("a: {}\na/b: 1", "Duplicate or conflicting entry path."),
            ("a/b: 1\na: {}", "Duplicate or conflicting entry path."),
            ("a/b/c/d/e/f/g/h/i: 1", "Maximum entry path is 8 segments."),
            ("a/b: 1", "Noncanonical Terset text."),
            ("a/b: 1\nz: 0\na/c: 2", "Noncanonical Terset text."),
            ('a/x: {"v":1,"v":2}', "Noncanonical Terset text."),
        ]
        for text, message in cases:
            with self.subTest(text=text):
                with self.assertRaises(ValueError) as error:
                    decode(text)
                self.assertEqual(str(error.exception), message)

    def test_depth_limit_under_path_table(self):
        prefix = "a/b/c/d/e/f/g/h[44]:\nv\n"
        rows = "\n2" * 43

        def cell(levels):
            return '{"next":' * levels + "1" + "}" * levels

        decode(prefix + cell(490) + rows)
        with self.assertRaises(ValueError) as error:
            decode(prefix + cell(491) + rows)
        self.assertEqual(str(error.exception), "Maximum JSON depth is 500.")

    def test_wide_values_at_the_end_of_deep_object_paths(self):
        wide = {str(index): index for index in range(20_000)}
        compact = '{"next":' * 491 + json.dumps(wide, separators=(",", ":")) + "}" * 491
        value = {"a": {"b": {"c": {"d": {"e": {"f": {"g": {"h": json.loads(compact)}}}}}}}}
        legacy = encode(value, format="1.1")
        started = time.perf_counter()
        self.assertEqual(encode(value), legacy)
        self.assertLess(time.perf_counter() - started, 4)
