"""Check the installed wheel without importing from the source checkout."""

from importlib.metadata import distribution
from pathlib import Path
import sys

import terset


package = distribution("terset")
assert package.metadata["Name"] == "terset"
assert package.metadata["Requires-Python"] == ">=3.10"
assert not package.requires, "The package must have no runtime dependencies."
assert Path(terset.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())
assert Path(terset.__file__).with_name("py.typed").is_file()

values = [
    [{"id": "1", "name": "Ada"}, {"id": "2", "name": "Ben"}],
    {"people": {"ada": {"name": "Ada", "active": True}, "ben": {"name": "Ben", "active": False}}},
    [{"person": {"name": "Ada", "age": 30}}, {"person": {"name": "Ben", "age": 31}}],
    {"empty": "", "null": None, "list": [True, 1, "café"]},
]
for value in values:
    text = terset.encode(value)
    assert terset.decode(text) == value
    assert terset.rules_for(text)

assert terset.encode(values[0]) == "[2]\nid\tname\n1\tAda\n2\tBen"
assert "@key" in terset.encode(values[1])
assert "person.name" in terset.encode(values[2])
print("Installed wheel: metadata, typing marker, format v2 and four round trips passed.")
