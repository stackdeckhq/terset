"""Read canonical texts on stdin and return only their fitted rules."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from terset import rules_for

json.dump([rules_for(text) for text in json.load(sys.stdin)], sys.stdout)
