"""Specific parser errors precede canonical validation."""

import json
from pathlib import Path
import sys
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from terset import decode, encode


class DecoderErrorTests(unittest.TestCase):
    def test_specific_errors(self):
        cases = json.loads((PACKAGE.parents[1] / "conformance/rejection-errors.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]), self.assertRaises(ValueError) as caught:
                decode(case["text"])
            self.assertEqual(str(caught.exception), case["error"])

    def test_one_entry_map_stays_json(self):
        row = {f"long_field_{index}": index for index in range(10)}
        value = {"rows": {"a": row}}
        compact = "rows: " + json.dumps(value["rows"], separators=(",", ":"))
        candidate = "rows{1}:\n@key\t" + "\t".join(row) + "\na\t" + "\t".join(str(value) for value in row.values())
        self.assertLess(len(candidate.encode("utf-8")), len(compact.encode("utf-8")))
        self.assertEqual(encode(value), compact)
        self.assertEqual(decode(compact), value)
