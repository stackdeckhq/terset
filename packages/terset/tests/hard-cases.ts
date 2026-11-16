import type { JsonRoot, JsonValue } from "../src/index.ts";
import type { SharedRecipe } from "./shared-recipes.ts";

/** Shared by the named regressions and the seeded fuzz generators. */
export const HARD_STRINGS = [
  "😀𝄞", "👩🏽‍💻👨‍👩‍👧‍👦🇪🇸", "\ud800", "\udfff", "café", "cafe\u0301", "a\u0308\u0323",
  "İ", "ı", "I", "i", "ß", "SS", "Σ", "σ", "ς", "العربية", "עברית",
  "\u202aA\u202bB\u202cC\u202dD\u202eE", "\u2066A\u2067B\u2068C\u2069D",
  "x\u200by\u200cz\u200d", "\ufeffstart", "mid\ufeffdle", "soft\u00adhyphen",
  "\u00a0edge\u00a0", "\u1680\u2000\u2007\u202f\u205f\u3000edge\u3000",
  "a\tb", "a\nb", "a\rb", "a\r\nb", "a\u2028b", "a\u2029b", "a\u0085b",
  "a\u0000b", "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\u000b\f\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f\u007f",
  '"', 'quotes " and \\ slash', "{start", "[start", "- item", "# comment", ":", "a: b",
  "id\tname", "items:", "true", "false", "null", "007", "+5", "1e5", ".5", "-0",
  "NaN", "Infinity", "undefined", "", "12", "c3", "move 4 to c2", "__proto__",
  "constructor", "toString", "key with spaces", "key\twith tab", "日本語 中文 한국어", "España, año, pingüino",
  "scan.PdF", "archive.tar.GZ", ".env", ".gitignore", "name.", "東京.報告.PDF", "new..pdf",
] as const;

/** File-name pairs with mixed-case extensions, many dots, dot-files and edge spaces. */
const FILE_NAME_PAIRS = [
  { original: "scan.PdF", rename: "Receta", expected: "Receta.pdf" },
  { original: "scan.PdF", rename: "Receta.PDF", expected: "Receta.PDF" },
  { original: "scan.pdf", rename: "Receta.txt", expected: "Receta.txt" },
  { original: "archive.tar.GZ", rename: "Archivo", expected: "Archivo.gz" },
  { original: "archive.tar.GZ", rename: "Archivo.tar", expected: "Archivo.tar" },
  { original: "report.final.PDF", rename: "Nuevo", expected: "Nuevo.pdf" },
  { original: ".env", rename: "Configuración", expected: "Configuración.env" },
  { original: ".gitignore", rename: "Configuración", expected: "Configuración" },
  { original: "name.", rename: "Nuevo", expected: "Nuevo" },
  { original: "scan.pdf", rename: "Nuevo.", expected: "Nuevo..pdf" },
  { original: "東京.報告.PDF", rename: "東京の報告", expected: "東京の報告.pdf" },
  { original: "cafe\u0301.PDF", rename: "cafe\u0301", expected: "cafe\u0301.pdf" },
  { original: "scan.pdf", rename: "  Nuevo  ", expected: "Nuevo.pdf" },
  { original: "scan.pdf", rename: "Nuevo.txt ", expected: "Nuevo.txt " },
  { original: "scan.pdf", rename: "", expected: "" },
  { original: "scan.pdf", rename: "   ", expected: "   " },
  { original: "scan.pdf", rename: "Nuevo.2024", expected: "Nuevo.2024" },
  { original: "scan.pdf", rename: "Nuevo.é", expected: "Nuevo.é.pdf" },
  { original: "scan.pdf ", rename: "Nuevo", expected: "Nuevo" },
] as const;

export type HardCase = { name: string; value: JsonRoot; texts: readonly string[]; limit?: "negative zero" | "depth"; recipe?: SharedRecipe };
function textCase(name: string, texts: readonly string[]): HardCase {
  return { name, texts, value: { items: texts.map((name, index) => ({ id: String(index + 1), name, summary: name })), text: texts.join(" | ") } };
}
function nested(depth: number): JsonValue {
  let value: JsonValue = "底";
  for (let i = 0; i < depth; i++) value = { next: value };
  return value;
}
export const HARD_CASES: readonly HardCase[] = [
  textCase("emoji, astral, ZWJ, flags, skin tones", HARD_STRINGS.slice(0, 2)),
  textCase("lone high and low surrogates", HARD_STRINGS.slice(2, 4)),
  { name: "lone surrogate ids and keys", texts: ["\ud800", "\udfff"], value: { "\ud800": [{ id: "\udfff", "\udfff": "\ud800" }] } },
  textCase("combining marks, NFC and NFD", HARD_STRINGS.slice(4, 7)),
  textCase("Turkish, German and Greek case traps", HARD_STRINGS.slice(7, 16)),
  textCase("Arabic, Hebrew and bidi controls", HARD_STRINGS.slice(16, 20)),
  textCase("invisible characters and Unicode edge spaces", HARD_STRINGS.slice(20, 26)),
  textCase("tab, LF, CR, CRLF and Unicode line breaks", HARD_STRINGS.slice(26, 33)),
  textCase("NUL, C0 controls and DEL", HARD_STRINGS.slice(33, 35)),
  textCase("quotes, delimiters, header and list lookalikes", HARD_STRINGS.slice(35, 45)),
  textCase("text that looks like scalar types", HARD_STRINGS.slice(45, 59)),
  textCase("handle-looking text", ["12", "c3", "move 4 to c2", "1", "c1"]),
  { name: "dangerous, empty, Unicode and normalized keys", texts: ["__proto__", "constructor", "toString", "", "a b", "a\tb", "中文", "é", "e\u0301"], value: Object.fromEntries(["__proto__", "constructor", "toString", "", "a b", "a\tb", "中文", "é", "e\u0301"].map((key) => [key, { [key]: "value" }])) },
  { name: "empty text, absent field and null", texts: ["", "null"], value: { items: [{ id: "1", text: "", other: null }, { id: "2", other: "null" }], empty: "", nil: null } },
  { name: "large, small and imprecise finite numbers", texts: ["numbers"], value: { values: [1e21, 1e-7, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 0.1 + 0.2] } },
  { name: "numeric negative zero", texts: ["-0"], value: { number: -0 }, limit: "negative zero" },
  { name: "empty and irregular shapes", texts: ["shapes"], value: { empty: [], object: {}, one: [{ id: "1" }], uneven: [{ id: "1", a: 2 }, { id: "2", b: 3, a: 4 }], nested: [[1, [2, []]]], mixed: [null, "a", { id: "3" }, []] } },
  { name: "depth 500 boundary", texts: ["deep"], value: { nested: nested(499) }, recipe: { kind: "depth", depth: 499, leaf: "底" } },
  { name: "depth 501 rejected", texts: ["deep"], value: { nested: nested(500) }, limit: "depth" },
  { ...textCase("100 kB text", ["ñ".repeat(50_000)]), recipe: { kind: "repeat-text", text: "ñ", count: 50_000 } },
  { name: "5,000 rows", texts: ["large table"], value: { items: Array.from({ length: 5000 }, (_, index) => ({ id: String(index + 1), name: `資料 ${index} 😀` })) }, recipe: { kind: "rows", count: 5000, prefix: "資料 ", suffix: " 😀" } },
  textCase("Spanish and CJK", ["España, año, pingüino", "日本語 中文 한국어"]),
  textCase("mixed-case extensions, multiple dots, dot-files and Unicode suffixes", FILE_NAME_PAIRS.flatMap(({ original, rename }) => [original, rename])),
  { name: "numeric ids in a root table", texts: ["12", "true", "null"], value: [{ id: 12, label: "12" }, { id: 34, label: "true" }, { id: 56, label: "null" }] },
  { name: "no id, boolean/null and mixed scalar columns", texts: ["true", "12", "null"], value: { rows: [true, "true", 12, "12", null, "null", false, ""].map((value) => ({ value, label: "same column" })) } },
  { name: "one field, absent first field and empty rows", texts: ["", "null"], value: [{ long_field: "" }, {}, { long_field: null }, { long_field: "null" }] },
  { name: "root table with tab and newline cells", texts: ["a\tb", "a\nb"], value: [{ text: "a\tb", n: 1 }, { text: "a\nb", n: 2 }, { text: "a\r\nb", n: 3 }] },
  { name: "mixed root array stays compact JSON", texts: ["root array"], value: [12, "12", true, "true", null, "null", [1, 2], { no_id: false }] },
  { name: "typed id column versus bare string-id column", texts: ["12", "true", "null"], value: { typed: [{ id: 12 }, { id: "12" }, { id: true }, { id: "true" }, { id: null }, { id: "null" }], strings: [{ id: "12" }, { id: "true" }, { id: "null" }] } },
];
