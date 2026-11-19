"""Format 1.1 named cells, using the shared 1.1 conformance suite."""

import json
from pathlib import Path
import sys
import time
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
SUITE = PACKAGE.parents[1] / "conformance" / "1.1"
sys.path.insert(0, str(PACKAGE / "src"))

from terset import decode, encode, rules_for  # noqa: E402

NAMED = "After the header columns, a row lists its other fields as name=value. A field a row does not list is absent."
TABLE = "Tables use tab-separated headers and rows."
KEYED = "name{N} has N entries; the @key column holds each entry's key and is not a field."


class FormatOneOneTests(unittest.TestCase):
    def test_shared_cases(self):
        for case in json.loads((SUITE / "cases.json").read_text(encoding="utf-8")):
            with self.subTest(case=case["name"]):
                self.assertEqual(encode(case["input"]), case["encoded"])
                self.assertEqual(encode(case["input"], format="1.1"), case["encoded"])
                decoded = decode(case["encoded"])
                self.assertEqual(json.dumps(decoded), json.dumps(case["input"]))

    def test_shared_rejections(self):
        for text in json.loads((SUITE / "rejections.json").read_text(encoding="utf-8")):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    decode(text)
                with self.assertRaises(ValueError):
                    rules_for(text)

    def test_format_1_0_sparse_tables(self):
        value = [{"a": 1, "b": 2, "c": 3}, {"a": 4, "c": 6}]
        legacy = "[2]\na\tb\tc\n1\t2\t3\n4\t\t6"
        self.assertEqual(encode(value, format="1.0"), legacy)
        self.assertEqual(json.dumps(decode(legacy)), json.dumps(value))
        self.assertEqual(rules_for(legacy), TABLE + " Empty cells mean absent.")

    def test_mixed_versions_are_rejected(self):
        value = {"x": [{"a": 1, "b": 2}, {"a": 3}], "y": [{"a": 1, "b": 2}, {"a": 3}]}
        named = encode(value)
        legacy = encode(value, format="1.0")
        self.assertEqual(decode(named), value)
        self.assertEqual(decode(legacy), value)
        mixed = named.split("\ny")[0] + "\ny" + legacy.split("\ny")[1]
        with self.assertRaisesRegex(ValueError, "Noncanonical Terset text."):
            decode(mixed)

    def test_fitted_rules(self):
        self.assertEqual(rules_for("[2]\na\tname=value\n1\tb=2\tc=3\n4\tc=6"), " ".join([TABLE, NAMED]))
        self.assertEqual(rules_for("m{3}:\n@key\ta\tname=value\nalpha\t1\tb=2\nbeta\t3\ngamma\t4\tb=5"), " ".join([TABLE, NAMED, KEYED]))

    def test_format_option(self):
        for format in ["2.0", 1.1, None]:
            with self.subTest(format=format):
                with self.assertRaises(TypeError):
                    encode([], format=format)  # type: ignore[arg-type]
        with self.assertRaises(TypeError):
            encode([], "1.1")  # type: ignore[misc]

    def test_wide_sparse_lists_in_linear_time(self):
        rows = [{f"field_{index}": index, "shared": index} for index in range(20_000)]
        started = time.perf_counter()
        text = encode(rows)
        self.assertLess(time.perf_counter() - started, 4)
        self.assertTrue(text.startswith("[20000]\nname=value\nfield_0=0\tshared=0\n"))
        self.assertEqual(decode(text), rows)


if __name__ == "__main__":
    unittest.main()
