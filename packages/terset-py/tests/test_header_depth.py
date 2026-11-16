"""Deep headers fail before conflict checking or row construction."""

from pathlib import Path
import resource
import sys
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from terset import decode, encode


class HeaderDepthTests(unittest.TestCase):
    def test_deep_header(self):
        for segments in [10_000, 40_000]:
            text = "[2]\n" + ".".join(["a"] * segments) + "\n1\n2"
            before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            start = time.perf_counter()
            with self.assertRaisesRegex(ValueError, "^Maximum header path is 8 segments\\.$"):
                decode(text)
            self.assertLess(time.perf_counter() - start, 1)
            # macOS reports bytes; Linux reports KiB.
            scale = 1 if sys.platform == "darwin" else 1024
            self.assertLess((resource.getrusage(resource.RUSAGE_SELF).ru_maxrss - before) * scale, 32 * 1024 * 1024)

    def test_depth_boundary(self):
        for prefix in ["[2]", "rows[2]:", "rows{2}:"]:
            keyed = "{" in prefix
            header = ".".join(["a"] * 8)
            text = prefix + "\n" + ("@key\t" if keyed else "") + header + "\n" + ("one\t" if keyed else "") + "1\n" + ("two\t" if keyed else "") + "2"
            self.assertEqual(encode(decode(text)), text)
            with self.assertRaisesRegex(ValueError, "^Maximum header path is 8 segments\\.$"):
                decode(text.replace(header, "a." + header))
            with self.assertRaisesRegex(ValueError, "^Maximum header path is 8 segments\\.$"):
                decode(prefix + "\n" + ("@key\t" if keyed else "") + "a." + header)

    def test_many_short_rows(self):
        rows = "\n".join(["1"] * 50_000)
        with self.assertRaisesRegex(ValueError, "^Maximum header path is 8 segments\\.$"):
            decode("[50000]\n" + ".".join(["a"] * 499) + "\n" + rows)
        result = decode("[50000]\n" + ".".join(["a"] * 8) + "\n" + rows)
        self.assertEqual(len(result), 50_000)
        expected = 1
        for _ in range(8):
            expected = {"a": expected}
        for row in result:
            self.assertEqual(row, expected)

    def test_non_string(self):
        for value in [123, None, {}, []]:
            with self.assertRaises(TypeError):
                decode(value)
