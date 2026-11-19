import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { it } from "node:test";

const root = new URL("../../../", import.meta.url);
const fixtures = ["cases.json", "rejections.json", "rejection-errors.json"];

it("keeps conformance fixtures out of both packages' private tests", () => {
  for (const directory of ["packages/terset/tests/", "packages/terset-py/tests/"]) {
    const files = readdirSync(new URL(directory, root), { recursive: true, encoding: "utf8" });
    const copies = files.filter(file => fixtures.includes(basename(file)));
    assert.deepEqual(copies, [], `Private conformance fixtures in ${directory}`);
    for (const file of files.filter(file => file.endsWith(".json"))) {
      const content = readFileSync(new URL(file, new URL(directory, root)), "utf8");
      for (const fixture of fixtures) {
        assert.notDeepEqual(JSON.parse(content), JSON.parse(readFileSync(new URL(`conformance/${fixture}`, root), "utf8")),
          `Private copy of ${fixture} at ${directory}${file}`);
      }
    }
  }
});

function formatVersion(directory: string): unknown {
  const manifest: unknown = JSON.parse(readFileSync(new URL(`${directory}manifest.json`, root), "utf8"));
  assert.ok(typeof manifest === "object" && manifest !== null && "formatVersion" in manifest);
  return manifest.formatVersion;
}

it("keeps each format version's own suite, with the newest one matching the specification", () => {
  const spec = readFileSync(new URL("packages/terset/SPEC.md", root), "utf8");
  const version = /^Format version (\d+\.\d+)$/m.exec(spec)?.[1];
  assert.ok(version, "SPEC.md must state its format version");
  assert.equal(formatVersion("conformance/"), "1.0");
  assert.equal(formatVersion("conformance/1.1/"), version);
  const jsonFiles = (directory: string) => readdirSync(new URL(directory, root)).filter(file => file.endsWith(".json")).sort();
  assert.deepEqual(jsonFiles("conformance/"), [...fixtures, "manifest.json"].sort(), "Every fixture file must have JavaScript and Python runners");
  assert.deepEqual(jsonFiles("conformance/1.1/"), ["cases.json", "manifest.json", "rejections.json"], "Every fixture file must have JavaScript and Python runners");
});
