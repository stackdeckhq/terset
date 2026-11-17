// Run from the repository root with Node 24.
import { writeFileSync } from "node:fs";
import { sharedCases } from "./shared-cases.ts";

writeFileSync(new URL("../../../conformance/cases.json", import.meta.url), sharedCases());
