import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = spawnSync(process.execPath, [
  "bin/connector-scope-audit.js", "audit", "fixtures/action-plan.json",
  "--policy", "fixtures/policy.json", "--sarif"
], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
const document = JSON.parse(run.stdout);
assert.equal(document.version, "2.1.0");
assert.ok(Array.isArray(document.runs) && document.runs.length === 1,
  "SARIF must contain exactly one run");

const [runRecord] = document.runs;
assert.ok(runRecord.tool && typeof runRecord.tool === "object",
  "SARIF run must contain a tool");
const driver = runRecord.tool.driver;
assert.ok(driver && typeof driver === "object", "SARIF tool must contain a driver");
for (const field of ["name"]) {
  assert.equal(typeof driver[field], "string", `SARIF driver.${field} must be a string`);
  assert.ok(driver[field].length > 0, `SARIF driver.${field} must not be empty`);
}
assert.ok(Array.isArray(driver.rules), "SARIF driver.rules must be an array");
const ruleIds = new Set();
for (const [index, rule] of driver.rules.entries()) {
  assert.ok(rule && typeof rule === "object", `SARIF rule ${index} must be an object`);
  assert.equal(typeof rule.id, "string", `SARIF rule ${index} must have a string id`);
  assert.ok(rule.id.length > 0, `SARIF rule ${index} id must not be empty`);
  assert.ok(!ruleIds.has(rule.id), `SARIF rule id must be unique: ${rule.id}`);
  ruleIds.add(rule.id);
}
assert.ok(Array.isArray(runRecord.results), "SARIF run.results must be an array");
for (const [index, result] of runRecord.results.entries()) {
  assert.ok(result && typeof result === "object", `SARIF result ${index} must be an object`);
  assert.ok(result.ruleId && typeof result.ruleId === "string",
    `SARIF result ${index} must have a ruleId`);
  assert.ok(ruleIds.has(result.ruleId),
    `SARIF result ${index} references unknown rule ${result.ruleId}`);
  assert.ok(result.message && typeof result.message.text === "string",
    `SARIF result ${index} must have message.text`);
}
