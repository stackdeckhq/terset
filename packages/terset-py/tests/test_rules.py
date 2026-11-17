"""Fitted rules share the decoder's structural validation."""

import json
from pathlib import Path
import sys
import unittest

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE / "src"))

from terset import RULES, decode, encode, rules_for


class RulesTests(unittest.TestCase):
    def test_root_values_and_id_cells(self):
        self.assertEqual(rules_for(encode({"name": "Ada"})), "")
        self.assertEqual(rules_for(encode({"value": "true"})),
                         "JSON quotes distinguish numeric, boolean or null text from scalars.")
        self.assertEqual(rules_for(encode([{"id": '"true"'}, {"id": "[1]"}])),
                         "Tables use tab-separated headers and rows. A leading bare id header marks string IDs.")

    def test_shared_rules(self):
        cases = json.loads((PACKAGE.parent / "terset/tests/rules-cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                self.assertEqual(rules_for(case["text"]), case["rules"])
        self.assertEqual(cases[-1]["rules"], RULES)

    def test_same_rejections(self):
        cases = json.loads((PACKAGE.parent / "terset/tests/rejection-errors.json").read_text(encoding="utf-8"))
        cases.append({"text": "{2}\n@key\tname\na\tAda\nb\tLin"})
        for case in cases:
            with self.subTest(text=case["text"]):
                with self.assertRaises(ValueError) as decoded:
                    decode(case["text"])
                with self.assertRaises(type(decoded.exception)) as fitted:
                    rules_for(case["text"])
                self.assertEqual(str(decoded.exception), str(fitted.exception))
