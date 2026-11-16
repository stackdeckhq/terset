"""Long quoted strings round trip in every root-line-sensitive position."""

from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from terset import decode, encode, rules_for


class LongQuotedTests(unittest.TestCase):
    def test_long_quoted(self):
        text = '"' + "a" * 8_500_000
        for value in [
            [{"note": text}, {"note": "b"}],
            [{"id": text}, {"id": "b"}],
            {"rows": {text: {"name": "Ada"}, "other": {"name": "Ben"}}},
            {text: 1},
        ]:
            encoded = encode(value)
            self.assertEqual(decode(encoded), value)
            self.assertIsInstance(rules_for(encoded), str)
