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

it("keeps the conformance manifest and specification on the same format version", () => {
  const manifest: unknown = JSON.parse(readFileSync(new URL("conformance/manifest.json", root), "utf8"));
  assert.ok(typeof manifest === "object" && manifest !== null && "formatVersion" in manifest);
  const spec = readFileSync(new URL("packages/terset/SPEC.md", root), "utf8");
  const version = /^Format version (\d+\.\d+)$/m.exec(spec)?.[1];
  assert.ok(version, "SPEC.md must state its format version");
  assert.equal(manifest.formatVersion, version);
  assert.deepEqual(readdirSync(new URL("conformance/", root)).filter(file => file.endsWith(".json")).sort(),
    [...fixtures, "manifest.json"].sort(), "Every fixture file must have JavaScript and Python runners");
});
