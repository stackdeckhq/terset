"""Static typing examples to check when a type checker is available."""

from terset import JsonInputRoot, JsonRoot, decode, encode

# Keep the inferred type from the README, without widening it by annotation.
data = [{"id": "1", "name": "Ada"}, {"id": "2", "name": "Ben"}]
text: str = encode(data)
accepted: JsonInputRoot = data
decoded: JsonRoot = decode(text)

nested = {"rows": [{"id": "1"}, {"id": "2"}]}
nested_text: str = encode(nested)
