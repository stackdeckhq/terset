"""Wide dotted headers must not require pairwise path comparisons."""

from pathlib import Path
import sys
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from terset import decode, encode


class HeaderPerformanceTests(unittest.TestCase):
    def test_20000_columns(self):
        fields = {f"f{index}": index for index in range(20_000)}
        for rows in [[fields, fields, fields], [{"a": fields}, {"a": fields}, {"a": fields}]]:
            text = encode(rows)
            start = time.perf_counter()
            self.assertEqual(decode(text), rows)
            self.assertLess(time.perf_counter() - start, 2)

    def test_5000_dotted_columns(self):
        fields = {f"f{index}": index for index in range(5000)}
        rows = [{"a": fields}, {"a": fields}, {"a": fields}]
        text = encode(rows)
        self.assertTrue(text.startswith("[3]\na.f0\ta.f1\t"))
        start = time.perf_counter()
        for _ in range(2):
            self.assertEqual(decode(text), rows)
        elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 2, f"Two decodes took {elapsed:.3f} s; limit is 2 s.")
