import test from "node:test";
import assert from "node:assert/strict";
import { auditPlan, normalizePlan, renderMarkdown } from "../src/index.js";

const policy = {
  allowedScopes: ["contacts.read", "contacts.write"],
  allowedDataClasses: ["contact"],
  allowedReadActions: ["read"],
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

test("blocks an otherwise valid plan without a connector identity", () => {
  const report = auditPlan({
    connector: "   ",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["read"]
  }, policy);

  assert.equal(report.connector, "");
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.severity === "block"
    && finding.message === "Connector identity is required."
  ));
  assert.match(renderMarkdown(report), /Connector: missing \(required\)/);
});

for (const [name, connector] of [
  ["object", { name: "crm" }],
  ["array", ["crm"]],
  ["number", 42],
  ["boolean", true],
  ["null", null]
]) {
  test(`blocks a ${name} connector identity instead of coercing it`, () => {
    const report = auditPlan({
      connector,
      scopes: ["contacts.read"],
      dataClasses: ["contact"],
      actions: ["read"]
    }, policy);

    assert.equal(report.connector, "");
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) =>
      finding.severity === "block"
      && finding.message === "Connector identity must be a string."
    ));
  });
}

test("trims a valid string connector identity", () => {
  const report = auditPlan({
    connector: "  crm  ",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["read"]
  }, policy);

  assert.equal(report.connector, "crm");
  assert.equal(report.decision, "pass");
});

test("blocks missing write approval when policy requires it", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["update"]
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.severity === "block"
    && finding.message === "Write action requested without approval evidence."
  ));
});

for (const [name, approval] of [
  ["object", { ticket: "APP-42" }],
  ["array", ["APP-42"]],
  ["number", 42],
  ["boolean", true],
  ["null", null]
]) {
  test(`${name} approval evidence does not satisfy a required approval`, () => {
    const report = auditPlan({
      connector: "crm",
      scopes: ["contacts.write"],
      dataClasses: ["contact"],
      actions: ["update"],
      approval
    }, policy);

    assert.equal(report.approval, "");
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) =>
      finding.severity === "block"
      && finding.message === "Write action requested without approval evidence."
    ));
  });
}

test("trims valid string approval evidence", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["update"],
    approval: "  Approved in APP-42.  "
  }, policy);

  assert.equal(report.approval, "Approved in APP-42.");
  assert.equal(report.decision, "pass");
});

test("allows missing write approval when policy does not require it", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["update"]
  }, { ...policy, requireApprovalForWrites: false });
  assert.equal(report.decision, "pass");
  assert.ok(!report.findings.some((finding) => finding.message.includes("approval")));
});

test("blocks actions that policy does not classify", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["archive"],
    approval: "User approved archiving the contact."
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.message === "Action is not allowed by policy: archive"
  ));
});

test("requires approval for policy-defined write actions", () => {
  const archivePolicy = {
    ...policy,
    allowedWriteActions: [...policy.allowedWriteActions, "archive"]
  };
  const plan = {
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["archive"]
  };

  const missingApproval = auditPlan(plan, archivePolicy);
  assert.equal(missingApproval.decision, "block");
  assert.ok(missingApproval.findings.some((finding) =>
    finding.message === "Write action requested without approval evidence."
  ));

  const approved = auditPlan({
    ...plan,
    approval: "User approved archiving the contact."
  }, archivePolicy);
  assert.equal(approved.decision, "pass");
  assert.ok(approved.findings.some((finding) =>
    finding.message === "Write approval evidence is present."
  ));
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

test("blocks non-object plan and policy roots without throwing", () => {
  for (const [plan, suppliedPolicy, message] of [
    [null, policy, "Plan must be a JSON object."],
    [{}, null, "Policy must be a JSON object."],
    [[], policy, "Plan must be a JSON object."],
    [{}, [], "Policy must be a JSON object."]
  ]) {
    const report = auditPlan(plan, suppliedPolicy);
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) => finding.message === message));
    assert.match(renderMarkdown(report), new RegExp(message.replaceAll(".", "\\.")));
  }
});

test("does not coerce malformed plan and policy identifiers into a pass", () => {
  const invalidIdentifier = { bad: true };
  const report = auditPlan({
    connector: "crm",
    scopes: invalidIdentifier,
    dataClasses: [invalidIdentifier],
    actions: [invalidIdentifier]
  }, {
    allowedScopes: [invalidIdentifier],
    allowedDataClasses: invalidIdentifier,
    allowedReadActions: [invalidIdentifier],
    allowedWriteActions: [],
    requireApprovalForWrites: false
  });

  assert.equal(report.decision, "block");
  assert.deepEqual(report.scopes, []);
  assert.deepEqual(report.dataClasses, []);
  assert.deepEqual(report.actions, []);
  for (const message of [
    "Plan scopes must be a string or an array of strings.",
    "Plan data classes must contain only strings.",
    "Plan actions must contain only strings.",
    "Policy allowed scopes must contain only strings.",
    "Policy allowed data classes must be a string or an array of strings.",
    "Policy allowed read actions must contain only strings."
  ]) {
    assert.ok(report.findings.some((finding) => finding.message === message));
  }
});

test("renders markdown report", () => {
  const report = auditPlan({ connector: "crm", scopes: ["contacts.read"], dataClasses: ["contact"], actions: ["read"] }, policy);
  assert.match(renderMarkdown(report), /Connector Scope Audit/);
});
