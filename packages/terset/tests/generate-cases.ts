// Run from the repository root with Node 24.
import { writeFileSync } from "node:fs";
import { sharedCases } from "./shared-cases.ts";

writeFileSync(new URL("./cases.json", import.meta.url), sharedCases());
