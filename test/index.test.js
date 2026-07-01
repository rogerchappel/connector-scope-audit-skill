import test from "node:test";
import assert from "node:assert/strict";
import { auditPlan, normalizePlan, renderMarkdown } from "../src/index.js";

const policy = {
  allowedScopes: ["contacts.read", "contacts.write"],
  allowedDataClasses: ["contact"],
  allowedWriteActions: ["update"],
  requireApprovalForWrites: true
};

test("normalizes plan arrays and aliases", () => {
  const plan = normalizePlan({ scopes: "Contacts.Read", data: ["Contact"], actions: ["UPDATE"] });
  assert.deepEqual(plan.scopes, ["contacts.read"]);
  assert.deepEqual(plan.dataClasses, ["contact"]);
  assert.deepEqual(plan.actions, ["update"]);
});

test("passes approved in-policy write plan", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read", "contacts.write"],
    dataClasses: ["contact"],
    actions: ["update"],
    approval: "User approved contact note update."
  }, policy);
  assert.equal(report.decision, "pass");
});

test("warns on missing write approval", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["update"]
  }, policy);
  assert.equal(report.decision, "warn");
});

test("blocks unknown scope and write action", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["deals.delete"],
    dataClasses: ["deal"],
    actions: ["delete"]
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) => finding.message.includes("deals.delete")));
});

test("renders markdown report", () => {
  const report = auditPlan({ connector: "crm", scopes: ["contacts.read"], dataClasses: ["contact"], actions: ["read"] }, policy);
  assert.match(renderMarkdown(report), /Connector Scope Audit/);
});
