import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/connector-scope-audit.js", import.meta.url));
const plan = {
  connector: "crm",
  scopes: ["contacts.read"],
  dataClasses: ["contact"],
  actions: ["update"]
};
const basePolicy = {
  allowedScopes: ["contacts.read"],
  allowedDataClasses: ["contact"],
  allowedReadActions: ["read"],
  allowedWriteActions: ["update"]
};

async function runAudit(t, requireApprovalForWrites, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "connector-scope-audit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const planPath = join(directory, "plan.json");
  const policyPath = join(directory, "policy.json");
  await Promise.all([
    writeFile(planPath, JSON.stringify({ ...plan, ...overrides.plan })),
    writeFile(policyPath, JSON.stringify({
      ...basePolicy,
      requireApprovalForWrites,
      ...overrides.policy
    }))
  ]);
  return spawnSync(process.execPath, [cli, "audit", planPath, "--policy", policyPath, "--json"], {
    encoding: "utf8"
  });
}

test("CLI exits 2 for an unapproved write when approval is required", async (t) => {
  const result = await runAudit(t, true);
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).decision, "block");
});

test("CLI exits 0 for an unapproved write when approval is not required", async (t) => {
  const result = await runAudit(t, false);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).decision, "pass");
});

test("CLI returns block JSON and exit status 2 for an unclassified action", async (t) => {
  const result = await runAudit(t, true, {
    plan: { actions: ["archive"] }
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.message === "Action is not allowed by policy: archive"
  ));
});

test("CLI returns block JSON and exit status 2 when connector identity is missing", async (t) => {
  const result = await runAudit(t, false, {
    plan: { connector: "  ", actions: ["read"] }
  });

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.connector, "");
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.severity === "block"
    && finding.message === "Connector identity is required."
  ));
});
