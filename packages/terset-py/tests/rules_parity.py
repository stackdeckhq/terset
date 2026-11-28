"""Check the Python encoder against JavaScript texts and return fitted rules."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from terset import decode, encode, rules_for

rules = []
for index, text in enumerate(json.load(sys.stdin)):
    if encode(decode(text)) != text:
        raise ValueError(f"Case {index} encodes differently in Python.")
    rules.append(rules_for(text))
json.dump(rules, sys.stdout)
