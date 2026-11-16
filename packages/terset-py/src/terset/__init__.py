"""Encode and decode canonical Terset text without runtime dependencies."""

from ._terset import RULES, JsonInputRoot, JsonInputValue, JsonObject, JsonRoot, JsonValue, decode, encode, rules_for

__all__ = ["RULES", "JsonInputRoot", "JsonInputValue", "JsonObject", "JsonRoot", "JsonValue", "decode", "encode", "rules_for"]
