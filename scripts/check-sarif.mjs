import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = spawnSync(process.execPath, [
  "bin/connector-scope-audit.js", "audit", "fixtures/action-plan.json",
  "--policy", "fixtures/policy.json", "--sarif"
], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const document = JSON.parse(run.stdout);
assert.equal(document.version, "2.1.0");
assert.equal(document.runs.length, 1);
assert.ok(Array.isArray(document.runs[0].tool.driver.rules));
assert.ok(Array.isArray(document.runs[0].results));
